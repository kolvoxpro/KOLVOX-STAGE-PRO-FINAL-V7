import React, { useState } from 'react';
import { Song } from '../types/kolvox';
import { useAuth } from '../context/AuthContext';
import { saveSongToLibrary, updateSongInLibrary } from '../services/DatabaseService';
import {
  Play,
  ArrowLeft,
  Music,
  PlusCircle,
  Check,
  Edit3,
  Share2,
  ListMusic,
  Clock,
  Sparkles,
  Save,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SongDetailModalProps {
  song: Song;
  onClose: () => void;
  onApplyShowMode: (song: Song) => void;
  onRefreshSong?: (updated: Song) => void;
}

export const SongDetailModal: React.FC<SongDetailModalProps> = ({
  song,
  onClose,
  onApplyShowMode,
  onRefreshSong,
}) => {
  const { user } = useAuth();
  const [lyrics, setLyrics] = useState(song.lyrics);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveToMyLibrary = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (song.id.startsWith('lrc_') || song.id.startsWith('itunes_')) {
        const saved = await saveSongToLibrary(user.uid, {
          title: song.title,
          artist: song.artist,
          lyrics: lyrics,
          source: song.source,
          source_song_id: song.source_song_id || song.id,
          cover_url: song.cover_url,
          key_signature: song.key_signature,
          bpm: song.bpm,
        });
        setIsSaved(true);
        confetti({ particleCount: 30, spread: 60 });
        onRefreshSong?.(saved);
      } else {
        await updateSongInLibrary(user.uid, song.id, {
          lyrics: lyrics,
        });
        setIsSaved(true);
        setIsEditing(false);
        onRefreshSong?.({ ...song, lyrics });
      }
    } catch (err) {
      console.error('Error saving song:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="kolvox-song-detail-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">
                {song.artist}
              </span>
              <h2 className="text-xl font-bold text-white line-clamp-1">{song.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700"
              title="Editar letra"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEditing ? 'Visualizar' : 'Editar'}</span>
            </button>

            <button
              id="kolvox-modal-btn-apply-show"
              onClick={() => onApplyShowMode({ ...song, lyrics })}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              APLICAR AO MODO SHOW
            </button>
          </div>
        </div>

        {/* Content Body: Lyrics */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-zinc-950">
          {isEditing ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Editar letra e formatação
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={16}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500 leading-relaxed"
              />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="whitespace-pre-line text-base text-zinc-200 leading-relaxed font-sans font-medium text-center">
                {lyrics || (
                  <span className="text-zinc-500 italic">
                    Este conteúdo não está disponível para exibição através deste provedor.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <span>Fonte: {song.source || 'Provedor Autorizado'}</span>
          <div className="flex gap-2">
            <button
              onClick={handleSaveToMyLibrary}
              disabled={saving || isSaved}
              className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                isSaved
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white'
              }`}
            >
              {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? 'Salvo no Repertório' : 'Salvar no Repertório'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
