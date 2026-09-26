import React from 'react';
import { Mic2, Music, Users, BookOpen, Music2, Eye, ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Flame, Radio, Shield } from 'lucide-react';

interface LandingPageProps {
  onOpenAccess?: (mode?: 'choose' | 'login' | 'register' | 'pro') => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenProPlans: () => void;
  onQuickDemoLogin: (role: 'USER' | 'ADMIN') => void;
  onOpenAdminLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAccess,
  onOpenLogin,
  onOpenRegister,
  onOpenProPlans,
  onQuickDemoLogin,
  onOpenAdminLogin,
}) => {
  const showDevShortcuts = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).has('demo') ||
    new URLSearchParams(window.location.search).has('test') ||
    new URLSearchParams(window.location.search).has('dev')
  );

  const handleAccess = (mode: 'choose' | 'login' | 'register' | 'pro' = 'choose') => {
    if (onOpenAccess) {
      onOpenAccess(mode);
    } else if (mode === 'login') {
      onOpenLogin();
    } else if (mode === 'pro') {
      onOpenProPlans();
    } else {
      onOpenRegister();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-zinc-950 text-xs font-bold py-2.5 px-4 text-center flex flex-wrap items-center justify-center gap-3 shadow-sm">
        <span className="flex items-center gap-1.5 font-extrabold tracking-wide">
          <Sparkles className="w-4 h-4 shrink-0 fill-zinc-950" />
          TESTE GRÁTIS DE 7 DIAS LIBERADO PARA TODOS OS ARTISTAS
        </span>
        {showDevShortcuts && (
          <>
            <span className="hidden sm:inline text-zinc-900/60">•</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-900 font-semibold">Acesso teste:</span>
              <button
                id="btn-quick-artist"
                onClick={() => onQuickDemoLogin('USER')}
                className="bg-black/20 hover:bg-black/40 text-black px-2.5 py-0.5 rounded-full text-xs font-bold transition-all"
              >
                Músico Demo
              </button>
              <button
                id="btn-quick-admin"
                onClick={() => onQuickDemoLogin('ADMIN')}
                className="bg-black/20 hover:bg-black/40 text-black px-2.5 py-0.5 rounded-full text-xs font-bold transition-all"
              >
                Painel Admin
              </button>
            </div>
          </>
        )}
      </div>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 sm:w-[600px] h-96 sm:h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-amber-400 text-xs font-semibold mb-6">
            <Flame className="w-4 h-4" />
            <span>Criado para shows, bares, festivais, igrejas e eventos acústicos</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white font-display uppercase leading-tight">
            KOLVOX <span className="text-amber-400">STAGE</span>
          </h1>

          <p className="mt-6 text-xl sm:text-2xl md:text-3xl font-medium text-zinc-300 max-w-3xl mx-auto">
            "Seu repertório. Sua música. Seu palco."
          </p>

          <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            A plataforma definitiva para músicos, vocalistas e bandas organizarem repertórios com cifras, letras, transposição em tempo real e modo palco com rolagem automática inteligente.
          </p>

          {/* Single Primary Action Button with Options */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3">
            <button
              id="btn-hero-access"
              onClick={() => handleAccess('choose')}
              className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-black text-lg shadow-xl shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 fill-zinc-950" />
              <span>ACESSAR O KOLVOX STAGE</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400 font-medium">
              <span>Opções:</span>
              <button
                type="button"
                id="link-opt-register"
                onClick={() => handleAccess('register')}
                className="text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Criar Conta (7 dias grátis)
              </button>
              <span>•</span>
              <button
                type="button"
                id="link-opt-login"
                onClick={() => handleAccess('login')}
                className="text-zinc-200 font-bold hover:underline cursor-pointer"
              >
                Logar
              </button>
              <span>•</span>
              <button
                type="button"
                id="link-opt-pro"
                onClick={() => handleAccess('pro')}
                className="text-amber-300 font-bold hover:underline cursor-pointer"
              >
                Comprar Plano PRO
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 7 dias de teste gratuito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sem cartão para começar
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cancelamento a qualquer momento
            </span>
          </div>
        </div>
      </section>

      {/* 6 Requested Highlight Badges / Cards */}
      <section className="py-12 border-y border-zinc-800/80 bg-zinc-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs uppercase font-mono tracking-widest text-amber-400 font-bold">
              Estrutura Projetada para a Rotina da Música ao Vivo
            </h2>
            <p className="text-2xl font-extrabold text-white mt-2">
              Desenvolvido por quem entende o calor do palco
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Para vocalistas */}
            <div id="card-vocalistas" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Mic2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">🎤 Para vocalistas</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Letras com tipografia ampliada, contraste máximo para palco e rolagem suave sem usar as mãos.
              </p>
            </div>

            {/* 2. Para músicos */}
            <div id="card-musicos" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">🎸 Para músicos</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Transposição instantânea de tom, ajuste de capotraste e dicionário interativo de acordes.
              </p>
            </div>

            {/* 3. Para bandas */}
            <div id="card-bandas" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">🎵 Para bandas</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Organização de setlists por blocos de apresentação, tempo estimado e transições rápidas.
              </p>
            </div>

            {/* 4. Letras */}
            <div id="card-letras" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">📖 Letras</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Visualização limpa, sem anúncios intrusivos, com opção de ocultar cifras durante a cantoria.
              </p>
            </div>

            {/* 5. Cifras */}
            <div id="card-cifras" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Music2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">🎼 Cifras</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Alinhamento preciso sobre cada verso, detecção automática de acordes e gráficos de braço de violão.
              </p>
            </div>

            {/* 6. Modo palco */}
            <div id="card-modo-palco" className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 text-center flex flex-col items-center hover:border-amber-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                <Eye className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">🎤 Modo palco</h3>
              <p className="text-xs text-zinc-400 mt-2">
                Modo tela cheia, alto contraste, metrônomo visual em BPM e controle de velocidade por pedal ou toque.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Walkthrough Showcase */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
              TECNOLOGIA DE PONTA
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 leading-tight">
              Projetado para Computador, Tablet, Android e iPhone
            </h2>
            <p className="text-zinc-300 mt-4 leading-relaxed">
              O KOLVOX STAGE adapta sua interface com perfeição a qualquer tela que você leve para o palco. No suporte do microfone, no tablet em cima do amplificador ou no celular no bolso.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100">Transposição inteligente de acordes</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Mude o tom da música (+1, -1 semitom) para se adequar à extensão vocal do intérprete na hora.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100">Conformidade e Respeito aos Direitos Autorais</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Módulo MusicSearchProvider preparado para integração oficial sem scraping predatório, com links para fontes originais quando aplicável.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100">Banco de Dados PostgreSQL em Produção</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Arquitetura escalável no Cloud SQL com schemas para usuários, músicas, repertórios, assinaturas e pagamentos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Mock Preview Box */}
          <div className="bg-zinc-900/80 border border-zinc-700/80 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                <span className="text-xs font-mono text-zinc-400 ml-2">MODO PALCO • TEMPO REAL</span>
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-md font-mono font-bold">
                120 BPM • Tom: G
              </span>
            </div>

            <div className="bg-black rounded-2xl p-6 font-mono text-sm space-y-4 border border-zinc-800">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">[Intro]</div>
              <div className="text-amber-400 font-bold text-lg">G    D/F#    Em    C    D</div>
              <div className="text-zinc-200 text-base leading-relaxed">
                Não quero lhe falar, meu grande amor...<br />
                <span className="text-amber-400 font-bold">G                     D/F#</span><br />
                Das coisas que aprendi nos discos<br />
                <span className="text-amber-400 font-bold">Em                    C</span><br />
                Quero lhe contar como eu vivi!
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
              <span>Velocidade de rolagem: <strong>22 px/s</strong></span>
              <span>Repertório: <strong>Show Acústico Sexta</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800/80 py-8 bg-zinc-950 text-center text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-zinc-200">KOLVOX STAGE</span> — Seu repertório. Sua música. Seu palco.
          </div>
          <div className="flex items-center gap-4 text-zinc-500 text-xs">
            <span>© {new Date().getFullYear()} KOLVOX STAGE. Todos os direitos reservados.</span>
            {showDevShortcuts && onOpenAdminLogin && (
              <button
                id="btn-footer-admin-access"
                onClick={onOpenAdminLogin}
                className="text-zinc-600 hover:text-purple-400 transition-colors flex items-center gap-1 font-mono text-[11px] underline"
              >
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
