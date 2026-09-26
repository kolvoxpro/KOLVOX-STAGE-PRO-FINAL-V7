import { safeFetchJson } from '../utils/safeFetch';

export interface PixPaymentInfo {
  id: string;
  provider: 'mercadopago' | 'stripe' | 'pix_gateway';
  status: 'pending' | 'approved' | 'cancelled' | 'expired';
  pixCode: string;
  qrCodeUrl: string;
  amount: string;
  plan: 'kolvox_pro_monthly' | 'kolvox_pro_yearly';
  planName: string;
  referenceCode: string;
  expiresAt: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  approvedAt?: string;
}

export interface CreatePixRequest {
  userId: string;
  userEmail: string;
  userName: string;
  plan: 'kolvox_pro_monthly' | 'kolvox_pro_yearly';
  amount: string;
}

/**
 * Creates a new Pix payment order through the backend payment integration (Mercado Pago / Gateway).
 */
export async function createPixPayment(params: CreatePixRequest): Promise<PixPaymentInfo> {
  const response = await fetch('/api/payments/create-pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao gerar pagamento Pix na API de pagamentos.');
  }

  const data = await response.json();
  return data.payment;
}

/**
 * Checks the status of a payment by its ID.
 */
export async function checkPaymentStatus(paymentId: string): Promise<{
  status: 'pending' | 'approved' | 'cancelled' | 'expired';
  payment: PixPaymentInfo;
  isApproved?: boolean;
}> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const data = await safeFetchJson<{
    success: boolean;
    status: 'pending' | 'approved' | 'cancelled' | 'expired';
    isApproved?: boolean;
    payment: PixPaymentInfo;
  }>(`/api/payments/status?paymentId=${encodeURIComponent(paymentId)}`, { headers }, {
    success: false,
    status: 'pending',
    payment: {} as PixPaymentInfo,
  });

  return {
    status: data.isApproved ? 'approved' : (data.status || 'pending'),
    payment: data.payment,
    isApproved: data.isApproved,
  };
}

/**
 * Simulates a webhook delivery event (e.g., Mercado Pago IPN / Webhook) to test automated plan updates.
 */
export async function simulateWebhookApproval(paymentId: string): Promise<{
  success: boolean;
  status: string;
  payment: PixPaymentInfo;
}> {
  const response = await fetch('/api/webhooks/simulate-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId }),
  });

  if (!response.ok) {
    throw new Error('Falha ao acionar simulação de webhook de pagamento.');
  }

  return await response.json();
}

/**
 * Listens for payment approval by polling the payment status endpoint.
 * When the status becomes 'approved', executes the onApproved callback.
 */
export function listenForPaymentApproval(
  paymentId: string,
  onApproved: (payment: PixPaymentInfo) => void,
  intervalMs = 2500
): () => void {
  let isCancelled = false;

  const intervalId = setInterval(async () => {
    if (isCancelled) return;

    try {
      const result = await checkPaymentStatus(paymentId);
      if (result.status === 'approved' && !isCancelled) {
        isCancelled = true;
        clearInterval(intervalId);
        onApproved(result.payment);
      }
    } catch (err) {
      console.warn('Silent notice while polling payment status:', err);
    }
  }, intervalMs);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
  };
}
