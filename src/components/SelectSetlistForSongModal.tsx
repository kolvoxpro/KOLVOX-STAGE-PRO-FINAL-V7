import React, { useState } from 'react';
import { Song, Playlist } from '../types/kolvox';
import {
  ListMusic,
  Plus,
  Check,
  X,
  Music,
  FolderPlus,
  Sparkles,
  ChevronRight,
  Disc3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SelectSetlistForSongModalProps {
  isOpen: boolean;
  song: Song | null;
  playlists: Playlist[];
  onClose: () => void;
  onAddSongToPlaylist: (playlistId: string, song: Song) => Promise<void>;
  onRemoveSongFromPlaylist?: (playlistId: string, songId: string) => Promise<void>;
  onCreatePlaylist?: (name: string) => Promise<Playlist | null | void>;
  onShowToast: (msg: string) => void;
}

export const SelectSetlistForSongModal: React.FC<SelectSetlistForSongModalProps> = ({
  isOpen,
  song,
  playlists,
  onClose,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  onCreatePlaylist,
  onShowToast,
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<string[]>([]);
  const [removedPlaylistIds, setRemovedPlaylistIds] = useState<string[]>([]);

  if (!isOpen || !song) return null;

  const handleToggleSetlist = async (playlist: Playlist) => {
    setIsSubmitting(true);
    const currentlyIn =
      ((playlist.songs || []).some((s) => s.id === song.id) || addedPlaylistIds.includes(playlist.id)) &&
      !removedPlaylistIds.includes(playlist.id);

    try {
      if (currentlyIn) {
        if (onRemoveSongFromPlaylist) {
          await onRemoveSongFromPlaylist(playlist.id, song.id);
          setRemovedPlaylistIds((prev) => [...prev, playlist.id]);
          setAddedPlaylistIds((prev) => prev.filter((id) => id !== playlist.id));
          onShowToast(`"${song.title}" removida do setlist "${playlist.name}".`);
        }
      } else {
        await onAddSongToPlaylist(playlist.id, song);
        setAddedPlaylistIds((prev) => [...prev, playlist.id]);
        setRemovedPlaylistIds((prev) => prev.filter((id) => id !== playlist.id));
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
        onShowToast(`"${song.title}" adicionada separadamente ao setlist "${playlist.name}"!`);
      }
    } catch (err) {
      console.error('Error toggling song in playlist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !onCreatePlaylist) return;
    setIsSubmitting(true);
    try {
      const created = await onCreatePlaylist(newPlaylistName.trim());
      if (created && (created as Playlist).id) {
        await onAddSongToPlaylist((created as Playlist).id, song);
        setAddedPlaylistIds((prev) => [...prev, (created as Playlist).id]);
        confetti({ particleCount: 35, spread: 65, origin: { y: 0.6 } });
        onShowToast(`Setlist "${newPlaylistName.trim()}" criado com "${song.title}"!`);
      }
      setNewPlaylistName('');
      setShowCreateInput(false);
    } catch (err) {
      console.error('Error creating setlist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="modal-select-setlist-overlay"
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="modal-select-setlist-dialog"
        className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ListMusic className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
              Organização de Show
            </span>
            <h3 className="text-lg font-black text-white truncate">
              Adicionar Música Individualmente
            </h3>
            <p className="text-xs text-zinc-400 truncate mt-0.5">
              Música: <strong className="text-zinc-200">{song.title}</strong> • {song.artist}
            </p>
          </div>
        </div>

        {/* Setlists List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {playlists.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center space-y-3">
              <Disc3 className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">
                Você ainda não tem nenhum setlist criado. Crie o seu primeiro agora para organizar o show!
              </p>
            </div>
          ) : (
            playlists.map((pl) => {
              const isAlreadyIn =
                ((pl.songs || []).some((s) => s.id === song.id) || addedPlaylistIds.includes(pl.id)) &&
                !removedPlaylistIds.includes(pl.id);
              const songCount = pl.songs?.length ?? pl.song_count ?? 0;

              return (
                <div
                  key={pl.id}
                  onClick={() => handleToggleSetlist(pl)}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isAlreadyIn
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                      : 'bg-zinc-950/70 hover:bg-zinc-800/80 border-zinc-800/80 hover:border-amber-500/40 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isAlreadyIn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-amber-400'
                      }`}
                    >
                      {isAlreadyIn ? <Check className="w-4 h-4 stroke-[3]" /> : <ListMusic className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{pl.name}</h4>
                      <span className="text-[10px] text-zinc-400">
                        {songCount} {songCount === 1 ? 'música' : 'músicas'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isAlreadyIn ? (
                      <span className="text-[10px] font-bold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1">
                        <span>✓ No Setlist</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create New Setlist Inline */}
        <div className="pt-2 border-t border-zinc-800">
          {!showCreateInput ? (
            <button
              type="button"
              onClick={() => setShowCreateInput(true)}
              className="w-full py-2.5 px-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-dashed border-zinc-700 hover:border-amber-400/60 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>+ Criar Nova Setlist e Adicionar "{song.title}"</span>
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 block">
                Nome da Nova Setlist:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: Show Acústico Barzinho..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim() || isSubmitting}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateInput(false)}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs transition-colors cursor-pointer shadow-md"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
