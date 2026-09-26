import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Radio, KeyRound } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: () => void;
  onBackToClient: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onBackToClient }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('koljoseph2020@gmail.com');
  const [senha, setSenha] = useState('28k28k28k');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, senha);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Credenciais de administrador incorretas.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail de administrador para recuperação.');
      return;
    }
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setForgotSent(true);
      setTimeout(() => setForgotSent(false), 5000);
    } catch {
      setError('Erro ao solicitar redefinição.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 sm:px-6 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-500/20 mb-4">
            <Shield className="w-7 h-7" />
          </div>

          <div className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">
            KOLVOX STAGE
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display mt-1">
            PAINEL ADMINISTRATIVO
          </h1>
          <p className="text-xs text-zinc-400 mt-2">
            Acesso exclusivo para administradores e equipe de operações.
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {forgotSent && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
              <span>Instruções de recuperação enviadas para o e-mail informado.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  id="admin-login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kolvox.com"
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-400 transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-zinc-300">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-purple-400 hover:underline font-semibold"
                >
                  ESQUECI MINHA SENHA
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  id="admin-login-password"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-400 transition-colors"
                />
              </div>
            </div>

            <button
              id="btn-admin-submit-login"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm shadow-lg shadow-purple-600/30 transition-all active:scale-98 flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
            >
              <span>{loading ? 'AUTENTICANDO...' : 'ENTRAR'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Fill Button */}
          <div className="mt-6 pt-4 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Administrador Geral:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('koljoseph2020@gmail.com');
                  setSenha('28k28k28k');
                }}
                className="text-purple-400 hover:text-purple-300 hover:underline font-mono text-[11px] bg-purple-950/40 border border-purple-800/40 px-2 py-1 rounded-lg"
              >
                Preencher koljoseph2020@gmail
              </button>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 flex justify-between items-center">
              <span>koljoseph2020@gmail.com</span>
              <span>Senha: 28k28k28k</span>
            </div>
          </div>
        </div>

        {/* Back to Client Area */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={onBackToClient}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            ← Voltar para a Área do Cliente
          </button>
        </div>
      </div>
    </div>
  );
};
