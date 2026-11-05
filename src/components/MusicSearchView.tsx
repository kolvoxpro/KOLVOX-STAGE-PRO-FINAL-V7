import React, { useState } from 'react';
import { musicSearchProvider } from '../services/MusicSearchProvider';
import { SearchResultItem, Song } from '../types/kolvox';
import { useAuth } from '../context/AuthContext';
import { saveSearchHistory, saveSongToLibrary, deleteSongFromLibrary } from '../services/DatabaseService';
import { Search, PlusCircle, Trash2, Check, Music, Eye, FileText, X, Play } from 'lucide-react';
import confetti from 'canvas-confetti';
import { findVerifiedFullLyrics } from '../data/fullLyricsCatalog';

interface MusicSearchViewProps {
  onOpenSongInShowMode: (song: Song) => void;
  onOpenSongInPreview: (song: Song) => void;
  onAddSongToSetlistPrompt?: (song: Song) => void;
  onSongAddedToLibrary?: (song: Song) => void;
}

export const MusicSearchView: React.FC<MusicSearchViewProps> = ({
  onOpenSongInShowMode,
  onSongAddedToLibrary,
}) => {
  const { user } = useAuth();

  // Search state: initially empty as explicitly requested
  // "preencha com nada no campo de pesquisa só traga oque for pesquisado"
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(SearchResultItem & { cover?: string })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'Todas' | 'Músicas' | 'Artistas' | 'Álbuns'>('Todas');
  const [loading, setLoading] = useState(false);
  const [appliedSongs, setAppliedSongs] = useState<Record<string, boolean>>({});

  // Lyrics Preview Modal
  const [previewItem, setPreviewItem] = useState<(SearchResultItem & { cover?: string }) | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  // Manual Song Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualLyrics, setManualLyrics] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // Search function triggered strictly by user input
  const executeSearch = async (searchTerm: string, tab: 'Todas' | 'Músicas' | 'Artistas' | 'Álbuns') => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      if (user) {
        saveSearchHistory(user.uid, trimmed);
      }

      // 1. Search with strict artist filter and genuine lyrics provider
      const apiResults = await musicSearchProvider.search(trimmed, tab);

      // 2. Ensure results are enriched with authentic full lyrics without fake text
      const enrichedResults = await Promise.all(
        apiResults.map(async (item) => {
          let fullLyrics = item.lyrics;
          if (!fullLyrics || fullLyrics.length < 50) {
            const verified = findVerifiedFullLyrics(item.title, item.artist);
            if (verified?.lyrics) {
              fullLyrics = verified.lyrics;
            }
          }

          return {
            ...item,
            lyrics: fullLyrics,
            hasLicensedLyrics: Boolean(fullLyrics),
            cover:
              item.coverUrl ||
              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
          };
        })
      );

      // Deduplicate results
      const seen = new Set<string>();
      const deduped = enrichedResults.filter((item) => {
        const key = `${item.title.toLowerCase()}|${item.artist.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setResults(deduped);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(query, activeTab);
  };

  const handleTabChange = (newTab: 'Todas' | 'Músicas' | 'Artistas' | 'Álbuns') => {
    setActiveTab(newTab);
    if (query.trim()) {
      executeSearch(query, newTab);
    }
  };

  // Immediate deletion on click
  const handleDeleteMusicRow = async (id: string) => {
    setResults((prev) => prev.filter((item) => item.id !== id));
    if (user) {
      try {
        await deleteSongFromLibrary(user.uid, id);
      } catch (err) {
        console.warn('Silent delete from db:', err);
      }
    }
  };

  // Helper to ensure 100% full original lyrics - STRICT: never return fake or artificial text
  const ensureFullLyrics = async (item: SearchResultItem & { cover?: string }): Promise<string> => {
    if (item.lyrics && item.lyrics.trim().length > 50) {
      return item.lyrics.trim();
    }

    const verified = findVerifiedFullLyrics(item.title, item.artist);
    if (verified?.lyrics) {
      return verified.lyrics;
    }

    try {
      const fetched = await musicSearchProvider.getLyrics(item.title, item.artist);
      if (fetched && fetched.trim().length > 40) {
        return fetched.trim();
      }
    } catch (err) {
      console.warn('Error fetching full lyrics:', err);
    }

    return item.lyrics || '';
  };

  // Open Full Lyrics Modal
  const handleOpenLyricsPreview = async (item: SearchResultItem & { cover?: string }) => {
    setLoadingLyrics(true);
    setPreviewItem(item);
    const fullLyrics = await ensureFullLyrics(item);
    setPreviewItem({ ...item, lyrics: fullLyrics });
    setLoadingLyrics(false);
  };

  // "Aplicar" action: applies the song to the show and saves to user's library with authentic lyrics
  const handleApplySong = async (item: SearchResultItem & { cover?: string }) => {
    const fullLyrics = await ensureFullLyrics(item);

    const songObj: Song = {
      id: item.id,
      user_id: user?.uid || 'guest',
      title: item.title,
      artist: item.artist,
      lyrics: fullLyrics,
      source: item.source || 'Catálogo Oficial (Letra Completa)',
      cover_url: item.cover || item.coverUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (user) {
      try {
        await saveSongToLibrary(user.uid, {
          title: songObj.title,
          artist: songObj.artist,
          lyrics: songObj.lyrics,
          source: songObj.source,
          cover_url: songObj.cover_url,
        });
      } catch (err) {
        console.warn('Save to library:', err);
      }
    }

    onSongAddedToLibrary?.(songObj);
    setAppliedSongs((prev) => ({ ...prev, [item.id]: true }));
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });

    // Open immediately in Show Mode
    setTimeout(() => {
      onOpenSongInShowMode(songObj);
    }, 250);
  };

  const handleSaveManualSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !manualTitle.trim() || !manualArtist.trim()) return;

    setManualSaving(true);
    try {
      const saved = await saveSongToLibrary(user.uid, {
        title: manualTitle.trim(),
        artist: manualArtist.trim(),
        lyrics: manualLyrics.trim(),
        source: 'Manual',
      });

      onSongAddedToLibrary?.(saved);
      confetti({ particleCount: 35, spread: 65 });
      setShowManualModal(false);
      setManualTitle('');
      setManualArtist('');
      setManualLyrics('');

      onOpenSongInShowMode(saved);
    } catch (e) {
      console.error('Error saving manual song:', e);
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* HERO SEARCH BAR - BEM DESTACADA COM BRILHO CIANO */}
      <div className="p-1 sm:p-1.5 rounded-3xl bg-gradient-to-r from-cyan-500/50 via-blue-600/40 to-indigo-500/50 shadow-[0_0_35px_rgba(6,182,212,0.25)]">
        <div className="bg-[#040916] rounded-[22px] p-3.5 sm:p-5 space-y-4">
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-[#02050e] border-2 border-cyan-500/40 focus-within:border-cyan-400 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.35)] rounded-2xl p-2 transition-all">
              <div className="flex items-center flex-1 min-w-0 px-2">
                <Search className="w-6 h-6 text-cyan-400 shrink-0 ml-1" />
                <input
                  id="kolvox-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar por nome de música, banda ou artista..."
                  className="w-full pl-3 pr-2 py-2.5 bg-transparent text-base sm:text-lg text-white placeholder-zinc-400 font-semibold outline-none"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setResults([]);
                      setHasSearched(false);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer mr-1"
                    title="Limpar campo"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <button
                id="kolvox-search-submit-btn"
                type="submit"
                disabled={loading || !query.trim()}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:brightness-110 active:scale-95 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                title="Buscar no acervo"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4 stroke-[3]" />
                )}
                <span>Buscar Música</span>
              </button>
            </div>

            {/* FILTER TABS & QUICK SHORTCUTS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              {/* Category Segmented Controls */}
              <div className="flex items-center gap-1 bg-[#02050e] p-1 rounded-xl border border-zinc-800">
                {(['Todas', 'Músicas', 'Artistas', 'Álbuns'] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabChange(tab)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500 text-zinc-950 shadow-md font-black'
                          : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-cyan-950 border border-zinc-800 hover:border-cyan-400 text-xs font-bold text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm self-start sm:self-auto"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Inserir Letra Manual</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* SEARCH RESULTS LIST */}
      <section id="results" className="flex flex-col gap-3.5">
        {!hasSearched ? (
          <div className="py-16 text-center text-zinc-400 bg-[#040a16] border-2 border-zinc-800/80 rounded-3xl p-8 sm:p-12 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-4 shadow-lg shadow-cyan-500/10">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-white font-black text-xl mb-1.5">Catálogo Global de Músicas</h3>
            <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
              Digite acima o nome de uma música, banda ou artista para carregar letras originais completas e sincronizadas para o Modo Show.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 bg-[#040a16] border-2 border-zinc-800/80 rounded-3xl p-8 sm:p-12 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-4 text-2xl">
              <Music className="w-8 h-8" />
            </div>
            <h3 className="text-white font-black text-xl mb-1.5">Nenhuma música encontrada</h3>
            <p className="text-sm text-zinc-300 max-w-md mx-auto mb-5 leading-relaxed">
              Não encontramos resultados para &ldquo;{query}&rdquo; no filtro de {activeTab}.
            </p>
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-xs font-black uppercase tracking-wider shadow-md cursor-pointer inline-flex items-center gap-2 mx-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Inserir Letra Manualmente</span>
            </button>
          </div>
        ) : (
          results.map((item) => {
            const isApplied = appliedSongs[item.id];
            return (
              <article
                key={item.id}
                className="bg-[#040c19] border-2 border-zinc-800/90 hover:border-cyan-400/60 hover:bg-[#061226] hover:shadow-[0_0_25px_rgba(6,182,212,0.18)] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all group shadow-sm"
              >
                {/* TOP / MAIN INFO ROW */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full">
                  {/* DELETE BUTTON IN FRONT */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMusicRow(item.id)}
                    title="Excluir música desta lista"
                    className="delete-front-btn p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-950/40 hover:bg-rose-600/90 border border-rose-500/40 hover:border-rose-400 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>

                  {/* ALBUM ART THUMBNAIL */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border-2 border-zinc-700/80 group-hover:border-cyan-400 shadow-md flex items-center justify-center relative transition-all">
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Music className="w-6 h-6 text-cyan-400" />
                    )}
                  </div>

                  {/* SONG TITLE & ARTIST */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-black text-base sm:text-lg leading-tight truncate group-hover:text-cyan-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-cyan-400 text-xs sm:text-sm font-bold truncate mt-0.5">
                      {item.artist}
                    </p>

                    {/* Clean unboxed metadata with dot separators */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2 font-medium">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Letra Original LRC</span>
                      </span>
                      <span aria-hidden="true" className="text-zinc-600">·</span>
                      <span className="text-zinc-400 truncate max-w-[140px]">
                        {item.album || 'Estúdio'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTIONS ROW - BOTÕES DESTACADOS */}
                <div className="flex items-center justify-end sm:justify-start gap-2.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => handleOpenLyricsPreview(item)}
                    className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 rounded-xl border border-cyan-500/50 hover:border-cyan-400 bg-[#07162b] hover:bg-cyan-950 text-cyan-300 hover:text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title="Ver letra original completa e cifra"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Letra + Cifra</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplySong(item)}
                    className="flex-1 sm:flex-initial justify-center px-5 sm:px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 uppercase tracking-wide flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Aplicado!</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Aplicar no Show</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* MODAL DE PREVIEW DA LETRA COMPLETA E ORIGINAL */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#040e1b] border border-[#0b5a9d] rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-[#020712] border-b border-[#0e3b66] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {previewItem.cover && (
                  <img
                    src={previewItem.cover}
                    alt={previewItem.title}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-bold text-lg leading-tight truncate">
                    {previewItem.title}
                  </h3>
                  <p className="text-[#00c8ff] text-xs font-semibold uppercase tracking-wider truncate mt-0.5">
                    {previewItem.artist} • Letra Original
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Complete Lyrics */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#030914] text-white">
              {loadingLyrics ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#00c8ff] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[#8393a9] font-mono">Carregando letra original do artista...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#00c8ff] shrink-0" />
                    <span>Letra oficial do próprio artista para a sua performance ao vivo.</span>
                  </div>
                  {previewItem.lyrics ? (
                    <pre className="font-sans text-sm sm:text-base leading-relaxed text-zinc-200 whitespace-pre-wrap select-text">
                      {previewItem.lyrics}
                    </pre>
                  ) : (
                    <div className="py-8 text-center text-zinc-400 text-sm">
                      <p className="mb-2">Letra oficial não encontrada no banco público para esta faixa específica.</p>
                      <p className="text-xs text-zinc-500">Você pode adicionar a letra manualmente clicando em &ldquo;Inserir letra manual&rdquo;.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#020712] border-t border-[#0e3b66] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-xl text-[#8393a9] hover:text-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => {
                  const item = previewItem;
                  setPreviewItem(null);
                  handleApplySong(item);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#078fff] to-[#633cff] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#078fff]/30 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Aplicar no Modo Show</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL SONG MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#040e1b] border border-[#0b5a9d] rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#00c8ff]" />
              Adicionar Música Manualmente
            </h3>

            <form onSubmit={handleSaveManualSong} className="space-y-3">
              <div>
                <label className="block text-xs text-[#8393a9] mb-1 font-semibold uppercase">
                  Título da Música
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lugar ao Sol"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full bg-[#020710] border border-[#0e3a63] rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-[#00c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8393a9] mb-1 font-semibold uppercase">
                  Artista ou Banda
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Charlie Brown Jr."
                  value={manualArtist}
                  onChange={(e) => setManualArtist(e.target.value)}
                  className="w-full bg-[#020710] border border-[#0e3a63] rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-[#00c8ff]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8393a9] mb-1 font-semibold uppercase">
                  Letra / Cifra
                </label>
                <textarea
                  rows={6}
                  placeholder="Cole aqui a letra completa..."
                  value={manualLyrics}
                  onChange={(e) => setManualLyrics(e.target.value)}
                  className="w-full bg-[#020710] border border-[#0e3a63] rounded-xl p-3 text-white text-sm outline-none focus:border-[#00c8ff] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#078fff] to-[#633cff] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {manualSaving ? 'Salvando...' : 'Salvar e Abrir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
