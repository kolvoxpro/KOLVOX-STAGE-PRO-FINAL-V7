import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Song, Playlist } from '../types/index.ts';
import { downloadLyricsOnly, downloadChordsAndLyrics } from '../utils/songExport.ts';
import { searchCatalogSeed, getCatalogSongById, findCatalogSongByTitleOrId } from '../data/catalogSeed.ts';
import {
  Search,
  Music,
  Eye,
  Guitar,
  Star,
  Plus,
  Download,
  ExternalLink,
  ShieldCheck,
  Filter,
  Check,
  BookOpen,
  Music2,
  Sparkles,
  Link as LinkIcon,
  Globe,
  UploadCloud,
  FileText,
  X,
  Loader2,
} from 'lucide-react';

interface MusicSearchProps {
  onOpenSongInStage: (song: Song) => void;
  onOpenSongInGuitar: (song: Song) => void;
  onOpenSongDetails: (song: Song) => void;
}

export const MusicSearch: React.FC<MusicSearchProps> = ({
  onOpenSongInStage,
  onOpenSongInGuitar,
  onOpenSongDetails,
}) => {
  const { token, user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('todos');
  const [selectedProvider, setSelectedProvider] = useState<'todos' | 'cifraclub' | 'vagalume' | 'local'>('todos');
  const [categoryTab, setCategoryTab] = useState<'todas' | 'musicas' | 'artistas' | 'albuns'>('todas');
  const [formatFilter, setFormatFilter] = useState<'todas' | 'cifra_letra' | 'somente_letra'>('todas');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);
  const [addToPlaylistSuccess, setAddToPlaylistSuccess] = useState<string | null>(null);
  const [showCreatePlaylistInline, setShowCreatePlaylistInline] = useState(false);
  const [inlinePlaylistName, setInlinePlaylistName] = useState('');
  const [isCreatingInline, setIsCreatingInline] = useState(false);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [importDefaultTitle, setImportDefaultTitle] = useState('');
  const [importDefaultArtist, setImportDefaultArtist] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Popular quick song suggestions
  const popularSuggestions = [
    'Tempo Perdido',
    'Evidências',
    'Anunciação',
    'Como Nossos Pais',
    'Metamorfose Ambulante',
    'Pais e Filhos',
    'Lugar Secreto',
    'Garota de Ipanema',
    'Céu Azul',
    'Notificação Preferida',
    'Exagerado',
    'Perfect',
    'Oceano',
  ];

  // Quick genre filters
  const genreFilters = [
    { id: 'todos', label: 'Todos os gêneros' },
    { id: 'MPB', label: 'MPB' },
    { id: 'Sertanejo', label: 'Sertanejo' },
    { id: 'Rock', label: 'Rock' },
    { id: 'Pop', label: 'Pop' },
    { id: 'Gospel', label: 'Gospel' },
    { id: 'Acústico', label: 'Acústico' },
  ];

  // Provider filters
  const providerFilters = [
    { id: 'todos', label: 'Todas as Fontes' },
    { id: 'cifraclub', label: '🎸 Cifra Club (Cifras)' },
    { id: 'vagalume', label: '🎤 Vagalume (Letras)' },
    { id: 'local', label: '⭐ Acervo Kolvox' },
  ];

  // Fetch initial results or search query with high-resilience fallback
  const performSearch = async (searchTerm: string, genre: string) => {
    setLoading(true);
    let songsFound: Song[] = [];
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('q', searchTerm.trim());
      if (genre !== 'todos') params.append('genre', genre);

      const res = await fetch(`/api/songs/search?${params.toString()}`, {
        credentials: 'include',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          songsFound = data;
        }
      }
    } catch (err) {
      console.warn('API search endpoint notice (using local provider search):', err);
    }

    // High resilience fallback: If remote API returned 0 results or failed, query catalog seed directly!
    if (songsFound.length === 0) {
      try {
        const localMatches = searchCatalogSeed(searchTerm, genre !== 'todos' ? genre : undefined);
        songsFound = localMatches as any[];
      } catch (catalogErr) {
        console.warn('Catalog search error:', catalogErr);
      }
    }

    setResults(songsFound);
    setLoading(false);
  };

  // Live automatic search as you type (debounce 200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, selectedGenre);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selectedGenre]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, selectedGenre);
  };

  // Helper to ensure full lyrics & chords are loaded immediately
  const enrichSong = (rawSong: Song): Song => {
    if (rawSong.chords && rawSong.chords.length > 20 && rawSong.lyrics && rawSong.lyrics.length > 20) {
      return rawSong;
    }
    const cat =
      (rawSong.id ? findCatalogSongByTitleOrId(rawSong.id, rawSong.artist) : null) ||
      (rawSong.title ? findCatalogSongByTitleOrId(rawSong.title, rawSong.artist) : null);

    if (cat) {
      return {
        ...rawSong,
        chords: rawSong.chords || cat.chords || '',
        lyrics: rawSong.lyrics || cat.lyrics || '',
        key: rawSong.key || cat.key || 'G',
        bpm: rawSong.bpm || cat.bpm || 100,
        hasChords: cat.hasChords ?? rawSong.hasChords,
        hasLyrics: cat.hasLyrics ?? rawSong.hasLyrics,
      };
    }
    return rawSong;
  };

  // Filter results by provider, categoryTab, and formatFilter
  const filteredResults = results.filter((song) => {
    // 1. Provider
    if (selectedProvider !== 'todos') {
      const prov = (song.sourceProvider || '').toLowerCase();
      if (selectedProvider === 'cifraclub' && !(prov.includes('cifra') || (song.sourceUrl && song.sourceUrl.includes('cifraclub')))) return false;
      if (selectedProvider === 'vagalume' && !(prov.includes('vagalume') || (song.sourceUrl && song.sourceUrl.includes('vagalume')))) return false;
      if (selectedProvider === 'local' && (prov.includes('cifra') || prov.includes('vagalume'))) return false;
    }

    // 2. Format filter: "cifra_letra" vs "somente_letra"
    if (formatFilter === 'cifra_letra' && !song.hasChords) return false;
    if (formatFilter === 'somente_letra' && !song.hasLyrics && (!song.lyrics || song.lyrics.trim().length === 0)) return false;

    // 3. Category Tab
    if (categoryTab === 'musicas' && !song.title) return false;
    if (categoryTab === 'artistas' && !song.artist) return false;
    if (categoryTab === 'albuns' && !song.album) return false;

    return true;
  });

  // Handle external search shortcuts
  const openCifraClubSearch = () => {
    const q = encodeURIComponent(query.trim() || 'top cifras');
    window.open(`https://www.cifraclub.com.br/?q=${q}`, '_blank', 'noopener,noreferrer');
  };

  const openVagalumeSearch = () => {
    const q = encodeURIComponent(query.trim() || 'top musicas');
    window.open(`https://www.vagalume.com.br/search?q=${q}`, '_blank', 'noopener,noreferrer');
  };

  // Toggle favorite
  const handleToggleFavorite = async (song: Song) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/songs/${song.id}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResults((prev) =>
          prev.map((s) => (s.id === song.id ? { ...s, isFavorite: data.isFavorite } : s))
        );
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Load playlists for adding to setlist
  const openPlaylistPicker = async (song: Song) => {
    setSelectedSongForPlaylist(song);
    setShowCreatePlaylistInline(false);
    setInlinePlaylistName('');
    const authToken = token || localStorage.getItem('kolvox_token');
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/api/playlists', { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
        return;
      }
    } catch (err) {
      console.error('Error loading playlists:', err);
    }
    try {
      const userKey = user?.uid ? `kolvox_playlists_backup_${user.uid}` : null;
      if (userKey) {
        const backup = localStorage.getItem(userKey);
        if (backup) setPlaylists(JSON.parse(backup));
      }
    } catch {}
  };

  const handleCreateAndAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlinePlaylistName.trim() || !selectedSongForPlaylist) return;
    setIsCreatingInline(true);
    const authToken = token || localStorage.getItem('kolvox_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    try {
      const createRes = await fetch('/api/playlists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          name: inlinePlaylistName.trim(),
          initialSongIds: [selectedSongForPlaylist.id],
        }),
      });

      const data = await createRes.json().catch(() => ({}));
      if (createRes.ok && data.playlist) {
        setAddToPlaylistSuccess('Repertório criado e música adicionada!');
        setTimeout(() => {
          setSelectedSongForPlaylist(null);
          setAddToPlaylistSuccess(null);
          setShowCreatePlaylistInline(false);
          setInlinePlaylistName('');
        }, 1300);
        return;
      } else {
        alert(data.error || 'Erro ao criar repertório.');
      }
    } catch (err) {
      console.error('Error creating playlist inline:', err);
      alert('Erro de conexão ao criar repertório.');
    } finally {
      setIsCreatingInline(false);
    }
  };

  const handleAddSongToPlaylist = async (playlistId: number) => {
    if (!selectedSongForPlaylist) return;
    const authToken = token || localStorage.getItem('kolvox_token');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ songId: selectedSongForPlaylist.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddToPlaylistSuccess('Música adicionada ao repertório!');
        setTimeout(() => {
          setSelectedSongForPlaylist(null);
          setAddToPlaylistSuccess(null);
        }, 1200);
      } else {
        alert(data.error || 'Erro ao adicionar ao repertório.');
      }
    } catch (err) {
      alert('Erro de conexão ao salvar no repertório.');
    }
  };

  // Helper to ensure song details (chords and lyrics) are fully loaded before download
  const fetchFullSongIfNeeded = async (song: Song): Promise<Song> => {
    if ((song.chords && song.chords.length > 10) || (song.lyrics && song.lyrics.length > 10)) {
      return song;
    }
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/songs/${song.id}`, { headers });
      if (res.ok) {
        const fullSong = await res.json();
        return { ...song, ...fullSong };
      }
    } catch (e) {
      console.warn('Error fetching full song from API, trying catalog seed:', e);
    }
    try {
      const catalogSong = getCatalogSongById(song.id);
      if (catalogSong) {
        return { ...song, ...catalogSong } as any;
      }
    } catch (err) {
      console.warn('Catalog getSong notice:', err);
    }
    return song;
  };

  // Option 1: Download ONLY the lyrics
  const handleDownloadOnlyLyrics = async (song: Song) => {
    const fullSong = await fetchFullSongIfNeeded(song);
    downloadLyricsOnly(fullSong);
    setAddToPlaylistSuccess(`Letra de "${song.title}" baixada com sucesso!`);
    setTimeout(() => setAddToPlaylistSuccess(null), 3000);
  };

  // Option 2: Download Chords AND Lyrics (for bar and live performers)
  const handleDownloadLyricsAndChords = async (song: Song) => {
    const fullSong = await fetchFullSongIfNeeded(song);
    downloadChordsAndLyrics(fullSong);
    setAddToPlaylistSuccess(`Cifra e Letra de "${song.title}" baixada com sucesso!`);
    setTimeout(() => setAddToPlaylistSuccess(null), 3000);
  };

  // Handle smart import from URL or pasted text
  const handleSmartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setImportMessage({ type: 'error', text: 'Você precisa estar logado para importar cifras.' });
      return;
    }

    if (!importUrl.trim() && !importText.trim()) {
      setImportMessage({ type: 'error', text: 'Insira um link do Cifra Club / Vagalume ou cole o texto da cifra.' });
      return;
    }

    setImportLoading(true);
    setImportMessage(null);

    try {
      const res = await fetch('/api/songs/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: importUrl.trim() || undefined,
          rawText: importText.trim() || undefined,
          defaultTitle: importDefaultTitle.trim() || undefined,
          defaultArtist: importDefaultArtist.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportMessage({ type: 'success', text: data.message || 'Música importada com sucesso!' });
        setImportUrl('');
        setImportText('');
        setImportDefaultTitle('');
        setImportDefaultArtist('');
        // Refresh search results
        performSearch(query, selectedGenre);
        setTimeout(() => {
          setShowImportModal(false);
          setImportMessage(null);
          if (data.song) {
            onOpenSongInStage(data.song);
          }
        }, 1500);
      } else {
        setImportMessage({ type: 'error', text: data.error || 'Erro ao importar cifra/letra.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: 'Erro de conexão ao comunicar com o servidor.' });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Search Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold mb-3 border border-emerald-500/20">
              <Search className="w-3.5 h-3.5" />
              <span>PESQUISA UNIFICADA DE REPERTÓRIO & CIFRAS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
              O que você quer tocar hoje?
            </h1>

            <p className="text-sm text-zinc-400 mt-2">
              Pesquise por música, artista, álbum, gênero, tom ou trecho da letra. Pesquise e importe diretamente do <strong>Cifra Club</strong> e <strong>Vagalume</strong>.
            </p>
          </div>

          {/* Import Modal Trigger Button */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="self-start md:self-auto px-4 py-2.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-colors flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>IMPORTAR CIFRA / LETRA</span>
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleFormSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 flex items-center">
            <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-search-music"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome da música, cantor, banda ou tom..."
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-2xl pl-12 pr-11 py-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400 shadow-inner transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition-colors"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            id="btn-search-submit"
            className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>PESQUISAR</span>
          </button>
        </form>

        {/* Live Search Status & Popular Suggestions */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-amber-400 animate-pulse flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Buscando músicas automaticamente em tempo real...</span>
              </span>
            ) : query.trim() ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Busca ao vivo: {filteredResults.length} músicas trazidas para a tela</span>
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
                <span>Digite qualquer letra ou nome de música para carregar automaticamente</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Clickable Suggestions Pills */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-zinc-500 shrink-0 mr-1 font-semibold flex items-center gap-1">
            ⚡ Sugestões:
          </span>
          {popularSuggestions.map((songName) => {
            const isSelected = query.toLowerCase() === songName.toLowerCase();
            return (
              <button
                key={songName}
                type="button"
                onClick={() => {
                  const nextQuery = isSelected ? '' : songName;
                  setQuery(nextQuery);
                  performSearch(nextQuery, selectedGenre);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-xs'
                    : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-amber-400/50 hover:text-amber-300'
                }`}
              >
                {songName}
              </button>
            );
          })}
        </div>

        {/* External Providers Quick Links */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Globe className="w-4 h-4 text-zinc-500" />
            <span>Fontes Oficiais:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCifraClubSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition-colors"
              title="Pesquisar no site oficial Cifra Club"
            >
              <span>🎸 Pesquisar no Cifra Club</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={openVagalumeSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold transition-colors"
              title="Pesquisar no site oficial Vagalume"
            >
              <span>🎤 Pesquisar no Vagalume</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Tabs: Todas | Músicas | Artistas | Álbuns */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-zinc-800/80 pt-3">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Categoria:</span>
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'musicas', label: 'Músicas' },
            { id: 'artistas', label: 'Artistas' },
            { id: 'albuns', label: 'Álbuns' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryTab(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryTab === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'bg-zinc-800/70 hover:bg-zinc-700 text-zinc-400 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Format Filter: Todas | Letra + Cifra | Somente Letra (User Request) */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Exibição:</span>
          {[
            { id: 'todas', label: 'Todas as Opções' },
            { id: 'cifra_letra', label: '🎸 Letra + Cifra' },
            { id: 'somente_letra', label: '📄 Somente Letra' },
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setFormatFilter(fmt.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                formatFilter === fmt.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border border-purple-400/40'
                  : 'bg-zinc-800/70 hover:bg-zinc-700 text-zinc-400 border border-transparent'
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        {/* Source Provider Tabs */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-t border-zinc-800/60 pt-3">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">Fonte:</span>
          {providerFilters.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(p.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedProvider === p.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Quick Genre Filter Pills */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1" />
          {genreFilters.map((genre) => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedGenre === genre.id
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          Encontradas <strong className="text-white">{filteredResults.length}</strong> músicas correspondentes
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Filtro de Legalidade Ativo • Fontes Licenciadas</span>
        </div>
      </div>

      {/* Results Cards List */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Buscando nas fontes autorizadas (Cifra Club, Vagalume e acervo)...
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8">
          <Music className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-zinc-200">Nenhuma música encontrada</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto mb-4">
            Tente pesquisar diretamente no Cifra Club ou Vagalume e importe a cifra com um clique para seu palco.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={openCifraClubSearch}
              className="px-4 py-2 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold hover:bg-orange-500/30 transition-colors flex items-center gap-1.5"
            >
              <span>Buscar no Cifra Club ↗</span>
            </button>
            <button
              type="button"
              onClick={openVagalumeSearch}
              className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
            >
              <span>Buscar no Vagalume ↗</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importar Cifra / Letra</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((song) => {
            const isCifraClub = (song.sourceProvider || '').toLowerCase().includes('cifra') || (song.sourceUrl && song.sourceUrl.includes('cifraclub'));
            const isVagalume = (song.sourceProvider || '').toLowerCase().includes('vagalume') || (song.sourceUrl && song.sourceUrl.includes('vagalume'));
            const readySong = enrichSong(song);

            return (
              <div
                key={song.id}
                id={`song-card-${song.id}`}
                className="kolvox-card p-4 sm:p-5 flex flex-col justify-between gap-4 overflow-hidden group hover:border-[#1e6bb8] transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Song Cover Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-blue-900 to-[#030914] border border-[#0b5a9d] overflow-hidden flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <Music className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_8px_rgba(49,214,255,0.6)]" />
                  </div>

                  {/* Song Meta Information */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-extrabold text-white truncate">{song.title}</h3>
                      <span className="text-sm font-semibold text-zinc-400">• {song.artist}</span>
                      {song.genre && (
                        <span className="text-[11px] bg-blue-950 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-md font-medium">
                          {song.genre}
                        </span>
                      )}

                      {/* Source Provider Badges */}
                      {isCifraClub && (
                        <a
                          href={song.sourceUrl || 'https://www.cifraclub.com.br/'}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[11px] bg-orange-950/60 text-orange-400 border border-orange-700/50 px-2 py-0.5 rounded-md font-bold hover:bg-orange-900/60 transition-colors"
                        >
                          <span>🎸 Cifra Club</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {isVagalume && (
                        <a
                          href={song.sourceUrl || 'https://www.vagalume.com.br/'}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[11px] bg-blue-950/60 text-blue-400 border border-blue-700/50 px-2 py-0.5 rounded-md font-bold hover:bg-blue-900/60 transition-colors"
                        >
                          <span>🎤 Vagalume</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {song.key && (
                        <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-mono font-bold border border-amber-500/20">
                          Tom: {song.key}
                        </span>
                      )}

                      {song.capo !== undefined && song.capo > 0 && (
                        <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
                          Capo: {song.capo}ª
                        </span>
                      )}

                      {/* Availability Badges */}
                      <span className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                        song.hasChords ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        <Music2 className="w-3 h-3" /> Letra + Cifra
                      </span>

                      <span className="px-2 py-0.5 rounded flex items-center gap-1 font-medium bg-cyan-500/10 text-cyan-300">
                        <BookOpen className="w-3 h-3" /> Somente Letra
                      </span>
                    </div>

                    {/* Source & Legal Notice */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                      <span>Fonte: <strong className="text-zinc-400">{song.sourceProvider || 'Catálogo Verificado'}</strong></span>
                      <span>•</span>
                      <span>{song.licenseType || 'Licenciado'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons matching mockup */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/80">
                  {/* 1. ABRIR */}
                  <button
                    id={`btn-open-${song.id}`}
                    onClick={() => onOpenSongDetails(readySong)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
                  >
                    ABRIR
                  </button>

                  {/* 2. SÓ LETRA (User specific request: show lyrics only without chords) */}
                  <button
                    id={`btn-lyrics-only-${song.id}`}
                    onClick={() => onOpenSongInStage({ ...readySong, chords: '' })}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                    title="Exibir somente a letra da música sem as cifras"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>SÓ LETRA</span>
                  </button>

                  {/* 3. MODO SHOW / MODO PALCO */}
                  <button
                    id={`btn-stage-${song.id}`}
                    onClick={() => onOpenSongInStage(readySong)}
                    className="kolvox-btn-primary px-4 py-2 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>MODO SHOW</span>
                  </button>

                  {/* 4. MODO VIOLÃO */}
                  <button
                    id={`btn-guitar-${song.id}`}
                    onClick={() => onOpenSongInGuitar(readySong)}
                    className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Guitar className="w-3.5 h-3.5" />
                    <span>VIOLÃO</span>
                  </button>

                  {/* 5. ADICIONAR AO REPERTÓRIO */}
                  <button
                    id={`btn-add-playlist-${song.id}`}
                    onClick={() => openPlaylistPicker(readySong)}
                    className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>REPERTÓRIO</span>
                  </button>

                  {/* 6. FAVORITAR */}
                  <button
                    id={`btn-fav-${song.id}`}
                    onClick={() => handleToggleFavorite(readySong)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
                      song.isFavorite
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
                    }`}
                    title="Favoritar música"
                  >
                    <Star className={`w-4 h-4 ${song.isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  {/* 6. VER FONTE OFICIAL */}
                  {song.sourceUrl && (
                    <a
                      id={`link-source-${song.id}`}
                      href={song.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
                      title="Ver Fonte Oficial"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Dedicated Musician Download Bar */}
              <div className="bg-zinc-950/70 border-t border-zinc-800/80 -mt-2 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Opções de Download:</span>
                  </span>

                  {/* Opção 1: Baixar Somente a Letra */}
                  <button
                    id={`btn-download-lyrics-${song.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadOnlyLyrics(song);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-sky-200 border border-sky-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                    title="Baixar somente a letra da música (.txt) limpa sem cifras - Ideal para cantores e vocalistas"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>Baixar Somente a Letra (.txt)</span>
                  </button>

                  {/* Opção 2: Baixar Letra e Cifra para quem toca em barzinho */}
                  <button
                    id={`btn-download-chords-${song.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadLyricsAndChords(song);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                    title="Baixar letra e cifra completa com tom, capotraste e alinhamento (.txt) - Ideal para quem toca em barzinho"
                  >
                    <Guitar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Baixar Letra e Cifra (Barzinho) (.txt)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300">
                    {song.key ? `Tom: ${song.key}` : 'Tom original'}
                  </span>
                  <span className="hidden sm:inline italic">
                    Pronto para imprimir ou abrir no celular
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <UploadCloud className="w-5 h-5 text-purple-400" />
                <span>Importar Cifra / Letra</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportMessage(null);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Importe cifras e letras colando a URL direta do <strong>Cifra Club</strong> ou <strong>Vagalume</strong>, ou colando o texto diretamente.
            </p>

            {importMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                importMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950/60 border border-red-800 text-red-300'
              }`}>
                {importMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                <span>{importMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSmartImport} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Link do Cifra Club ou Vagalume (Opcional)
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="ex: https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-2 mt-1.5 text-[11px] text-zinc-500">
                  <span>Exemplos:</span>
                  <button
                    type="button"
                    onClick={() => setImportUrl('https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/')}
                    className="text-purple-400 hover:underline"
                  >
                    Cifra Club
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setImportUrl('https://www.vagalume.com.br/elis-regina/como-nossos-pais.html')}
                    className="text-blue-400 hover:underline"
                  >
                    Vagalume
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Nome da Música (Opcional)
                  </label>
                  <input
                    type="text"
                    value={importDefaultTitle}
                    onChange={(e) => setImportDefaultTitle(e.target.value)}
                    placeholder="ex: Tempo Perdido"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Artista / Banda (Opcional)
                  </label>
                  <input
                    type="text"
                    value={importDefaultArtist}
                    onChange={(e) => setImportDefaultArtist(e.target.value)}
                    placeholder="ex: Legião Urbana"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Ou Cole o Texto da Cifra / Letra
                </label>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Tom: G&#10;&#10;[Intro] G  C  D&#10;&#10;G                C&#10;Cole a cifra ou letra aqui..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-hidden focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportMessage(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5"
                >
                  {importLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span>{importLoading ? 'Importando...' : 'Importar para Meu Palco'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add To Playlist Selector Dialog */}
      {selectedSongForPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Adicionar ao Repertório
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Selecione em qual setlist você quer incluir "<strong>{selectedSongForPlaylist.title}</strong>":
            </p>

            {addToPlaylistSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                <span>{addToPlaylistSuccess}</span>
              </div>
            ) : showCreatePlaylistInline ? (
              <form onSubmit={handleCreateAndAddPlaylist} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nome do Novo Repertório
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={inlinePlaylistName}
                    onChange={(e) => setInlinePlaylistName(e.target.value)}
                    placeholder="Ex: Show Sábado, Culto de Domingo"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylistInline(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingInline}
                    className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs"
                  >
                    {isCreatingInline ? 'Criando...' : 'Criar e Adicionar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-1">
                  <span className="text-xs text-zinc-400">Seus repertórios:</span>
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylistInline(true)}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    + Criar Novo
                  </button>
                </div>

                {playlists.length === 0 ? (
                  <div className="text-center py-5 bg-zinc-950/60 rounded-2xl border border-zinc-800/80 p-4">
                    <p className="text-xs text-zinc-400 mb-3">
                      Você ainda não possui repertórios criados.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreatePlaylistInline(true)}
                      className="px-4 py-2 bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-300 transition-colors"
                    >
                      + Criar Primeiro Repertório
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={() => handleAddSongToPlaylist(pl.id)}
                        className="w-full p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-left transition-colors"
                      >
                        <div>
                          <div className="text-sm font-bold text-zinc-200">{pl.name}</div>
                          <div className="text-xs text-zinc-500">{pl.songCount || 0} músicas</div>
                        </div>
                        <span className="text-xs text-amber-400 font-bold">+ Adicionar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedSongForPlaylist(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
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

