import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Playlist, Song } from '../types/index.ts';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import {
  FolderHeart,
  Plus,
  Play,
  Trash2,
  MoveUp,
  MoveDown,
  Music,
  Clock,
  Eye,
  Check,
  Edit3,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface PlaylistsViewProps {
  onStartStageWithPlaylist: (playlist: Playlist, startIndex?: number) => void;
  onOpenSongInGuitar: (song: Song) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onStartStageWithPlaylist,
  onOpenSongInGuitar,
}) => {
  const { user, token } = useAuth();
  const accountKey = (user?.email || user?.uid || 'guest').toLowerCase().trim();
  const userBackupKey = `kolvox_user_playlists_${accountKey}`;
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete & Remove Confirmation State
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [songToRemove, setSongToRemove] = useState<{ id: number | string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const getAuthHeader = (): Record<string, string> => {
    const authToken = token || localStorage.getItem('kolvox_token');
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  };

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const res = await fetch('/api/playlists', { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        const list: Playlist[] = Array.isArray(data) ? data : [];
        setPlaylists(list);
        if (userBackupKey) {
          localStorage.setItem(userBackupKey, JSON.stringify(list));
        }
        if (list.length > 0) {
          if (!activePlaylist || !list.some((p) => p.id === activePlaylist.id)) {
            loadPlaylistDetails(list[0].id);
          }
        } else {
          setActivePlaylist(null);
        }
        return;
      }
    } catch (err) {
      console.error('Error loading playlists from API:', err);
    } finally {
      setLoading(false);
    }

    // Local storage fallback strictly for this user only if offline
    if (userBackupKey) {
      try {
        const backup = localStorage.getItem(userBackupKey);
        if (backup) {
          const parsed: Playlist[] = JSON.parse(backup);
          setPlaylists(parsed);
          if (parsed.length > 0 && !activePlaylist) {
            setActivePlaylist(parsed[0]);
          }
        } else {
          setPlaylists([]);
          setActivePlaylist(null);
        }
      } catch {}
    } else {
      setPlaylists([]);
      setActivePlaylist(null);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  const loadPlaylistDetails = async (id: number) => {
    try {
      const headers = getAuthHeader();
      const res = await fetch(`/api/playlists/${id}`, { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        setActivePlaylist(data);
        return;
      }
    } catch (err) {
      console.error('Error loading playlist details:', err);
    }

    // Local details fallback
    const found = playlists.find((p) => p.id === id);
    if (found) {
      setActivePlaylist(found);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [token]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setCreateError('Por favor, informe o nome do repertório.');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    };

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name: trimmedName, description: newDesc.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.playlist) {
        const createdPl: Playlist = {
          ...data.playlist,
          songCount: data.playlist.songCount || 0,
          songs: data.playlist.songs || [],
        };
        setShowCreateModal(false);
        setNewName('');
        setNewDesc('');
        setToastNotice(`Repertório "${createdPl.name}" criado com sucesso!`);
        setTimeout(() => setToastNotice(null), 3500);
        setPlaylists((prev) => [createdPl, ...prev.filter((p) => p.id !== createdPl.id)]);
        setActivePlaylist(createdPl);
        await loadPlaylists();
        if (createdPl.id) {
          await loadPlaylistDetails(createdPl.id);
        }
        return;
      }

      if (res.status === 400 && data.error) {
        setCreateError(data.error);
        return;
      }

      // If server returned non-400 error (e.g. temporary server state), save locally so user is never blocked
      const localPlaylist: Playlist = {
        id: Date.now(),
        userId: user?.uid ? 1 : 1,
        name: trimmedName,
        description: newDesc.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        songCount: 0,
        songs: [],
      };
      const currentBackup: Playlist[] = userBackupKey ? JSON.parse(localStorage.getItem(userBackupKey) || '[]') : [];
      const updated = [localPlaylist, ...currentBackup];
      if (userBackupKey) {
        localStorage.setItem(userBackupKey, JSON.stringify(updated));
      }
      setPlaylists(updated);
      setActivePlaylist(localPlaylist);
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      setToastNotice(`Repertório "${localPlaylist.name}" criado com sucesso!`);
      setTimeout(() => setToastNotice(null), 3500);
    } catch (err) {
      console.error('Network error creating playlist, saving locally:', err);
      const localPlaylist: Playlist = {
        id: Date.now(),
        userId: 1,
        name: trimmedName,
        description: newDesc.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        songCount: 0,
        songs: [],
      };
      const currentBackup: Playlist[] = userBackupKey ? JSON.parse(localStorage.getItem(userBackupKey) || '[]') : [];
      const updated = [localPlaylist, ...currentBackup];
      if (userBackupKey) {
        localStorage.setItem(userBackupKey, JSON.stringify(updated));
      }
      setPlaylists(updated);
      setActivePlaylist(localPlaylist);
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      setToastNotice(`Repertório "${localPlaylist.name}" criado com sucesso!`);
      setTimeout(() => setToastNotice(null), 3500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlaylistDirect = async (playlist: Playlist) => {
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        if (activePlaylist?.id === playlist.id) {
          setActivePlaylist(null);
        }
        await loadPlaylists();
        setToastNotice(`Repertório "${playlist.name}" excluído.`);
        setTimeout(() => setToastNotice(null), 3000);
      } else {
        // Local removal
        const updated = playlists.filter((p) => p.id !== playlist.id);
        setPlaylists(updated);
        if (userBackupKey) {
          localStorage.setItem(userBackupKey, JSON.stringify(updated));
        }
        if (activePlaylist?.id === playlist.id) {
          setActivePlaylist(updated.length > 0 ? updated[0] : null);
        }
        setToastNotice(`Repertório "${playlist.name}" excluído.`);
        setTimeout(() => setToastNotice(null), 3000);
      }
    } catch {
      // Local removal on error
      const updated = playlists.filter((p) => p.id !== playlist.id);
      setPlaylists(updated);
      if (userBackupKey) {
        localStorage.setItem(userBackupKey, JSON.stringify(updated));
      }
      if (activePlaylist?.id === playlist.id) {
        setActivePlaylist(updated.length > 0 ? updated[0] : null);
      }
      setToastNotice(`Repertório "${playlist.name}" excluído.`);
      setTimeout(() => setToastNotice(null), 3000);
    }
  };

  const handleRemoveSongDirect = async (songId: number | string, songTitle: string) => {
    if (!activePlaylist) return;
    try {
      const res = await fetch(`/api/playlists/${activePlaylist.id}/songs/${songId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setActivePlaylist((prev) =>
          prev
            ? { ...prev, songs: (prev.songs || []).filter((s) => s.id !== songId) }
            : null
        );
        await loadPlaylists();
        setToastNotice(`Música "${songTitle}" removida do repertório.`);
        setTimeout(() => setToastNotice(null), 3000);
      } else {
        setActivePlaylist((prev) =>
          prev
            ? { ...prev, songs: (prev.songs || []).filter((s) => s.id !== songId) }
            : null
        );
        setToastNotice(`Música "${songTitle}" removida do repertório.`);
        setTimeout(() => setToastNotice(null), 3000);
      }
    } catch {
      setActivePlaylist((prev) =>
        prev
          ? { ...prev, songs: (prev.songs || []).filter((s) => s.id !== songId) }
          : null
      );
      setToastNotice(`Música "${songTitle}" removida do repertório.`);
      setTimeout(() => setToastNotice(null), 3000);
    }
  };

  const handleConfirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${playlistToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        if (activePlaylist?.id === playlistToDelete.id) {
          setActivePlaylist(null);
        }
        await loadPlaylists();
        setToastNotice(`Repertório "${playlistToDelete.name}" excluído com sucesso.`);
        setTimeout(() => setToastNotice(null), 3500);
        setPlaylistToDelete(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao excluir repertório.');
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmRemoveSong = async () => {
    if (!activePlaylist || !songToRemove) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${activePlaylist.id}/songs/${songToRemove.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeader(),
      });
      if (res.ok) {
        await loadPlaylistDetails(activePlaylist.id);
        await loadPlaylists();
        setToastNotice(`"${songToRemove.title}" removida deste repertório.`);
        setTimeout(() => setToastNotice(null), 3500);
        setSongToRemove(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao remover música do repertório.');
      }
    } catch (err) {
      alert('Falha ao remover música do repertório.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveSong = async (index: number, direction: 'up' | 'down') => {
    if (!activePlaylist || !activePlaylist.songs) return;
    const songs = [...activePlaylist.songs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= songs.length) return;

    const temp = songs[index];
    songs[index] = songs[targetIndex];
    songs[targetIndex] = temp;

    // Optimistic local update
    setActivePlaylist({ ...activePlaylist, songs });

    try {
      await fetch(`/api/playlists/${activePlaylist.id}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderedSongIds: songs.map((s) => s.id) }),
      });
    } catch (err) {
      console.error('Error reordering playlist:', err);
    }
  };

  // Estimate total show time: 3.5 minutes per song on average
  const songsCount = activePlaylist?.songs?.length || 0;
  const estimatedMinutes = Math.round(songsCount * 3.7);
  const hours = Math.floor(estimatedMinutes / 60);
  const mins = estimatedMinutes % 60;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-2 border border-blue-500/20">
            <FolderHeart className="w-3.5 h-3.5" />
            <span>ORGANIZADOR DE SETLISTS</span>
          </div>
          <h1 className="text-3xl font-black text-white font-display">
            Meus Repertórios de Show
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Organize blocos de apresentação, ensaios e lance direto no Modo Palco
          </p>
        </div>

        <button
          id="btn-create-playlist-open"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Criar Novo Repertório</span>
        </button>
      </div>

      {/* Main Grid: Left Side Playlists List / Right Side Active Setlist Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Repertoires list */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
            Suas Listas ({playlists.length})
          </h3>

          {loading ? (
            <div className="text-xs text-zinc-500 py-6 text-center">Carregando repertórios...</div>
          ) : playlists.length === 0 ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-xs text-zinc-400">Você ainda não criou repertórios.</p>
            </div>
          ) : (
            playlists.map((pl) => {
              const isSelected = activePlaylist?.id === pl.id;
              return (
                <div
                  key={pl.id}
                  id={`playlist-item-${pl.id}`}
                  onClick={() => loadPlaylistDetails(pl.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-amber-400/60 shadow-md shadow-amber-500/5'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white truncate">{pl.name}</h4>
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      {pl.songCount || 0} músicas
                    </span>
                  </div>
                  {pl.description && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{pl.description}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (2 cols): Selected Playlist Details */}
        <div className="lg:col-span-2">
          {activePlaylist ? (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-white">{activePlaylist.name}</h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {activePlaylist.description || 'Setlist pronta para o show'}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-amber-400" />
                      <strong>{songsCount}</strong> músicas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      Estimativa: <strong>{hours > 0 ? `${hours}h ` : ''}{mins}min</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {songsCount > 0 && (
                    <button
                      id="btn-start-show-stage"
                      onClick={() => onStartStageWithPlaylist(activePlaylist, 0)}
                      className="flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95 text-center"
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>INICIAR SHOW NO PALCO</span>
                    </button>
                  )}

                  <button
                    id="btn-delete-playlist"
                    onClick={() => handleDeletePlaylistDirect(activePlaylist)}
                    className="px-3 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white border border-red-700/80 flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    title="Excluir repertório imediatamente"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>

              {/* Ordered Songs List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 font-mono uppercase pb-1">
                  <span>Ordem da Apresentação</span>
                  <span>Ações</span>
                </div>

                {songsCount === 0 ? (
                  <div className="text-center py-12 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 p-6">
                    <Music className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-300">Este repertório está vazio</p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                      Vá até a aba <strong>Pesquisar</strong> ou <strong>Minhas Músicas</strong> e clique em "+ Repertório" para adicionar suas músicas aqui.
                    </p>
                  </div>
                ) : (
                  activePlaylist.songs?.map((song, index) => (
                    <div
                      key={song.id}
                      id={`setlist-song-${song.id}`}
                      className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-zinc-800 text-amber-400 flex items-center justify-center font-mono font-extrabold text-xs shrink-0">
                          {index + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white truncate">{song.title}</h4>
                            {song.key && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                Tom {song.key}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            {song.artist}
                          </p>
                        </div>
                      </div>

                      {/* Reorder & Action Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveSong(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                          title="Subir na lista"
                        >
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveSong(index, 'down')}
                          disabled={index === songsCount - 1}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
                          title="Descer na lista"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onStartStageWithPlaylist(activePlaylist, index)}
                          className="p-1.5 rounded-lg bg-amber-400 text-zinc-950 hover:bg-amber-300 font-bold text-xs"
                          title="Tocar a partir daqui no Modo Palco"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleRemoveSongDirect(song.id, song.title)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remover do repertório imediatamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-400">
              Selecione um repertório ao lado para visualizar e editar as músicas.
            </div>
          )}
        </div>
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Criar Novo Repertório</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Crie uma lista temática para seu próximo show, evento ou culto.
            </p>

            <form onSubmit={handleCreatePlaylist} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nome do Repertório *
                </label>
                <input
                  id="input-playlist-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Show Bar Sexta, Casamento Acústico"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Descrição / Local / Data (Opcional)
                </label>
                <input
                  id="input-playlist-desc"
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: 3 blocos de 50 min, formato voz e violão"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                />
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                  <span>{createError}</span>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-submit-playlist"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/10 transition-all"
                >
                  {isSubmitting ? 'Criando...' : 'Criar Repertório'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Confirm Delete Entire Playlist Modal */}
      <ConfirmDeleteModal
        isOpen={!!playlistToDelete}
        title="Excluir Repertório Completo"
        itemName={playlistToDelete?.name || ''}
        itemType="este repertório"
        warningMessage="Esta setlist será excluída permanentemente. As músicas individuais continuarão salvas no seu acervo geral."
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeletePlaylist}
        onCancel={() => setPlaylistToDelete(null)}
      />

      {/* Confirm Remove Song From Playlist Modal */}
      <ConfirmDeleteModal
        isOpen={!!songToRemove}
        title="Remover Música do Repertório"
        itemName={songToRemove?.title || ''}
        itemType="esta música"
        warningMessage={`A música será retirada de "${activePlaylist?.name || 'Repertório'}", mas continuará salva no seu acervo.`}
        isDeleting={isDeleting}
        onConfirm={handleConfirmRemoveSong}
        onCancel={() => setSongToRemove(null)}
      />
    </div>
  );
};
