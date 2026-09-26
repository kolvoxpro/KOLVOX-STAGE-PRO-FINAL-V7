import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Song, Playlist } from '../types/index.ts';
import {
  Music,
  FolderHeart,
  Star,
  Search,
  Eye,
  Guitar,
  CreditCard,
  Plus,
  Play,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  HelpCircle,
  Mail,
} from 'lucide-react';

interface DashboardProps {
  onSelectView: (view: string) => void;
  onOpenSongInStage: (song: Song) => void;
  onOpenSongInGuitar: (song: Song) => void;
  onOpenAddModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectView,
  onOpenSongInStage,
  onOpenSongInGuitar,
  onOpenAddModal,
}) => {
  const { user, trialDaysLeft, isPremiumActive, token } = useAuth();
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch user songs
        const songsRes = await fetch('/api/songs', { credentials: 'include', headers });
        if (songsRes.ok && songsRes.headers.get('content-type')?.includes('application/json')) {
          const songsData = await songsRes.json();
          if (Array.isArray(songsData)) {
            setRecentSongs(songsData.slice(0, 5));
          }
        }

        // Fetch playlists
        const plRes = await fetch('/api/playlists', { credentials: 'include', headers });
        if (plRes.ok && plRes.headers.get('content-type')?.includes('application/json')) {
          const plData = await plRes.json();
          if (Array.isArray(plData)) {
            setPlaylists(plData);
          }
        }

        // Fetch favorites count
        const favRes = await fetch('/api/favorites', { credentials: 'include', headers });
        if (favRes.ok && favRes.headers.get('content-type')?.includes('application/json')) {
          const favData = await favRes.json();
          if (Array.isArray(favData)) {
            setFavoritesCount(favData.length);
          }
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [token]);

  // The 7 requested interactive cards
  const dashboardCards = [
    {
      id: 'my-songs',
      title: 'Minhas músicas',
      subtitle: `${recentSongs.length} cadastradas no acervo`,
      icon: Music,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
      actionText: 'Acessar biblioteca',
      view: 'my-songs',
    },
    {
      id: 'playlists',
      title: 'Meus repertórios',
      subtitle: `${playlists.length} setlists organizadas`,
      icon: FolderHeart,
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
      actionText: 'Gerenciar shows',
      view: 'playlists',
    },
    {
      id: 'favorites',
      title: 'Favoritas',
      subtitle: `${favoritesCount} músicas marcadas com estrela`,
      icon: Star,
      color: 'from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/30',
      actionText: 'Ver favoritas',
      view: 'favorites',
    },
    {
      id: 'search',
      title: 'Pesquisar',
      subtitle: 'Catálogo de letras & cifras verificadas',
      icon: Search,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
      actionText: 'Buscar músicas',
      view: 'search',
    },
    {
      id: 'stage',
      title: 'Modo palco',
      subtitle: 'Rolagem automática e tela cheia',
      icon: Eye,
      color: 'from-rose-500/20 to-red-500/20 text-rose-400 border-rose-500/30',
      actionText: 'Abrir modo palco',
      view: 'stage',
    },
    {
      id: 'guitar',
      title: 'Modo violão',
      subtitle: 'Transposição de tons e acordes',
      icon: Guitar,
      color: 'from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30',
      actionText: 'Visualizar cifras',
      view: 'guitar',
    },
    {
      id: 'subscription',
      title: 'Minha assinatura',
      subtitle: isPremiumActive ? `Plano PRO (${trialDaysLeft} dias restantes)` : 'Assinatura pendente',
      icon: CreditCard,
      color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
      actionText: 'Ver detalhes',
      view: 'subscription',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Greeting Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold mb-3 border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Painel do Artista • KOLVOX STAGE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
              Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">{user?.nomeArtistico || user?.nomeCompleto || 'Músico'}</span>
            </h1>

            <p className="text-sm text-zinc-400 mt-2 max-w-xl">
              Seu repertório está sincronizado. Escolha uma setlist para começar seu show ou pesquise novas músicas para ensaiar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-dash-add-music"
              onClick={onOpenAddModal}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold border border-zinc-700 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Cadastrar Música</span>
            </button>

            {recentSongs.length > 0 && (
              <button
                id="btn-dash-start-stage"
                onClick={() => onOpenSongInStage(recentSongs[0])}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>INICIAR MODO PALCO</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick status bar */}
        <div className="mt-6 pt-6 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block">Status da Conta</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {user?.status === 'ativo' ? 'Ativa & Sincronizada' : 'Pendente'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block">Assinatura Atual</span>
            <span className="font-bold text-amber-400 mt-0.5 block">
              {isPremiumActive ? `Teste PRO (${trialDaysLeft} dias restantes)` : 'Plano Gratuito'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block">Cidade / Estado</span>
            <span className="font-bold text-zinc-300 mt-0.5 block">
              {user?.cidade || 'São Paulo'} - {user?.estado || 'SP'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block">Banco de Dados</span>
            <span className="font-bold text-zinc-300 mt-0.5 block">
              Cloud SQL (PostgreSQL)
            </span>
          </div>
        </div>
      </div>

      {/* 7 Requested Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 font-mono">
            Módulos de Apresentação & Repertório
          </h2>
          <span className="text-xs text-zinc-500">7 ferramentas integradas</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dashboardCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                id={`card-dash-${card.id}`}
                onClick={() => onSelectView(card.view)}
                className={`bg-zinc-900/80 border rounded-2xl p-5 cursor-pointer hover:border-amber-400/50 hover:bg-zinc-900 transition-all duration-200 flex flex-col justify-between group shadow-sm ${card.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-950/80 flex items-center justify-center border border-zinc-800 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {card.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-semibold text-zinc-300 group-hover:text-white">
                  <span>{card.actionText}</span>
                  <span className="text-amber-400">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Songs & Active Playlists Dual Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Songs List (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white">Músicas em Destaque no Acervo</h3>
            </div>
            <button
              onClick={() => onSelectView('my-songs')}
              className="text-xs text-amber-400 hover:underline font-semibold"
            >
              Ver todas ({recentSongs.length})
            </button>
          </div>

          {recentSongs.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              Nenhuma música encontrada no acervo. Use o botão pesquisar ou cadastrar música.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentSongs.map((song) => (
                <div
                  key={song.id}
                  id={`recent-song-${song.id}`}
                  className="bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-3.5 flex items-center justify-between transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-zinc-100 truncate">{song.title}</h4>
                      {song.key && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                          Tom {song.key}
                        </span>
                      )}
                      {song.capo && song.capo > 0 ? (
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                          Capo {song.capo}ª
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {song.artist} • {song.genre || 'Variado'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id={`btn-play-stage-${song.id}`}
                      onClick={() => onOpenSongInStage(song)}
                      title="Abrir no Modo Palco"
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-zinc-300 text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Palco</span>
                    </button>
                    <button
                      id={`btn-play-guitar-${song.id}`}
                      onClick={() => onOpenSongInGuitar(song)}
                      title="Abrir no Modo Violão"
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Guitar className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Cifras</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Repertoires Side Card (1 col) */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderHeart className="w-4 h-4 text-blue-400" />
                <h3 className="text-base font-bold text-white">Repertórios Ativos</h3>
              </div>
              <button
                onClick={() => onSelectView('playlists')}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                Gerenciar
              </button>
            </div>

            {playlists.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Nenhum repertório criado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {playlists.slice(0, 3).map((pl) => (
                  <div
                    key={pl.id}
                    id={`pl-item-${pl.id}`}
                    onClick={() => onSelectView('playlists')}
                    className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl hover:border-blue-500/40 cursor-pointer transition-colors"
                  >
                    <h4 className="font-bold text-xs text-zinc-200 truncate">{pl.name}</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                      {pl.description || 'Setlist pronta para apresentação'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{pl.songCount || 0} músicas</span>
                      <span className="text-blue-400 font-semibold">Abrir →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <button
              onClick={() => onSelectView('playlists')}
              className="w-full py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30 transition-colors text-center"
            >
              + Criar Novo Repertório de Show
            </button>
          </div>
        </div>
      </div>

      {/* Support & Help Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Precisa de ajuda ou tem dúvidas sobre o Pix?</h4>
            <p className="text-xs text-zinc-400">
              Fale com nossa equipe técnica pelo canal oficial de suporte e atendimento.
            </p>
          </div>
        </div>

        <button
          onClick={() => onSelectView('support')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Abrir Suporte</span>
        </button>
      </div>
    </div>
  );
};
