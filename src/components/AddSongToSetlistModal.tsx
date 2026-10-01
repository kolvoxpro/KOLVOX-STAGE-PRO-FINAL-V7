import React, { useState, useEffect } from 'react';
import { Song, Playlist, SearchResultItem } from '../types/kolvox';
import { musicSearchProvider } from '../services/MusicSearchProvider';
import { findVerifiedFullLyrics } from '../data/fullLyricsCatalog';
import { saveSongToLibrary } from '../services/DatabaseService';
import {
  Search,
  Plus,
  Check,
  Eye,
  X,
  Music,
  Loader2,
  FileText,
  Sparkles,
  Globe,
  Library,
  PenTool,
  CheckCircle2,
  Mic2,
  Disc3,
  Flame,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AddSongToSetlistModalProps {
  isOpen: boolean;
  activeSetlist: Playlist | null;
  allLibrarySongs: Song[];
  user: any;
  initialTab?: 'global' | 'library' | 'new';
  onClose: () => void;
  onAddSongToSetlist: (playlistId: string, song: Song) => Promise<void>;
  onRemoveSongFromSetlist?: (playlistId: string, songId: string) => Promise<void> | void;
  onSongSavedToLibrary: (song: Song) => void;
  onDeleteSongFromLibrary?: (songId: string) => void;
  onShowToast: (msg: string) => void;
}

export const AddSongToSetlistModal: React.FC<AddSongToSetlistModalProps> = ({
  isOpen,
  activeSetlist,
  allLibrarySongs,
  user,
  initialTab = 'global',
  onClose,
  onAddSongToSetlist,
  onRemoveSongFromSetlist,
  onSongSavedToLibrary,
  onDeleteSongFromLibrary,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'global' | 'library' | 'new'>('global');

  // Global Catalog Search States
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(SearchResultItem & { cover?: string })[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'Todas' | 'Músicas' | 'Artistas'>('Todas');
  const [addingSongId, setAddingSongId] = useState<string | null>(null);

  // Preview Full Lyrics Modal inside
  const [previewItem, setPreviewItem] = useState<(SearchResultItem & { cover?: string }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Library Filter
  const [libraryFilter, setLibraryFilter] = useState('');

  // Manual Song Form States
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualLyrics, setManualLyrics] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen || !activeSetlist) return null;

  // Search execution in the Global Catalog
  const executeCatalogSearch = async (searchTerm: string, filter: 'Todas' | 'Músicas' | 'Artistas' = searchFilter) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearchLoading(true);
    setHasSearched(true);
    try {
      const rawResults = await musicSearchProvider.search(trimmed, filter);
      const enrichedResults = await Promise.all(
        rawResults.map(async (item) => {
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

      setSearchResults(deduped);
    } catch (err) {
      console.error('Catalog search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCatalogSearch(query, searchFilter);
  };

  // Helper to ensure 100% full original lyrics
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
      console.warn('Error fetching lyrics:', err);
    }
    return item.lyrics || '';
  };

  // Open Preview Modal
  const handleOpenLyricsPreview = async (item: SearchResultItem & { cover?: string }) => {
    setPreviewLoading(true);
    setPreviewItem(item);
    const fullLyrics = await ensureFullLyrics(item);
    setPreviewItem({ ...item, lyrics: fullLyrics });
    setPreviewLoading(false);
  };

  // Add Song from Global Catalog directly to Setlist
  const handleAddCatalogItemToSetlist = async (item: SearchResultItem & { cover?: string }) => {
    if (!activeSetlist) return;
    setAddingSongId(item.id);
    try {
      const fullLyrics = await ensureFullLyrics(item);

      const songObj: Song = {
        id: item.id || 'song_' + Date.now(),
        user_id: user?.uid || 'guest',
        title: item.title,
        artist: item.artist,
        lyrics: fullLyrics || 'Letra da música',
        source: item.source || 'Catálogo Global',
        cover_url: item.cover || item.coverUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to library as well
      onSongSavedToLibrary(songObj);
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
          console.warn('Silent save to db:', err);
        }
      }

      // Add directly to active setlist
      await onAddSongToSetlist(activeSetlist.id, songObj);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
      onShowToast(`"${songObj.title}" adicionada ao setlist "${activeSetlist.name}"!`);
    } catch (err) {
      console.error('Failed to add catalog song to setlist:', err);
    } finally {
      setAddingSongId(null);
    }
  };

  // Add Manual Song directly to Setlist
  const handleCreateManualSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !activeSetlist) return;

    setManualSaving(true);
    try {
      const now = new Date().toISOString();
      const songPayload = {
        title: manualTitle.trim(),
        artist: manualArtist.trim() || 'Artista',
        lyrics: manualLyrics.trim() || 'Letra da música',
        source: 'Manual',
        key_signature: manualKey.trim(),
      };

      let createdSong: Song;
      if (user) {
        createdSong = await saveSongToLibrary(user.uid, songPayload);
      } else {
        createdSong = {
          id: 'song_' + Date.now(),
          user_id: 'guest',
          ...songPayload,
          created_at: now,
          updated_at: now,
        };
      }

      onSongSavedToLibrary(createdSong);
      await onAddSongToSetlist(activeSetlist.id, createdSong);

      setManualTitle('');
      setManualArtist('');
      setManualLyrics('');
      setManualKey('');
      confetti({ particleCount: 30, spread: 60 });
      onShowToast(`"${createdSong.title}" adicionada ao setlist "${activeSetlist.name}"!`);
      setActiveTab('global');
    } catch (err) {
      console.error('Failed to create manual song:', err);
    } finally {
      setManualSaving(false);
    }
  };

  const quickChips = [
    'CPM 22',
    'Charlie Brown Jr',
    'Legião Urbana',
    'Titãs',
    'Capital Inicial',
    'Coldplay',
    'Engenheiros do Hawaii',
    'Paralamas do Sucesso',
    'NX Zero',
    'Skank',
    'Queen',
    'Imagine Dragons',
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 lg:p-6 animate-fade-in">
        <div className="bg-[#070d18] border border-blue-500/30 rounded-3xl w-full max-w-5xl xl:max-w-6xl h-[92vh] text-white shadow-2xl flex flex-col overflow-hidden relative">
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent pointer-events-none opacity-80" />

          {/* ==================================================== */}
          {/* HEADER (SPACIOUS, MODERN, SLEEK) */}
          {/* ==================================================== */}
          <div className="px-6 py-5 border-b border-zinc-800/80 bg-[#040813] flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Catálogo Global & Repertório</span>
                </span>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium">
                  <Music className="w-3.5 h-3.5 text-blue-400" />
                  <span>Setlist:</span>
                  <strong className="text-white font-bold">{activeSetlist.name}</strong>
                  <span className="text-zinc-500">({activeSetlist.songs?.length || 0} músicas)</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight flex items-center gap-2">
                <span>Pesquisar Músicas e Adicionar ao Setlist</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                Busque no acervo com letras completas, cifras e sincronização para teleprompter. Adicione músicas ao setlist com apenas um clique.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0 shadow-sm"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {/* ==================================================== */}
          {/* TABS NAVIGATION (MODERN PILLS) */}
          {/* ==================================================== */}
          <div className="px-6 py-3 border-b border-zinc-800/70 bg-[#060c18] flex items-center justify-between gap-4 overflow-x-auto shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('global')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'global'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40'
                    : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Catálogo Global (Pesquisar Músicas)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'library'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40'
                    : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <Library className="w-4 h-4 text-blue-400" />
                <span>Minha Biblioteca ({allLibrarySongs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'new'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/40'
                    : 'bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                <PenTool className="w-4 h-4 text-blue-400" />
                <span>Cadastrar Manualmente</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Letras completas prontas para o Modo Show</span>
            </div>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: CATÁLOGO GLOBAL (PESQUISAR MÚSICAS) */}
          {/* ==================================================== */}
          {activeTab === 'global' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* SEARCH BAR SECTION */}
              <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="relative flex items-center">
                    <div className="absolute left-4 text-blue-400 pointer-events-none">
                      <Search size={20} />
                    </div>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Pesquisar música ou banda (ex: CPM 22, Legião Urbana, Charlie Brown Jr, Coldplay, Titãs...)"
                      className="w-full pl-12 pr-36 py-3.5 bg-[#030814] border border-blue-500/30 focus:border-blue-500 rounded-2xl text-sm sm:text-base text-white placeholder-zinc-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      autoFocus
                    />

                    <div className="absolute right-2.5 flex items-center gap-2">
                      {query && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setSearchResults([]);
                            setHasSearched(false);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title="Limpar"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={searchLoading || !query.trim()}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                      >
                        {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        <span>Buscar</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills & Suggestions Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1.5 bg-[#030814] p-1 rounded-xl border border-zinc-800">
                      {(['Todas', 'Músicas', 'Artistas'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setSearchFilter(tab);
                            if (query.trim()) executeCatalogSearch(query, tab);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            searchFilter === tab
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Quick Suggestions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-zinc-500 font-bold flex items-center gap-1 mr-1">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sugestões:</span>
                      </span>
                      {quickChips.slice(0, 6).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setQuery(chip);
                            executeCatalogSearch(chip, searchFilter);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-blue-950/60 border border-zinc-800 hover:border-blue-500/40 text-xs text-zinc-300 hover:text-blue-300 transition-all cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              {/* SEARCH RESULTS OR EMPTY STATE */}
              {searchLoading ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                  <strong className="text-base text-white">Consultando Catálogo Global</strong>
                  <p className="text-xs text-zinc-400 font-medium max-w-sm">
                    Recuperando letras sincronizadas e cifras originais prontas para o palco...
                  </p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <span className="text-xs sm:text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>Resultados no Catálogo ({searchResults.length} músicas encontradas)</span>
                    </span>
                    <span className="text-xs text-blue-400 font-medium">
                      Clique em "+ Adicionar ao Setlist" para incluir diretamente no repertório
                    </span>
                  </div>

                  {/* 2-COLUMN RESPONSIVE GRID FOR MODERN SPACIOUS DISPLAY */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {searchResults.map((item) => {
                      const isAlreadyInSetlist = activeSetlist.songs?.some(
                        (s) =>
                          s.id === item.id ||
                          (s.title.toLowerCase() === item.title.toLowerCase() &&
                            s.artist.toLowerCase() === item.artist.toLowerCase())
                      );
                      const isAddingThis = addingSongId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-blue-500/50 hover:bg-[#070f22] transition-all flex items-center justify-between gap-3 group shadow-sm"
                        >
                          {/* Album Art / Cover + Title & Artist */}
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={
                                  item.cover ||
                                  item.coverUrl ||
                                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'
                                }
                                alt={item.title}
                                className="w-13 h-13 rounded-xl object-cover border border-zinc-800 bg-zinc-900 group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <strong className="text-white text-sm sm:text-base font-bold truncate block group-hover:text-blue-300 transition-colors">
                                  {item.title}
                                </strong>
                              </div>
                              <span className="text-xs sm:text-sm text-zinc-400 font-medium truncate block">
                                {item.artist}
                              </span>

                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                                  <span>Letra Verificada</span>
                                </span>
                                {item.album && (
                                  <span className="text-[10px] text-zinc-500 truncate max-w-[120px] hidden sm:inline">
                                    {item.album}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenLyricsPreview(item)}
                              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                              title="Visualizar letra completa"
                            >
                              <Eye size={16} />
                            </button>

                            {isAlreadyInSetlist ? (
                              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                                <Check size={14} className="text-emerald-400" />
                                <span>No Setlist</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddCatalogItemToSetlist(item)}
                                disabled={isAddingThis}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
                              >
                                {isAddingThis ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Adicionando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={14} />
                                    <span>+ Adicionar</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : hasSearched ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-zinc-950/60 rounded-3xl border border-zinc-800/80 p-8">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 text-2xl">
                    <Search size={26} />
                  </div>
                  <h4 className="text-base font-bold text-white">Nenhum resultado encontrado</h4>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-md leading-relaxed">
                    Não encontramos resultados correspondentes a "{query}". Tente buscar por outros termos ou cadastre a letra manualmente.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setManualTitle(query);
                      setActiveTab('new');
                    }}
                    className="mt-2 px-5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    + Cadastrar "{query}" manualmente agora →
                  </button>
                </div>
              ) : (
                /* SPACIOUS, ELEGANT EMPTY STATE HERO */
                <div className="py-14 sm:py-16 text-center flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-blue-950/20 via-zinc-950/40 to-zinc-950/80 rounded-3xl border border-blue-500/20 p-8 sm:p-12 relative overflow-hidden">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-3xl shadow-lg shadow-blue-500/10">
                    <Globe size={32} />
                  </div>

                  <div className="max-w-xl space-y-2">
                    <h3 className="text-lg sm:text-xl font-black text-white font-display">
                      Catálogo Global de Músicas & Cifras
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      Digite o título da música ou banda na barra de busca acima para encontrar repertórios completos e adicionar diretamente ao setlist <strong>"{activeSetlist.name}"</strong>.
                    </p>
                  </div>

                  <div className="w-full max-w-2xl pt-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-3">
                      Bandas e Artistas Recomendados para Palco:
                    </span>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setQuery(chip);
                            executeCatalogSearch(chip, searchFilter);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-blue-600/20 border border-zinc-800 hover:border-blue-500/40 text-xs text-zinc-300 hover:text-blue-300 transition-all cursor-pointer shadow-xs"
                        >
                          Buscar {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: MINHA BIBLIOTECA */}
          {/* ==================================================== */}
          {activeTab === 'library' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {allLibrarySongs.length > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search size={18} className="absolute left-4 top-3.5 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Filtrar músicas da sua biblioteca pessoal..."
                        value={libraryFilter}
                        onChange={(e) => setLibraryFilter(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs sm:text-sm text-white focus:border-blue-500 outline-none"
                      />
                    </div>
                    {onDeleteSongFromLibrary && allLibrarySongs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir todas as ${allLibrarySongs.length} músicas da sua biblioteca pessoal?`)) {
                            allLibrarySongs.forEach((s) => onDeleteSongFromLibrary(s.id));
                            onShowToast('Todas as músicas foram removidas da biblioteca.');
                          }
                        }}
                        className="px-3.5 py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        title="Excluir todas as músicas da sua biblioteca"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Excluir Todas ({allLibrarySongs.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {allLibrarySongs
                      .filter((s) => {
                        if (!libraryFilter.trim()) return true;
                        const q = libraryFilter.toLowerCase();
                        return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
                      })
                      .map((song) => {
                        const isAlreadyIn = activeSetlist.songs?.some((s) => s.id === song.id);
                        return (
                          <div
                            key={song.id}
                            className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <strong className="text-white text-sm font-bold block truncate">{song.title}</strong>
                              <span className="text-zinc-400 text-xs block truncate mt-0.5">{song.artist}</span>
                              {song.key_signature && (
                                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                  Tom: {song.key_signature}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isAlreadyIn ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onRemoveSongFromSetlist) {
                                      await onRemoveSongFromSetlist(activeSetlist.id, song.id);
                                      onShowToast(`"${song.title}" removida do setlist.`);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                                  title="Música adicionada. Clique para remover do setlist se desejar."
                                >
                                  ✓ No Setlist
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onAddSongToSetlist(activeSetlist.id, song);
                                    onShowToast(`"${song.title}" adicionada separadamente ao setlist!`);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                                >
                                  <Plus size={14} />
                                  <span>Adicionar</span>
                                </button>
                              )}

                              {onDeleteSongFromLibrary && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Remover "${song.title}" da sua biblioteca?`)) {
                                      onDeleteSongFromLibrary(song.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="Excluir música da biblioteca"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-zinc-500 text-xs sm:text-sm flex flex-col items-center gap-2">
                  <Library className="w-10 h-10 text-zinc-600" />
                  <span>Sua biblioteca pessoal ainda não possui músicas salvas.</span>
                  <button
                    onClick={() => setActiveTab('global')}
                    className="text-blue-400 hover:underline font-bold mt-1 text-xs"
                  >
                    Buscar no Catálogo Global →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: CADASTRAR MANUALMENTE */}
          {/* ==================================================== */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateManualSong} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Título da Música *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dias Atrás"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-xs sm:text-sm focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Tom / Tonalidade (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: G, C, Am"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-xs sm:text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  Banda / Artista
                </label>
                <input
                  type="text"
                  placeholder="Ex: CPM 22"
                  value={manualArtist}
                  onChange={(e) => setManualArtist(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-xs sm:text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  Letra Completa para Teleprompter *
                </label>
                <textarea
                  placeholder="Cole aqui a letra completa da música para rolar no palco..."
                  value={manualLyrics}
                  onChange={(e) => setManualLyrics(e.target.value)}
                  rows={8}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-xs sm:text-sm focus:border-blue-500 outline-none font-mono leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('global')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer hover:bg-zinc-800"
                >
                  Voltar ao Catálogo
                </button>
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {manualSaving ? 'Salvando...' : 'Salvar e Adicionar ao Setlist'}
                </button>
              </div>
            </form>
          )}

          {/* ==================================================== */}
          {/* FOOTER (CLEAN, SPACIOUS, MODERN) */}
          {/* ==================================================== */}
          <div className="px-6 py-4 border-t border-zinc-800/80 bg-[#040813] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>
                Total de músicas no setlist <strong>"{activeSetlist.name}"</strong>:{' '}
                <strong className="text-white">{activeSetlist.songs?.length || 0}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-lg shadow-blue-500/25 active:scale-95"
              >
                Concluir e Ver Setlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL PREVIEW DE LETRA COMPLETA */}
      {/* ==================================================== */}
      {previewItem && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#080f1c] border border-blue-500/40 rounded-3xl w-full max-w-lg text-white shadow-2xl animate-fade-in flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#040813]">
              <div className="min-w-0 flex-1 mr-2">
                <h3 className="text-base text-white font-bold truncate">{previewItem.title}</h3>
                <span className="text-xs text-zinc-400 truncate block">{previewItem.artist}</span>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg bg-transparent cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {previewLoading ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="text-blue-400 animate-spin" />
                  <span className="text-xs text-zinc-400">Carregando letra completa...</span>
                </div>
              ) : (
                <pre className="font-sans text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {previewItem.lyrics || 'Letra completa indisponível para este item.'}
                </pre>
              )}
            </div>

            <div className="p-3.5 border-t border-zinc-800 flex justify-between items-center bg-[#040813]">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  handleAddCatalogItemToSetlist(previewItem);
                  setPreviewItem(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus size={14} />
                <span>Adicionar ao Setlist</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
