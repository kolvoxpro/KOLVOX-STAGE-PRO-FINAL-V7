import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Song, Playlist } from '../types/index.ts';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { downloadLyricsOnly, downloadChordsAndLyrics } from '../utils/songExport.ts';
import {
  Music,
  Search,
  Star,
  Eye,
  Guitar,
  Plus,
  Trash2,
  Edit3,
  Download,
  Filter,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface MySongsViewProps {
  onlyFavorites?: boolean;
  onOpenSongInStage: (song: Song) => void;
  onOpenSongInGuitar: (song: Song) => void;
  onOpenEditModal: (song: Song) => void;
  onOpenAddModal: () => void;
}

export const MySongsView: React.FC<MySongsViewProps> = ({
  onlyFavorites = false,
  onOpenSongInStage,
  onOpenSongInGuitar,
  onOpenEditModal,
  onOpenAddModal,
}) => {
  const { token } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);

  // Delete modal state
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = onlyFavorites ? '/api/songs/favorites/list' : '/api/songs';
      const res = await fetch(endpoint, { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        setSongs(data);
      }
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [onlyFavorites, token]);

  const handleToggleFavorite = async (song: Song) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/songs/${song.id}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (onlyFavorites && !data.isFavorite) {
          setSongs((prev) => prev.filter((s) => s.id !== song.id));
        } else {
          setSongs((prev) =>
            prev.map((s) => (s.id === song.id ? { ...s, isFavorite: data.isFavorite } : s))
          );
        }
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleDeleteSong = async (songId: number | string, songTitle: string) => {
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSongs((prev) => prev.filter((s) => s.id !== songId));
        setToastMessage(`"${songTitle}" excluída com sucesso.`);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || 'Erro ao excluir música.');
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch {
      setToastMessage('Falha ao comunicar com o servidor.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleConfirmDeleteSong = async () => {
    if (!songToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/songs/${songToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setSongs((prev) => prev.filter((s) => s.id !== songToDelete.id));
        setToastMessage(`"${songToDelete.title}" foi excluída com sucesso.`);
        setTimeout(() => setToastMessage(null), 3500);
        setSongToDelete(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir música.');
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openPlaylistModal = async (song: Song) => {
    setSelectedSongForPlaylist(song);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/playlists', { credentials: 'include', headers });
      if (res.ok) {
        setPlaylists(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addSongToPlaylist = async (playlistId: number) => {
    if (!selectedSongForPlaylist) return;
    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ songId: selectedSongForPlaylist.id }),
      });
      if (res.ok) {
        alert('Música adicionada com sucesso ao repertório!');
        setSelectedSongForPlaylist(null);
      } else {
        const d = await res.json();
        alert(d.error || 'Erro ao adicionar.');
      }
    } catch (err) {
      alert('Erro ao salvar.');
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.genre && s.genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold mb-2 border border-amber-500/20">
            {onlyFavorites ? <Star className="w-3.5 h-3.5 fill-current" /> : <Music className="w-3.5 h-3.5" />}
            <span>{onlyFavorites ? 'MÚSICAS FAVORITAS' : 'ACERVO DE MÚSICAS'}</span>
          </div>
          <h1 className="text-3xl font-black text-white font-display">
            {onlyFavorites ? 'Minhas Favoritas' : 'Minhas Músicas'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {onlyFavorites
              ? 'Músicas marcadas com estrela para acesso rápido no palco'
              : 'Biblioteca de letras, cifras e arranjos sincronizados'}
          </p>
        </div>

        <button
          id="btn-add-song-view"
          onClick={onOpenAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Cadastrar Nova Música</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por título, artista ou gênero..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-400"
          />
        </div>
      </div>

      {/* Songs List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-xs">Carregando músicas...</div>
      ) : filteredSongs.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-12 text-center">
          <Music className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-zinc-200">Nenhuma música encontrada</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {onlyFavorites
              ? 'Você ainda não marcou nenhuma música como favorita.'
              : 'Cadastre suas próprias músicas ou pesquise no catálogo para começar seu repertório.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              id={`my-song-card-${song.id}`}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate max-w-xs">{song.title}</h3>
                    {song.key && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                        Tom {song.key}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleFavorite(song)}
                    className={`p-1.5 rounded-lg border text-xs ${
                      song.isFavorite
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${song.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mt-0.5">
                  {song.artist} • {song.genre || 'Variado'}
                  {song.capo ? ` • Capo ${song.capo}ª` : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onOpenSongInStage(song)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-extrabold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Palco</span>
                  </button>
                  <button
                    onClick={() => onOpenSongInGuitar(song)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center gap-1"
                  >
                    <Guitar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Violão</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 flex-wrap shrink-0">
                  {/* Baixar Só Letra */}
                  <button
                    onClick={() => {
                      downloadLyricsOnly(song);
                      setToastMessage(`Letra de "${song.title}" baixada com sucesso!`);
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-400"
                    title="Baixar somente a letra (.txt)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  {/* Baixar Cifra + Letra (Barzinho) */}
                  <button
                    onClick={() => {
                      downloadChordsAndLyrics(song);
                      setToastMessage(`Cifra e Letra de "${song.title}" baixada com sucesso!`);
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400"
                    title="Baixar cifra e letra com tom (Ideal para barzinho)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openPlaylistModal(song)}
                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Adicionar à minha setlist"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Setlist</span>
                  </button>
                  <button
                    onClick={() => onOpenEditModal(song)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    title="Editar música"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSong(song.id, song.title)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Excluir música imediatamente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Standard Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!songToDelete}
        title="Excluir Música do Acervo"
        itemName={songToDelete?.title || ''}
        itemType="esta música"
        warningMessage="A cifra, letra, anotações de tom e capotraste serão removidas permanentemente da sua biblioteca."
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteSong}
        onCancel={() => setSongToDelete(null)}
      />

      {/* Playlist Picker Dialog */}
      {selectedSongForPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Adicionar ao Repertório</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Selecione o repertório para "<strong>{selectedSongForPlaylist.title}</strong>":
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => addSongToPlaylist(pl.id)}
                  className="w-full p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-left text-xs font-bold text-white"
                >
                  <span>{pl.name}</span>
                  <span className="text-amber-400">+ Adicionar</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedSongForPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-xs text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
