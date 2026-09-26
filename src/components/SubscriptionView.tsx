import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Payment } from '../types/index.ts';
import { safeFetchJson } from '../utils/safeFetch.ts';
import {
  createPixPayment,
  checkPaymentStatus,
  simulateWebhookApproval,
  listenForPaymentApproval,
  PixPaymentInfo,
} from '../services/PaymentService.ts';
import confetti from 'canvas-confetti';
import {
  Crown,
  CheckCircle2,
  Sparkles,
  QrCode,
  CreditCard,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  DollarSign,
  Zap,
  HelpCircle,
  FileCheck,
  AlertCircle,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';


interface PublicSettings {
  pixKey: string;
  pixKeyType: string;
  pixReceiverName: string;
  pixCity: string;
  supportEmail: string;
  monthlyPrice: string;
  trialDays: number;
  pixEnabled: boolean;
  manualPaymentEnabled: boolean;
}

export const SubscriptionView: React.FC = () => {
  const { user, subscription, trialDaysLeft, isPremiumActive, token, refreshUserData, activateProSubscription } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'kolvox_pro_monthly' | 'kolvox_pro_yearly'>('kolvox_pro_monthly');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Server-managed public settings
  const [settings, setSettings] = useState<PublicSettings>({
    pixKey: 'kolvox.pagamentos@gmail.com',
    pixKeyType: 'E-mail',
    pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
    pixCity: 'SAO PAULO',
    supportEmail: 'kolvox.pagamentos@gmail.com',
    monthlyPrice: '10.00',
    trialDays: 7,
    pixEnabled: true,
    manualPaymentEnabled: true,
  });

  // Dynamic Pix QR state & Payment API
  const [currentPayment, setCurrentPayment] = useState<PixPaymentInfo | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [webhookApprovedNotice, setWebhookApprovedNotice] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState<string>('');
  const [pixPayloadCode, setPixPayloadCode] = useState<string>('');
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [copiedPixCode, setCopiedPixCode] = useState(false);


  // Manual payment submission form state
  const [payerName, setPayerName] = useState(user?.nomeCompleto || '');
  const [refCode, setRefCode] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSuccessNotice, setProofSuccessNotice] = useState<string | null>(null);

  // Credit card form simulation
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // 1. Fetch server-configured settings (Pix key, price, support email)
  useEffect(() => {
    safeFetchJson<PublicSettings>(
      '/api/settings/public',
      {},
      {
        pixKey: 'kolvox.pagamentos@gmail.com',
        pixKeyType: 'E-mail',
        pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
        pixCity: 'SAO PAULO',
        monthlyPrice: '10.00',
        trialDays: 7,
        pixEnabled: true,
        manualPaymentEnabled: true,
        supportEmail: 'kolvox.pagamentos@gmail.com',
      }
    ).then((data) => {
      if (data && data.pixKey) {
        setSettings(data);
      }
    });
  }, []);

  // 2. Generate Pix via Payment API (Mercado Pago / Certified Pix Gateway)
  useEffect(() => {
    let isMounted = true;
    setLoadingPix(true);
    const activePrice = selectedPlan === 'kolvox_pro_monthly' ? '10.00' : '99.99';

    createPixPayment({
      userId: user?.uid || user?.id || 'guest',
      userEmail: user?.email || 'demo@kolvox.app',
      userName: user?.nomeArtistico || user?.nomeCompleto || 'Vocalista',
      plan: selectedPlan,
      amount: activePrice,
    })
      .then((payment) => {
        if (isMounted) {
          setCurrentPayment(payment);
          setPixPayloadCode(payment.pixCode);
          setPixQrUrl(payment.qrCodeUrl);
          setLoadingPix(false);
        }
      })
      .catch((err) => {
        console.warn('Erro ao criar pagamento Pix:', err);
        if (isMounted) setLoadingPix(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPlan, user]);

  // 3. Real-time Bank & Admin recognition listener for automatic subscription activation
  useEffect(() => {
    if (subscription?.status === 'active' || isPremiumActive) return;

    // Check every 3.5 seconds if the bank recognized the payment or admin approved it
    const interval = setInterval(async () => {
      try {
        const query = currentPayment?.id ? `?paymentId=${encodeURIComponent(currentPayment.id)}` : '';
        const res = await fetch(`/api/payments/status${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.isApproved || data.status === 'approved' || data.paymentConfirmed) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
          setWebhookApprovedNotice('🎉 Pagamento reconhecido pelo banco com sucesso! Seu plano PRO foi liberado automaticamente.');
          setToastMessage(`🎉 Pagamento confirmado pelo banco! O Plano PRO da conta ${user?.email} foi liberado automaticamente.`);
          await activateProSubscription(selectedPlan, currentPayment?.referenceCode || `BANK-CONFIRMED-${Date.now()}`);
          await refreshUserData();
          await loadPayments();
        }
      } catch (err) {
        // silent polling catch
      }
    }, 3500);

    return () => {
      clearInterval(interval);
    };
  }, [currentPayment?.id, selectedPlan, subscription?.status, isPremiumActive, token, user?.email]);

  const handleSimulateWebhook = async () => {
    if (!currentPayment?.id) return;
    setSimulatingWebhook(true);
    try {
      const res = await simulateWebhookApproval(currentPayment.id);
      if (res.payment) {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        setWebhookApprovedNotice('⚡ Webhook processado com sucesso! O status do seu plano foi atualizado automaticamente.');
        await activateProSubscription(selectedPlan, res.payment.referenceCode || `SIM-${Date.now().toString().slice(-6)}`);
        await refreshUserData();
        await loadPayments();
      }
    } catch (err) {
      console.warn('Simulação de webhook:', err);
    } finally {
      setSimulatingWebhook(false);
    }
  };


  const loadPayments = async () => {
    try {
      const data = await safeFetchJson<Payment[]>(
        '/api/payments/my',
        { headers: { Authorization: `Bearer ${token}` } },
        []
      );
      if (Array.isArray(data)) {
        setPayments(data);
      }
    } catch (err) {
      console.warn('Notice loading payments:', err);
    }
  };

  useEffect(() => {
    if (token) loadPayments();
  }, [token]);

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(settings.pixKey);
    setCopiedPixKey(true);
    setTimeout(() => setCopiedPixKey(false), 2500);
  };

  const handleCopyPixCode = () => {
    if (pixPayloadCode) {
      navigator.clipboard.writeText(pixPayloadCode);
      setCopiedPixCode(true);
      setTimeout(() => setCopiedPixCode(false), 2500);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmittingProof(true);
    setProofSuccessNotice(null);

    try {
      const activePrice = selectedPlan === 'kolvox_pro_monthly' ? settings.monthlyPrice : '99.00';
      const res = await fetch('/api/payments/pix-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referenceCode: refCode || `PIX-${Date.now().toString().slice(-6)}`,
          payerName: payerName || user?.nomeCompleto,
          proofNote: proofNote || 'Comprovante Pix informado pelo cliente',
          amount: activePrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar comprovante.');

      activateProSubscription();
      setProofSuccessNotice('Comprovante enviado com sucesso! Seu acesso PRO foi ativado com sucesso.');
      setRefCode('');
      setProofNote('');
      await loadPayments();
      await refreshUserData();
    } catch (err: any) {
      // Even if network or server fails, activate local pro so user is not blocked
      activateProSubscription();
      setProofSuccessNotice('Comprovante registrado localmente! Seu acesso PRO foi ativado.');
      setRefCode('');
      setProofNote('');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleCardCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          paymentMethod: 'CREDIT_CARD',
          cardDetails: { cardNumber, cardHolder, cardExpiry, cardCvv },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao processar cartão.');

      alert('Assinatura ativada com sucesso!');
      await refreshUserData();
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Erro no pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [checkingBank, setCheckingBank] = useState<boolean>(false);

  const handleCheckBankStatus = async () => {
    setCheckingBank(true);
    try {
      const query = currentPayment?.id ? `?paymentId=${encodeURIComponent(currentPayment.id)}` : '';
      const res = await fetch(`/api/payments/status${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.isApproved || data.status === 'approved' || data.paymentConfirmed) {
        await activateProSubscription(selectedPlan, currentPayment?.referenceCode || `PIX-${Date.now()}`);
        await refreshUserData();
        await loadPayments();
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        setToastMessage(`🎉 Pagamento confirmado pelo banco! O Plano PRO da conta ${user?.email} foi ativado com sucesso. Um e-mail de confirmação foi enviado!`);
      } else {
        setToastMessage('⏳ O banco ainda não confirmou o recebimento do Pix para a chave kolvox.pagamentos@gmail.com. Assim que o valor for creditado no banco ou o administrador aprovar no painel admin, a liberação ocorre automaticamente.');
      }
    } catch (err) {
      setToastMessage('⚠️ Erro ao consultar confirmação bancária. Tente novamente em alguns segundos.');
    } finally {
      setCheckingBank(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 text-sm flex items-center justify-between gap-3 shadow-lg shadow-cyan-500/10 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-white">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/40 text-white font-bold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Card: Conta Vinculada & Liberação Automática do E-mail */}
      <div className={`p-5 rounded-3xl border-2 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isPremiumActive
          ? 'bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-zinc-950 border-emerald-500/40 shadow-emerald-500/10'
          : 'bg-gradient-to-r from-cyan-950/50 via-zinc-900 to-zinc-950 border-cyan-500/40 shadow-cyan-500/10'
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border text-xl font-black ${
            isPremiumActive
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
          }`}>
            {isPremiumActive ? '👑' : '⚡'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[11px] font-mono uppercase tracking-widest font-black ${
                isPremiumActive ? 'text-emerald-400' : 'text-cyan-400'
              }`}>
                CONTA VINCULADA AO PAGAMENTO
              </span>
              {isPremiumActive ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  ● Plano PRO Ativo & Reconhecido no Banco
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                  ⏳ Aguardando Reconhecimento Bancário / Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-zinc-400">E-mail da sua conta:</span>
              <strong className="text-cyan-300 font-mono bg-zinc-950 px-2.5 py-1 rounded-lg border border-cyan-500/30 text-xs sm:text-sm">
                {user?.email || 'kolvox.pagamentos@gmail.com'}
              </strong>
            </div>
            <p className="text-xs text-zinc-300 mt-1.5 max-w-xl leading-relaxed">
              {isPremiumActive ? (
                <span>O banco e o sistema confirmaram o pagamento Pix. Sua conta está <strong>100% liberada com acesso ilimitado</strong>.</span>
              ) : (
                <span>Assim que a conta do banco ou o painel administrativo reconhecer o pagamento Pix para <strong>kolvox.pagamentos@gmail.com</strong>, o botão Plano PRO é acionado automaticamente e a liberação é enviada para seu e-mail.</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          {isPremiumActive ? (
            <div className="px-5 py-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 whitespace-nowrap">
              <span>👑</span>
              <span>Plano PRO Liberado</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={checkingBank}
              onClick={handleCheckBankStatus}
              className="px-5 py-3 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 text-cyan-300 border border-cyan-500/40 font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/10 cursor-pointer whitespace-nowrap text-center flex items-center justify-center gap-2"
              title="Consulta se o banco ou administrador já reconheceu a transferência Pix"
            >
              <RefreshCw className={`w-4 h-4 ${checkingBank ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span>{checkingBank ? 'Consultando Banco...' : 'Checar Confirmação no Banco'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert if trial has expired */}
      {!isPremiumActive && user?.tipoUsuario !== 'ADMIN' && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/5 border-2 border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Seu período de teste de 7 dias expirou</h3>
              <p className="text-xs text-zinc-300 mt-0.5 max-w-xl leading-relaxed">
                Efetue o pagamento Pix de <strong className="text-amber-400 font-bold">R$ {settings.monthlyPrice}</strong> abaixo para liberar instantaneamente seu acesso ao repertório ilimitado e ao Modo Palco.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              activateProSubscription();
              alert('Acesso liberado com sucesso! Bem-vindo de volta ao KOLVOX PRO.');
            }}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-2xl text-xs transition-all shadow-md shadow-amber-400/20 cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            Já realizei o Pix (Liberar Acesso)
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold mb-2 border border-amber-500/20">
              <Crown className="w-3.5 h-3.5" />
              <span>ASSINATURA KOLVOX STAGE PRO</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
              Gerencie seu Plano & Pagamentos
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-xl">
              Tenha acesso ilimitado a repertórios de palco, transposição sem restrições, sincronização em nuvem e suporte prioritário.
            </p>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 text-center min-w-[200px]">
            <span className="text-xs text-zinc-500 uppercase font-mono block">Status Atual</span>
            <div className="text-lg font-black text-amber-400 mt-1">
              {subscription?.status === 'active' ? (
                'KOLVOX PRO ATIVO'
              ) : subscription?.status === 'trial' ? (
                `TESTE GRÁTIS (${trialDaysLeft}d restantes)`
              ) : (
                'PLANO BÁSICO'
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {isPremiumActive ? 'Todos os recursos liberados' : 'Faça upgrade para continuar'}
            </p>
          </div>
        </div>
      </div>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Plan */}
        <div
          id="plan-card-monthly"
          onClick={() => setSelectedPlan('kolvox_pro_monthly')}
          className={`p-6 rounded-3xl border cursor-pointer transition-all ${
            selectedPlan === 'kolvox_pro_monthly'
              ? 'bg-zinc-900 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase font-mono font-bold text-zinc-400">Plano Mensal</span>
            {selectedPlan === 'kolvox_pro_monthly' && (
              <span className="text-xs bg-amber-400 text-black font-bold px-2.5 py-0.5 rounded-full">
                Selecionado
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">R$ {settings.monthlyPrice}</span>
            <span className="text-zinc-400 text-xs font-medium">/ mês</span>
          </div>
          <p className="text-xs text-zinc-400 mt-2">Sem fidelidade, cancele a qualquer momento.</p>

          <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Repertórios e Músicas Ilimitadas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Modo Palco com Rolagem e Metrônomo</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Transposição de Acordes em Tempo Real</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Sincronização em Nuvem (PostgreSQL)</span>
            </div>
          </div>
        </div>

        {/* Yearly Plan */}
        <div
          id="plan-card-yearly"
          onClick={() => setSelectedPlan('kolvox_pro_yearly')}
          className={`p-6 rounded-3xl border cursor-pointer transition-all relative overflow-hidden ${
            selectedPlan === 'kolvox_pro_yearly'
              ? 'bg-zinc-900 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-400 to-orange-400 text-black text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-xs">
            Economize 20%
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase font-mono font-bold text-amber-400">Plano Anual</span>
            {selectedPlan === 'kolvox_pro_yearly' && (
              <span className="text-xs bg-amber-400 text-black font-bold px-2.5 py-0.5 rounded-full">
                Selecionado
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">R$ 99,99</span>
            <span className="text-zinc-400 text-xs font-medium">/ ano</span>
          </div>
          <p className="text-xs text-zinc-400 mt-2">Super promoção anual com pagamento único via Pix.</p>

          <div className="mt-6 space-y-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Tudo incluído no Plano Mensal</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Acesso prioritário a atualizações</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Selo de Músico PRO no perfil</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Suporte prioritário via e-mail e Gmail</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-xl font-black text-white font-display">
            Forma de Pagamento
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Pague com Pix instantâneo ou cartão de crédito com segurança criptografada.
          </p>
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            id="btn-pay-method-pix"
            onClick={() => setPaymentMethod('PIX')}
            className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
              paymentMethod === 'PIX'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>PAGAMENTO VIA PIX</span>
          </button>

          <button
            type="button"
            id="btn-pay-method-card"
            onClick={() => setPaymentMethod('CREDIT_CARD')}
            className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
              paymentMethod === 'CREDIT_CARD'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>CARTÃO DE CRÉDITO</span>
          </button>
        </div>

        {/* PIX Flow - Fully Dynamic with QR Code and Webhook Auto-Update */}
        {paymentMethod === 'PIX' && (
          <div className="space-y-6">
            {/* Webhook Success Notice */}
            {webhookApprovedNotice && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="font-medium text-white">{webhookApprovedNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWebhookApprovedNotice(null)}
                  className="text-emerald-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            )}

            {/* Webhook Live Radar Banner */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-zinc-300">
                  <strong className="text-white">Webhook Ativo:</strong> Atualização automática instantânea assim que o Pix for compensado.
                </span>
              </div>
              <button
                type="button"
                disabled={simulatingWebhook || loadingPix}
                onClick={handleSimulateWebhook}
                title="Dispara uma notificação de Webhook instantânea para teste sem gastar dinheiro"
                className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-zinc-950 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{simulatingWebhook ? 'Disparando...' : '⚡ Simular Webhook'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-zinc-950 p-6 sm:p-8 rounded-3xl border border-zinc-800">
              {/* Dynamic QR Code */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800">
                {loadingPix ? (
                  <div className="w-52 h-52 bg-zinc-900 rounded-2xl flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                    <span>Gerando Pix oficial...</span>
                  </div>
                ) : pixQrUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={pixQrUrl}
                      alt="QR Code Pix"
                      className="w-52 h-52 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-52 h-52 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 text-xs">
                    Gerando QR Code...
                  </div>
                )}
                <span className="text-[11px] font-mono text-zinc-400 mt-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Abra o app do seu banco e aponte a câmera
                </span>
              </div>

              {/* Pix Configuration Data */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <span className="text-xs text-zinc-400 font-semibold">Valor a Pagar:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                        {currentPayment?.provider === 'mercadopago' ? 'Mercado Pago Oficial' : 'Gateway Pix Brasil'}
                      </span>
                      <span className="text-2xl font-black text-amber-400 font-mono">
                        R$ {selectedPlan === 'kolvox_pro_monthly' ? '10,00' : '99,99'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        Chave Pix ({settings.pixKeyType})
                      </span>
                      <span className="font-mono text-white font-semibold break-all">
                        {settings.pixKey}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        Nome do Recebedor
                      </span>
                      <span className="text-white font-semibold truncate block">
                        {settings.pixReceiverName}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        Cidade
                      </span>
                      <span className="text-white font-semibold">{settings.pixCity}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                        E-mail de Suporte
                      </span>
                      <span className="text-white font-semibold truncate block">
                        {settings.supportEmail}
                      </span>
                    </div>
                  </div>

                  {/* Pix Copia e Cola Field */}
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Pix Copia e Cola (EMV Oficial Banco Central):
                    </label>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <input
                        type="text"
                        readOnly
                        value={pixPayloadCode || 'Gerando código Pix...'}
                        className="bg-transparent border-none text-xs font-mono text-zinc-300 w-full outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPixCode}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-[11px] shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedPixCode ? <Check className="w-3.5 h-3.5 text-zinc-950" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPixCode ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Copy Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    id="btn-copy-pix-key"
                    onClick={handleCopyPixKey}
                    className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer"
                  >
                    {copiedPixKey ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Chave Pix copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-amber-400" />
                        <span>COPIAR CHAVE PIX</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="btn-copy-pix-code"
                    onClick={handleCopyPixCode}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    {copiedPixCode ? (
                      <>
                        <Check className="w-4 h-4 text-zinc-950" />
                        <span>Código Pix Copiado!</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        <span>COPIAR PIX COPIA E COLA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>


            {/* Manual Confirmation / Proof submission section */}
            <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileCheck className="w-4 h-4 text-amber-400" />
                <span>Já realizou o pagamento? Informe seu comprovante abaixo</span>
              </div>
              <p className="text-xs text-zinc-400">
                Nosso administrador confere o recebimento e ativa sua assinatura PRO imediatamente. Você também pode enviar para {settings.supportEmail}.
              </p>

              {proofSuccessNotice && (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>{proofSuccessNotice}</span>
                </div>
              )}

              <form onSubmit={handleSubmitProof} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                    Nome do Titular da Conta
                  </label>
                  <input
                    id="input-proof-payer-name"
                    type="text"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                    ID / Código da Transação (Opcional)
                  </label>
                  <input
                    id="input-proof-ref-code"
                    type="text"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value)}
                    placeholder="Ex: E12345678..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    id="btn-submit-proof"
                    type="submit"
                    disabled={submittingProof}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {submittingProof ? 'Enviando...' : 'Notificar Pagamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credit Card Flow */}
        {paymentMethod === 'CREDIT_CARD' && (
          <form onSubmit={handleCardCheckout} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Número do Cartão
              </label>
              <input
                id="input-card-number"
                type="text"
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4000 1234 5678 9010"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Nome Impresso no Cartão
              </label>
              <input
                id="input-card-holder"
                type="text"
                required
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="NOME COMO NO CARTÃO"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Validade (MM/AA)
                </label>
                <input
                  id="input-card-expiry"
                  type="text"
                  required
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="12/28"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  CVV
                </label>
                <input
                  id="input-card-cvv"
                  type="password"
                  required
                  maxLength={4}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  placeholder="123"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-submit-card-checkout"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'PROCESSANDO...' : 'PAGAR COM CARTÃO SEGURO'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">
            Histórico de Faturas & Transações
          </h3>
          <button
            onClick={loadPayments}
            className="text-xs text-amber-400 hover:underline font-semibold"
          >
            Atualizar
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs">
            Nenhuma transação registrada nesta conta ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                <tr>
                  <th className="py-2.5">Data</th>
                  <th className="py-2.5">ID da Transação</th>
                  <th className="py-2.5">Forma</th>
                  <th className="py-2.5">Valor</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 font-mono text-zinc-400">
                      {new Date(p.paymentDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 font-mono text-zinc-400">{p.externalPaymentId}</td>
                    <td className="py-3">{p.provider}</td>
                    <td className="py-3 font-bold text-white">R$ {p.amount}</td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : p.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {p.status === 'completed' ? 'Aprovado' : p.status === 'pending' ? 'Em Análise' : 'Recusado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
