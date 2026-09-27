import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { KolvoxLogo } from './KolvoxLogo';
import bemVindoImg from '../assets/images/bem_vindo_cover_1789915445802.jpg';
import { generatePixPayload, generatePixQrDataUrl } from '../utils/pix';

interface AuthModalProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialMode?: 'login' | 'register' | 'reset' | 'plans';
  isModalOverlay?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  onClose,
  initialMode,
  isModalOverlay,
}) => {
  const { login, loginWithGoogle, loginAsGuest, register, resetPassword, activateProSubscription } = useAuth();

  const [activeTab, setActiveTab] = useState<'auth' | 'plans'>(
    initialMode === 'plans' ? 'plans' : 'auth'
  );
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(initialMode === 'register');
  const [isResetMode, setIsResetMode] = useState<boolean>(initialMode === 'reset');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Restore saved credentials if previously remembered
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kolvox_remembered_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.password) setPassword(parsed.password);
        setRememberMe(true);
      }
    } catch {
      // safe fallback
    }
  }, []);

  // Sync mode if initialMode prop changes
  useEffect(() => {
    if (initialMode === 'register') {
      setActiveTab('auth');
      setIsRegisterMode(true);
      setIsResetMode(false);
    } else if (initialMode === 'plans') {
      setActiveTab('plans');
      setIsRegisterMode(false);
      setIsResetMode(false);
    } else if (initialMode === 'reset') {
      setActiveTab('auth');
      setIsResetMode(true);
      setIsRegisterMode(false);
    } else if (initialMode === 'login') {
      setActiveTab('auth');
      setIsRegisterMode(false);
      setIsResetMode(false);
    }
  }, [initialMode]);

  // Plan selection and Pix
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [pixQrUrl, setPixQrUrl] = useState<string>('');
  const [pixPayload, setPixPayload] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pixKey = 'kolvox.pagamentos@gmail.com';

  // Generate real Pix QR Code and EMV payload on plan change
  useEffect(() => {
    const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';
    const payload = generatePixPayload({
      pixKey,
      receiverName: 'KOLVOX TECNOLOGIA LTDA',
      city: 'SAO PAULO',
      amount,
      referenceCode: `KVX${selectedPlan.toUpperCase()}`,
    });
    setPixPayload(payload);

    generatePixQrDataUrl(payload)
      .then((url) => setPixQrUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Pix:', err));
  }, [selectedPlan]);

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  const handleCopyPixPayload = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 3000);
  };

  const handleActivateProNow = async () => {
    setLoading(true);
    try {
      await activateProSubscription(selectedPlan === 'yearly' ? 'kolvox_pro_yearly' : 'kolvox_pro_monthly');
      setActivationSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch {
      setErrorMessage('Erro ao ativar assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!loginWithGoogle) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao autenticar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isResetMode) {
      if (!email || !email.includes('@')) {
        setErrorMessage('Informe um e-mail válido para redefinição.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setSuccessMessage('E-mail de recuperação enviado com sucesso.');
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao solicitar redefinição.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setErrorMessage('Por favor, informe seu nome ou nome artístico.');
        return;
      }
      if (!email || !email.includes('@')) {
        setErrorMessage('Informe um e-mail válido.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        await register(name.trim(), email.trim(), password);
        if (rememberMe) {
          try {
            localStorage.setItem('kolvox_remembered_auth', JSON.stringify({ email: email.trim(), password }));
          } catch {}
        } else {
          try {
            localStorage.removeItem('kolvox_remembered_auth');
          } catch {}
        }
        onSuccess?.();
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao criar conta. Tente outro e-mail.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Login Normal
    if (!email || !password) {
      setErrorMessage('Preencha seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      if (rememberMe) {
        try {
          localStorage.setItem('kolvox_remembered_auth', JSON.stringify({ email: email.trim(), password }));
        } catch {}
      } else {
        try {
          localStorage.removeItem('kolvox_remembered_auth');
        } catch {}
      }
      onSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <section id="loginScreen" className={`login-screen relative ${isModalOverlay ? 'w-full max-w-4xl p-0 my-auto shadow-2xl' : ''}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg border border-zinc-700 text-sm font-bold"
          title="Fechar janela de login"
        >
          ✕
        </button>
      )}
      <div className="login-card">
        {/* Visual da Esquerda com Imagem de Palco Cobrindo o Painel */}
        <div className="login-visual">
          <img
            src={bemVindoImg}
            alt="KOLVOX Palco Ao Vivo"
            className="login-visual-bg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/bem-vindo.jpg';
            }}
          />
          <div className="login-visual-overlay">
            <div className="login-visual-top">
              <KolvoxLogo size="xl" className="mb-2" />
              <p className="login-visual-slogan">Seu palco. Suas músicas. Sua voz.</p>
            </div>

            <div className="login-visual-features">
              <div className="login-feature-pill">
                <span>📖</span>
                <span>Letras</span>
              </div>
              <div className="login-feature-pill">
                <span>📋</span>
                <span>Setlists</span>
              </div>
              <div className="login-feature-pill">
                <span>🎙</span>
                <span>Gravações</span>
              </div>
              <div className="login-feature-pill">
                <span>⚡</span>
                <span>Modo Show</span>
              </div>
            </div>

            {/* Aviso de 7 dias grátis no painel lateral */}
            <div className="mt-auto pt-4 border-t border-white/10 text-left">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1">
                <span>⭐</span>
                <span>CONTA DE TESTE GRÁTIS</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Todas as novas contas possuem <strong>7 dias de acesso liberado</strong> para testar todas as funções. Após os 7 dias, o acesso continua mediante o plano de R$ 9,99/mês ou R$ 99,99/ano.
              </p>
            </div>
          </div>
        </div>

        {/* Formulário da Direita */}
        <div className="login-form">
          {activeTab === 'plans' ? (
            /* ==================================================== */
            /* ABA: PLANOS PAGOS & CHAVE PIX & QR CODE */
            /* ==================================================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <span className="small-label text-amber-400">PLANOS EXCLUSIVOS KOLVOX</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('auth')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                >
                  ← Voltar para o Login
                </button>
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Escolha seu Plano</h1>
                <p className="muted text-xs">
                  Conta de teste liberada por <strong>7 dias</strong>. Após os 7 dias, o acesso aos repertórios e modo show é mantido com o pagamento.
                </p>
              </div>

              {/* Seleção de Planos (R$ 9,99 mensais e R$ 99,99 anual) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Mensal */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('monthly')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    selectedPlan === 'monthly'
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Plano Mensal</div>
                  <div className="text-lg font-black text-white mt-0.5">R$ 9,99</div>
                  <div className="text-[10px] text-zinc-400">cobrança mensal</div>
                </button>

                {/* Anual */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan('yearly')}
                  className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                    selectedPlan === 'yearly'
                      ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="absolute -top-2 right-2 bg-emerald-500 text-zinc-950 font-black text-[9px] px-2 py-0.5 rounded-full">
                    MELHOR VALOR
                  </span>
                  <div className="text-[10px] uppercase font-bold text-amber-400">Plano Anual</div>
                  <div className="text-lg font-black text-white mt-0.5">R$ 99,99</div>
                  <div className="text-[10px] text-zinc-400">pagamento anual</div>
                </button>
              </div>

              {/* Seção Pix: Chave + QR Code */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span>⚡</span> Pagamento Instantâneo via Pix
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedPlan === 'monthly' ? 'R$ 9,99' : 'R$ 99,99'}
                  </span>
                </div>

                {/* QR Code Real */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
                  {pixQrUrl ? (
                    <img
                      src={pixQrUrl}
                      alt="QR Code Pix Kolvox"
                      className="w-28 h-28 rounded-lg bg-white p-1 shrink-0 shadow-md"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (!target.dataset.triedFallback) {
                          target.dataset.triedFallback = '1';
                          target.src = `https://quickchart.io/qr?size=320&text=${encodeURIComponent(pixPayload)}`;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-lg bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                      Gerando QR...
                    </div>
                  )}

                  <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
                    <div className="text-[11px] text-zinc-400">
                      Abra o app do seu banco e aponte a câmera para o QR Code acima.
                    </div>
                    <div className="text-[11px] text-zinc-300 font-semibold truncate">
                      Beneficiário: <span className="text-white">KOLVOX TECNOLOGIA</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 font-mono break-all">
                      Chave Pix: <strong className="text-amber-300">{pixKey}</strong>
                    </div>
                  </div>
                </div>

                {/* Botões de Cópia da Chave e Código Pix */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPixKey}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{copiedKey ? '✓' : '📋'}</span>
                    <span>{copiedKey ? 'Chave Pix Copiada!' : 'Copiar Chave Pix'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPixPayload}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{copiedPayload ? '✓' : '📱'}</span>
                    <span>{copiedPayload ? 'Código Copiado!' : 'Pix Copia e Cola'}</span>
                  </button>
                </div>
              </div>

              {/* Botão de Liberação de Acesso */}
              {activationSuccess ? (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs text-center font-bold">
                  ✓ Pagamento registrado! Acesso PRO liberado com sucesso.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleActivateProNow}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>{loading ? 'ATIVANDO ACESSO...' : 'Já realizei o Pix (Liberar Acesso Agora)'}</span>
                </button>
              )}

              <p className="text-center text-[11px] text-zinc-500">
                Dúvidas ou envio de comprovante: <strong className="text-zinc-400">{pixKey}</strong>
              </p>
            </div>
          ) : (
            /* ==================================================== */
            /* ABA: AUTENTICAÇÃO (LOGIN / CADASTRO) */
            /* ==================================================== */
            <div>
              <span className="small-label">
                {isResetMode
                  ? 'RECUPERAÇÃO DE ACESSO'
                  : isRegisterMode
                  ? 'NOVO VOCALISTA'
                  : 'BEM-VINDO DE VOLTA'}
              </span>

              <h1>
                {isResetMode
                  ? 'Redefinir senha'
                  : isRegisterMode
                  ? 'Crie sua conta'
                  : 'Entre na sua conta'}
              </h1>

              <p className="muted">
                {isResetMode
                  ? 'Digite seu e-mail para receber as instruções.'
                  : isRegisterMode
                  ? 'Crie sua conta e ganhe 7 dias de teste gratuito.'
                  : 'Prepare-se para o próximo show.'}
              </p>

              {/* Banner de 7 dias de teste gratuito */}
              <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span>🎁</span>
                  <span><strong>7 dias grátis</strong> na conta de teste!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="text-[11px] font-bold underline text-amber-400 hover:text-amber-200 cursor-pointer whitespace-nowrap"
                >
                  Ver Planos
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                  <span>⚠</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                  <span>✓</span>
                  <span>{successMessage}</span>
                </div>
              )}

              <form id="loginForm" onSubmit={handleSubmit} method="post" autoComplete="on">
                {isRegisterMode && (
                  <>
                    <label htmlFor="nameInput">Nome ou Nome Artístico</label>
                    <div className="input-group">
                      <span className="icon">👤</span>
                      <input
                        id="nameInput"
                        name="name"
                        autoComplete="name"
                        type="text"
                        placeholder="Ex: Rogerio Fernandes"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                <label htmlFor="emailInput">E-mail</label>
                <div className="input-group">
                  <span className="icon">✉</span>
                  <input
                    id="emailInput"
                    name="username"
                    autoComplete="username"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {!isResetMode && (
                  <>
                    <label htmlFor="passwordInput">Senha</label>
                    <div className="input-group">
                      <span className="icon">🔒</span>
                      <input
                        id="passwordInput"
                        name="password"
                        autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? '👁' : '◉'}
                      </button>
                    </div>
                  </>
                )}

                {!isResetMode && (
                  <div className="login-options">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Lembrar de mim</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setIsRegisterMode(false);
                        setErrorMessage(null);
                      }}
                      className="text-[11px] text-blue-400 hover:underline bg-transparent cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="primary-button login-button mt-2"
                >
                  {loading
                    ? 'PROCESSANDO...'
                    : isResetMode
                    ? 'ENVIAR INSTRUÇÕES'
                    : isRegisterMode
                    ? 'CRIAR CONTA & ENTRAR'
                    : 'ENTRAR'}
                </button>

                {!isResetMode && loginWithGoogle && (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full mt-2 py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-95 cursor-pointer"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Entrar com Conta Google</span>
                  </button>
                )}

                {!isResetMode && (
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await loginAsGuest();
                        onSuccess?.();
                      } catch (err: any) {
                        setErrorMessage(err.message || 'Erro ao entrar como visitante.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full mt-3 py-2.5 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>⚡</span>
                    Entrar Instantâneo (Modo Demonstração)
                  </button>
                )}

                <div className="separator">
                  <span>ou</span>
                </div>

                {isResetMode ? (
                  <p className="register">
                    Lembrou da senha?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(false);
                        setIsRegisterMode(false);
                        setErrorMessage(null);
                      }}
                      className="text-blue-400 font-bold hover:underline bg-transparent cursor-pointer"
                    >
                      Voltar ao Login
                    </button>
                  </p>
                ) : isRegisterMode ? (
                  <p className="register">
                    Já possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(false);
                        setIsResetMode(false);
                        setErrorMessage(null);
                      }}
                      className="text-blue-400 font-bold hover:underline bg-transparent cursor-pointer"
                    >
                      Faça login
                    </button>
                  </p>
                ) : (
                  <p className="register">
                    Não tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisterMode(true);
                        setIsResetMode(false);
                        setErrorMessage(null);
                      }}
                      className="text-blue-400 font-bold hover:underline bg-transparent cursor-pointer"
                    >
                      Cadastre-se grátis
                    </button>
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );

  if (isModalOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
        {content}
      </div>
    );
  }

  return content;
};
