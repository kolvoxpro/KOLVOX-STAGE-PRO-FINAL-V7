import { safeFetchJson } from '../utils/safeFetch';
import { generatePixPayload, generatePixQrDataUrl } from '../utils/pix';

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
 * Fallback to robust client-side Pix generation for static Vercel deployments.
 */
export async function createPixPayment(params: CreatePixRequest): Promise<PixPaymentInfo> {
  const activeAmount = params.amount && parseFloat(params.amount) > 0
    ? parseFloat(params.amount).toFixed(2)
    : (params.plan === 'kolvox_pro_monthly' ? '9.99' : '99.99');

  try {
    const response = await fetch('/api/payments/create-pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, amount: activeAmount }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.payment && data.payment.qrCodeUrl) {
        return data.payment;
      }
    }
  } catch (err) {
    console.warn('Backend payment route unavailable on Vercel/Static host, generating client-side Pix:', err);
  }

  // Client-side 100% resilient Pix generation (guaranteed to render QR code on Vercel)
  const pixKey = 'kolvox.pagamentos@gmail.com';
  const refCode = `KVX${params.plan === 'kolvox_pro_yearly' ? 'YEAR' : 'MONTH'}${Date.now().toString().slice(-4)}`;
  const pixCode = generatePixPayload({
    pixKey,
    receiverName: 'KOLVOX TECNOLOGIA LTDA',
    city: 'SAO PAULO',
    amount: activeAmount,
    referenceCode: refCode,
  });

  const qrCodeUrl = await generatePixQrDataUrl(pixCode);

  return {
    id: `pix_${Date.now()}`,
    provider: 'pix_gateway',
    status: 'pending',
    pixCode,
    qrCodeUrl,
    amount: activeAmount,
    plan: params.plan,
    planName: params.plan === 'kolvox_pro_yearly' ? 'Plano Anual PRO (R$ 99,99/ano)' : 'Plano Mensal PRO (R$ 9,99/mês)',
    referenceCode: refCode,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    userId: params.userId,
    userEmail: params.userEmail,
  };
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
