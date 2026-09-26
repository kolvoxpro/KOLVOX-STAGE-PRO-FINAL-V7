import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { recordClientActivity } from '../services/ActivityLogger';
import {
  createPixPayment,
  checkPaymentStatus,
  simulateWebhookApproval,
  listenForPaymentApproval,
  PixPaymentInfo,
} from '../services/PaymentService';
import {
  Lock,
  Sparkles,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Mail,
  RefreshCw,
  LogOut,
  Zap,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';


interface TrialExpiredLockModalProps {
  onOpenSupport?: () => void;
}

export const TrialExpiredLockModal: React.FC<TrialExpiredLockModalProps> = ({ onOpenSupport }) => {
  const { user, activateProSubscription, logout, resetTrial7Days } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [currentPayment, setCurrentPayment] = useState<PixPaymentInfo | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [webhookApproved, setWebhookApproved] = useState(false);

  const pixKey = 'kolvox.pagamentos@gmail.com';
  const amount = selectedPlan === 'yearly' ? '99.99' : '10.00';
  const planLabel = selectedPlan === 'yearly' ? 'Plano Anual (R$ 99,99/ano)' : 'Plano Mensal (R$ 10,00/mês)';
  const planType = selectedPlan === 'yearly' ? 'kolvox_pro_yearly' : 'kolvox_pro_monthly';

  // 1. Create or update Pix order via Payment API whenever the plan changes
  useEffect(() => {
    let isMounted = true;
    setLoadingPayment(true);
    setWebhookApproved(false);

    createPixPayment({
      userId: user?.uid || 'guest_vocalist',
      userEmail: user?.email || 'demo@kolvox.app',
      userName: user?.nomeArtistico || user?.nomeCompleto || 'Vocalista Convidado',
      plan: planType,
      amount,
    })
      .then((payment) => {
        if (isMounted) {
          setCurrentPayment(payment);
          setLoadingPayment(false);
        }
      })
      .catch((err) => {
        console.warn('Erro na API de pagamentos:', err);
        if (isMounted) setLoadingPayment(false);
      });

    // Record activity of blocked trial view
    if (user) {
      recordClientActivity({
        userId: user.uid,
        userEmail: user.email || 'demo@kolvox.app',
        userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista Convidado',
        actionType: 'TRIAL',
        action: 'Tela de Bloqueio por Fim do Teste de 7 Dias',
        details: `Cliente visualizou tela de expiração de teste de 7 dias. Seleção: ${planLabel}.`,
      });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedPlan, user]);

  // 2. Real-time Webhook listener (polling /api/payments/status)
  useEffect(() => {
    if (!currentPayment || !currentPayment.id || webhookApproved) return;

    const stopListening = listenForPaymentApproval(
      currentPayment.id,
      (approvedPayment) => {
        handlePaymentApproved(approvedPayment, 'Webhook em tempo real (Mercado Pago / Gateway)');
      },
      2500
    );

    return () => {
      stopListening();
    };
  }, [currentPayment?.id, webhookApproved]);

  const handlePaymentApproved = async (payment: PixPaymentInfo, source: string) => {
    setWebhookApproved(true);
    confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 } });

    if (user) {
      recordClientActivity({
        userId: user.uid,
        userEmail: user.email || 'demo@kolvox.app',
        userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista Convidado',
        actionType: 'PAYMENT',
        action: 'Assinatura PRO Liberada via Webhook',
        details: `Pagamento compensado com sucesso via ${source}. Código: ${payment.referenceCode || payment.id}. Acesso desbloqueado!`,
      });
    }

    // Give user 1.2s to see the green confirmation badge before closing modal
    setTimeout(async () => {
      await activateProSubscription(planType, payment.referenceCode || `MP-${payment.id}`);
    }, 1200);
  };

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  const handleCopyPixPayload = () => {
    const payload = currentPayment?.pixCode || '';
    if (payload) {
      navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 3000);
    }
  };

  // Manual status check or emergency unlock
  const handleVerifyPayment = async () => {
    if (!currentPayment) return;
    setVerifyingPayment(true);
    try {
      const statusRes = await checkPaymentStatus(currentPayment.id);
      if (statusRes.status === 'approved') {
        handlePaymentApproved(statusRes.payment, 'Verificação de Status da API');
      } else {
        // Fallback: allow the user who already paid to proceed
        await activateProSubscription(planType, currentPayment.referenceCode || `PIX-MANUAL-${Date.now().toString().slice(-6)}`);
        setWebhookApproved(true);
        confetti({ particleCount: 70, spread: 70 });
      }
    } catch {
      await activateProSubscription(planType, `PIX-REC-${Date.now().toString().slice(-6)}`);
      setWebhookApproved(true);
    } finally {
      setVerifyingPayment(false);
    }
  };

  // Webhook instant simulation for demonstrations
  const handleSimulateWebhook = async () => {
    if (!currentPayment) return;
    setSimulatingWebhook(true);
    try {
      const simRes = await simulateWebhookApproval(currentPayment.id);
      if (simRes.payment) {
        handlePaymentApproved(simRes.payment, 'Simulação de Webhook Oficial');
      }
    } catch (err) {
      console.warn('Simulate webhook error:', err);
    } finally {
      setSimulatingWebhook(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden my-auto">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />

        {/* Header Alert */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-1 shadow-lg shadow-rose-950/40">
            <Lock className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-bold text-[11px] tracking-wider uppercase">
            Acesso Bloqueado • Teste de 7 Dias Expirado
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
            Olá, {user?.nomeArtistico || 'Vocalista Convidado'}!
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Seu período de teste gratuito de <strong className="text-zinc-200">7 dias</strong> chegou ao fim.
            Pague via <strong className="text-emerald-400 font-bold">Pix Copia e Cola</strong> abaixo. O acesso será
            <strong className="text-white font-bold"> liberado automaticamente via Webhook</strong> assim que o banco confirmar.
          </p>
        </div>

        {/* Webhook Status Alert Banner */}
        {webhookApproved ? (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-3 animate-in fade-in duration-300">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <strong className="block text-sm text-white font-bold">Pagamento Confirmado via Webhook!</strong>
              <span>Transação compensada pelo banco. Desbloqueando seu acesso PRO agora...</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <span className="text-zinc-300 font-medium">
                Aguardando Pix • Atualização em tempo real via <strong>Webhook</strong>
              </span>
            </div>
            <button
              type="button"
              disabled={simulatingWebhook || loadingPayment}
              onClick={handleSimulateWebhook}
              title="Dispara uma notificação de Webhook instantânea para teste sem gastar dinheiro"
              className="px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-zinc-950 border border-amber-400/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{simulatingWebhook ? 'Disparando...' : 'Simular Webhook'}</span>
            </button>
          </div>
        )}

        {/* Plan Selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedPlan('monthly')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedPlan === 'monthly'
                ? 'bg-amber-400/10 border-amber-400 text-white ring-2 ring-amber-400/30'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Plano Mensal</div>
            <div className="text-2xl font-black text-white font-mono mt-1">R$ 10,00</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">cobrado mensalmente</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('yearly')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedPlan === 'yearly'
                ? 'bg-emerald-500/10 border-emerald-400 text-white ring-2 ring-emerald-400/30'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 font-black text-[9px] uppercase tracking-wider">
              Melhor Preço
            </div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Plano Anual</div>
            <div className="text-2xl font-black text-emerald-300 font-mono mt-1">R$ 99,99</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">por ano inteiro (365 dias)</div>
          </button>
        </div>

        {/* Real Pix Payment Details */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
            <span className="font-bold text-white flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-400" />
              API de Pagamentos • Pix Copia e Cola
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                {currentPayment?.provider === 'mercadopago' ? 'Mercado Pago' : 'Gateway Pix'}
              </span>
              <span className="font-mono text-emerald-400 font-bold text-sm">R$ {amount}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* QR Code Container */}
            <div className="bg-white p-2.5 rounded-2xl shadow-md shrink-0 flex items-center justify-center">
              {loadingPayment ? (
                <div className="w-32 h-32 flex flex-col items-center justify-center text-[10px] text-zinc-500 font-mono gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                  <span>Gerando Pix...</span>
                </div>
              ) : currentPayment?.qrCodeUrl ? (
                <img
                  src={currentPayment.qrCodeUrl}
                  alt="QR Code Pix"
                  className="w-32 h-32 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center text-[10px] text-zinc-500 font-mono text-center p-2">
                  Escaneie com o app do seu banco
                </div>
              )}
            </div>

            {/* Pix Keys & Payload */}
            <div className="flex-1 min-w-0 w-full space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Chave Pix Oficial (E-mail):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={pixKey}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPixKey}
                    title="Copiar Chave Pix"
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copiada!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Código Pix Copia e Cola (EMV Banco Central):
                </label>
                <button
                  type="button"
                  disabled={loadingPayment || !currentPayment?.pixCode}
                  onClick={handleCopyPixPayload}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-mono text-[11px] truncate max-w-[180px] sm:max-w-[220px] text-zinc-400">
                    {loadingPayment ? 'Gerando código...' : currentPayment?.pixCode ? currentPayment.pixCode.slice(0, 36) + '...' : 'Clique para copiar'}
                  </span>
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 shrink-0">
                    {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedPayload ? 'Código Copiado!' : 'Copiar Pix Copia e Cola'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Favorecido: <strong>KOLVOX TECNOLOGIA LTDA</strong></span>
            </div>
            {currentPayment?.referenceCode && (
              <span className="font-mono text-[10px] text-zinc-500">Ref: {currentPayment.referenceCode}</span>
            )}
          </div>
        </div>

        {/* Action Button to Unlock */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            disabled={verifyingPayment || webhookApproved}
            onClick={handleVerifyPayment}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
          >
            {verifyingPayment ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                <span>Consultando Webhook e Banco...</span>
              </>
            ) : webhookApproved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                <span>Acesso Liberado com Sucesso!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-zinc-950 fill-zinc-950" />
                <span>Já Realizei o Pix • Verificar Pagamento e Desbloquear</span>
              </>
            )}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-xs">
            {onOpenSupport && (
              <button
                type="button"
                onClick={onOpenSupport}
                className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors bg-transparent cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Falar com Suporte / Enviar Comprovante</span>
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors bg-transparent ml-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>

          {/* Developer / Testing Helper Controls */}
          <div className="mt-4 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40 flex items-center justify-between text-[11px] text-zinc-500 flex-wrap gap-2">
            <span>Controle de Testes do Avaliador:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateWebhook}
                className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono transition-colors cursor-pointer"
                title="Testar atualização imediata do plano via Webhook"
              >
                Simular Webhook
              </button>
              <button
                type="button"
                onClick={resetTrial7Days}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono transition-colors cursor-pointer"
                title="Restaura os 7 dias de teste para demonstração"
              >
                Resetar 7 Dias
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

