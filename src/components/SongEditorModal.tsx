import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Song } from '../types/index.ts';
import {
  X,
  Music,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

interface SongEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongSaved: (song: Song) => void;
  initialSong?: Song | null;
}

export const SongEditorModal: React.FC<SongEditorModalProps> = ({
  isOpen,
  onClose,
  onSongSaved,
  initialSong,
}) => {
  const { token } = useAuth();
  const [tab, setTab] = useState<'manual' | 'import'>('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual form fields
  const [title, setTitle] = useState(initialSong?.title || '');
  const [artist, setArtist] = useState(initialSong?.artist || '');
  const [album, setAlbum] = useState(initialSong?.album || '');
  const [genre, setGenre] = useState(initialSong?.genre || 'MPB');
  const [key, setKey] = useState(initialSong?.key || 'G');
  const [capo, setCapo] = useState(initialSong?.capo || 0);
  const [bpm, setBpm] = useState(initialSong?.bpm || 110);
  const [chords, setChords] = useState(initialSong?.chords || '');
  const [officialNotice, setOfficialNotice] = useState(initialSong?.officialNotice || '');

  // Import fields
  const [rawText, setRawText] = useState('');

  if (!isOpen) return null;

  // Parser for pasted text or uploaded TXT
  const handleAutoParse = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split('\n');
    let detectedTitle = '';
    let detectedArtist = '';
    let detectedKey = 'G';
    let detectedCapo = 0;

    // Check first few lines for headers like "Musica: ...", "Artista: ...", "Tom: ..."
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      const titleMatch = line.match(/(?:m[uú]sica|t[ií]tulo):\s*(.+)/i);
      const artistMatch = line.match(/(?:artista|cantor|banda):\s*(.+)/i);
      const keyMatch = line.match(/(?:tom|key):\s*([A-G][b#]?)/i);
      const capoMatch = line.match(/(?:capo|capotraste):\s*(\d+)/i);

      if (titleMatch) detectedTitle = titleMatch[1];
      if (artistMatch) detectedArtist = artistMatch[1];
      if (keyMatch) detectedKey = keyMatch[1];
      if (capoMatch) detectedCapo = parseInt(capoMatch[1], 10);
    }

    if (!detectedTitle && lines[0]) {
      detectedTitle = lines[0].replace(/[#*]/g, '').trim();
    }
    if (!detectedArtist && lines[1] && !lines[1].includes('[')) {
      detectedArtist = lines[1].replace(/[#*]/g, '').trim();
    }

    if (detectedTitle) setTitle(detectedTitle);
    if (detectedArtist) setArtist(detectedArtist);
    if (detectedKey) setKey(detectedKey);
    if (detectedCapo) setCapo(detectedCapo);
    setChords(rawText);

    setTab('manual');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
    };
    reader.readAsText(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !artist.trim()) {
      setError('Título e Artista são campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const isEditing = !!initialSong?.id;
      const url = isEditing ? `/api/songs/${initialSong.id}` : '/api/songs';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          album: album.trim() || undefined,
          genre,
          key,
          capo: Number(capo),
          bpm: Number(bpm),
          chords: chords.trim(),
          lyrics: chords.trim(),
          officialNotice: officialNotice.trim() || undefined,
          licenseType: 'Acervo Pessoal do Artista',
          downloadAllowed: true,
          printAllowed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar música.');
      }

      onSongSaved(data.song);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar no banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="song-editor-card"
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-100 my-6"
      >
        <button
          id="btn-close-song-editor"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display">
              {initialSong ? 'EDITAR MÚSICA' : 'CADASTRAR MÚSICA NO ACERVO'}
            </h2>
            <p className="text-xs text-zinc-400">
              Adicione cifras e letras personalizadas com transposição automática
            </p>
          </div>
        </div>

        {/* Tab Switcher: Manual vs Import */}
        <div className="flex gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl mb-6">
          <button
            type="button"
            id="tab-btn-manual"
            onClick={() => setTab('manual')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'manual'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Formulário Manual</span>
          </button>

          <button
            type="button"
            id="tab-btn-import"
            onClick={() => setTab('import')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'import'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Importar TXT / Colar</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: MANUAL FORM */}
        {tab === 'manual' && (
          <form onSubmit={handleSave} className="space-y-4 max-h-[64vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Título da Música *
                </label>
                <input
                  id="input-song-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Como Nossos Pais"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Artista / Intérprete *
                </label>
                <input
                  id="input-song-artist"
                  type="text"
                  required
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Ex: Elis Regina"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Gênero
                </label>
                <select
                  id="select-song-genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                >
                  {['MPB', 'Sertanejo', 'Rock', 'Pop', 'Gospel', 'Forró', 'Samba', 'Pagode', 'Jazz', 'Acústico'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tom Original
                </label>
                <select
                  id="select-song-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-amber-400"
                >
                  {['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Capotraste
                </label>
                <select
                  id="select-song-capo"
                  value={capo}
                  onChange={(e) => setCapo(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                >
                  <option value="0">Sem capo</option>
                  <option value="1">1ª casa</option>
                  <option value="2">2ª casa</option>
                  <option value="3">3ª casa</option>
                  <option value="4">4ª casa</option>
                  <option value="5">5ª casa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Andamento (BPM)
                </label>
                <input
                  id="input-song-bpm"
                  type="number"
                  min="40"
                  max="240"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Letra & Cifras
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Dica: Acordes em linha separada ou entre colchetes
                </span>
              </div>
              <textarea
                id="textarea-song-chords"
                rows={10}
                required
                value={chords}
                onChange={(e) => setChords(e.target.value)}
                placeholder="[Intro] G D/F# Em C

G                    D/F#
Não quero lhe falar meu grande amor
Em                   C
Das coisas que aprendi nos discos..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-white placeholder:text-zinc-700 focus:outline-hidden focus:border-amber-400 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Observações de palco / Arranjo
              </label>
              <input
                id="input-song-notice"
                type="text"
                value={officialNotice}
                onChange={(e) => setOfficialNotice(e.target.value)}
                placeholder="Ex: Solo no violão aço, vocalista entra no refrão 2"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-save-song"
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'SALVANDO...' : 'SALVAR NO ACERVO'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: IMPORT TXT / TEXT */}
        {tab === 'import' && (
          <div className="space-y-4">
            <div className="p-4 border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-950 text-center">
              <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-200">
                Selecione um arquivo de cifra (.txt) ou cole abaixo
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                O motor KOLVOX detecta automaticamente título, tom, acordes e letra.
              </p>
              <input
                id="input-file-import"
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="mt-3 text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-zinc-950 hover:file:bg-amber-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Ou cole o texto completo da cifra:
              </label>
              <textarea
                id="textarea-import-raw"
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole aqui a cifra ou letra completa..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-white placeholder:text-zinc-700 focus:outline-hidden focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-process-import"
                onClick={handleAutoParse}
                disabled={!rawText.trim()}
                className="px-6 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs disabled:opacity-40 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>PROCESSAR & REVISAR</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
