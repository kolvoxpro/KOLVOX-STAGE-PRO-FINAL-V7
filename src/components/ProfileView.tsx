import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { User as UserIcon, Mail, Phone, MapPin, Sparkles, Shield, Crown, CheckCircle2, Save } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { user, subscription, trialDaysLeft, isPremiumActive, token, refreshUserData } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nomeCompleto, setNomeCompleto] = useState(user?.nomeCompleto || '');
  const [nomeArtistico, setNomeArtistico] = useState(user?.nomeArtistico || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');
  const [cidade, setCidade] = useState(user?.cidade || '');
  const [estado, setEstado] = useState(user?.estado || 'SP');
  const [savedMsg, setSavedMsg] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nomeCompleto,
          nomeArtistico,
          telefone,
          cidade,
          estado,
        }),
      });

      if (res.ok) {
        setSavedMsg(true);
        setEditing(false);
        await refreshUserData();
        setTimeout(() => setSavedMsg(false), 2500);
      }
    } catch (err) {
      alert('Erro ao atualizar perfil.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Profile Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-black text-4xl shadow-xl shadow-amber-500/20">
            {user?.nomeArtistico?.charAt(0) || user?.nomeCompleto?.charAt(0) || 'M'}
          </div>

          <div className="text-center sm:text-left space-y-1 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white font-display">
                {user?.nomeArtistico || user?.nomeCompleto}
              </h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                {isPremiumActive ? 'ARTISTA PRO' : 'CONTA BÁSICA'}
              </span>
              {user?.tipoUsuario === 'ADMIN' && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/30 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" />
                  ADMINISTRADOR
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400">{user?.email}</p>
            <p className="text-xs text-zinc-500">
              {user?.cidade || 'São Paulo'} - {user?.estado || 'SP'} • Membro desde {new Date(user?.createdAt || Date.now()).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-colors border border-zinc-700"
          >
            {editing ? 'Cancelar Edição' : 'Editar Dados'}
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Perfil atualizado com sucesso no banco de dados!</span>
        </div>
      )}

      {/* Profile Details or Edit Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8">
        <h3 className="text-base font-bold text-white mb-6">Informações Cadastrais</h3>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome Artístico</label>
                <input
                  type="text"
                  value={nomeArtistico}
                  onChange={(e) => setNomeArtistico(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Telefone</label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Cidade</label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                >
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <span className="text-zinc-500 block">Nome Completo</span>
              <span className="text-white font-semibold mt-0.5 block">{user?.nomeCompleto}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Nome Artístico / Banda</span>
              <span className="text-white font-semibold mt-0.5 block">{user?.nomeArtistico || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">E-mail Cadastrado</span>
              <span className="text-white font-mono mt-0.5 block">{user?.email}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Telefone / WhatsApp</span>
              <span className="text-white font-mono mt-0.5 block">{user?.telefone || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Cidade e Estado</span>
              <span className="text-white font-semibold mt-0.5 block">{user?.cidade || 'São Paulo'} - {user?.estado || 'SP'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Plano Ativo</span>
              <span className="text-amber-400 font-bold mt-0.5 block">
                {isPremiumActive ? `KOLVOX PRO (${trialDaysLeft} dias restantes)` : 'Gratuito'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
