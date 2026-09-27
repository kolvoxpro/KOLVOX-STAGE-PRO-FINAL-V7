import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ShowModeView } from './components/ShowModeView';
import { MusicSearchView } from './components/MusicSearchView';
import { SongDetailModal } from './components/SongDetailModal';
import { Song, Playlist, Recording } from './types/kolvox';
import { KolvoxLogo } from './components/KolvoxLogo';
import { SettingsView } from './components/SettingsView';
import { SupportView } from './components/SupportView';
import { AdminPanel } from './components/AdminPanel';
import { TrialExpiredLockModal } from './components/TrialExpiredLockModal';
import { AddSongToSetlistModal } from './components/AddSongToSetlistModal';
import { SelectSetlistForSongModal } from './components/SelectSetlistForSongModal';
import { MediaRecordingStudio } from './components/MediaRecordingStudio';
import { VideoPlaybackModal } from './components/VideoPlaybackModal';
import { SubscriptionView } from './components/SubscriptionView';
import { ListMusic, Video, Mic, Film, Plus, Check, Search, Music, Sparkles, Loader2 } from 'lucide-react';
import { musicSearchProvider } from './services/MusicSearchProvider';
import { findVerifiedFullLyrics } from './data/fullLyricsCatalog';
import confetti from 'canvas-confetti';
import {
  getUserSongs,
  getUserPlaylists,
  getUserRecordings,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deleteSongFromLibrary,
  deletePlaylist,
  deleteRecording,
  saveSongToLibrary,
  saveRecording,
} from './services/DatabaseService';

export default function App() {
  const {
    user,
    userProfile,
    loading,
    logout,
    isAdmin,
    isPremiumActive,
    isTrialActive,
    isTrialExpired,
    trialDaysLeft,
    trialHoursLeft,
  } = useAuth();

  // Navigation: 'home' | 'search' | 'library' | 'setlists' | 'recordings' | 'favorites' | 'settings'
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [quickSearchInput, setQuickSearchInput] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Song for Show Mode
  const [activeShowSong, setActiveShowSong] = useState<Song | null>(null);
  const [activeShowPlaylist, setActiveShowPlaylist] = useState<{
    name: string;
    songs: Song[];
    currentIndex: number;
  } | undefined>(undefined);

  // Active Song for Preview Modal
  const [previewSong, setPreviewSong] = useState<Song | null>(null);

  // Data: STRICTLY isolated per user account. New accounts start with 0 songs and 0 setlists.
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [deletedSongIds, setDeletedSongIds] = useState<string[]>([]);

  // Modals & UI helpers
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [addSongModalTab, setAddSongModalTab] = useState<'manual' | 'catalog'>('manual');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState<any[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogAddedIds, setCatalogAddedIds] = useState<string[]>([]);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongLyrics, setNewSongLyrics] = useState('');
  const [newSongKey, setNewSongKey] = useState('');

  const [showCreateSetlistModal, setShowCreateSetlistModal] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');

  // Setlist Specific Modals
  const [showShowModePickerModal, setShowShowModePickerModal] = useState(false);
  const [showAddToSetlistModal, setShowAddToSetlistModal] = useState(false);
  const [songToAddToSetlist, setSongToAddToSetlist] = useState<Song | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<Recording | null>(null);
  const [addToSetlistTab, setAddToSetlistTab] = useState<'global' | 'library' | 'new'>('global');
  const [filterLibrarySearch, setFilterLibrarySearch] = useState('');

  // Auth modal overlay state (e.g. from final links, header button, or subscription view)
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'plans'>('login');

  // Drag and Drop reordering state for setlist tracks
  const [draggedSongIndex, setDraggedSongIndex] = useState<number | null>(null);
  const [dragOverSongIndex, setDragOverSongIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Theme on mount
  useEffect(() => {
    const currentTheme = localStorage.getItem('kolvox_setting_stage_theme') || 'neon_cyan';
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
  }, []);

  // Audio playback for recordings
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Clear legacy global un-scoped keys on startup so they never pollute new accounts
  useEffect(() => {
    try {
      localStorage.removeItem('kolvox_local_user_songs');
      localStorage.removeItem('kolvox_local_user_playlists');
      localStorage.removeItem('kolvox_playlists_backup');
      localStorage.removeItem('kolvox_deleted_song_ids');
    } catch {}
  }, []);

  // Load User Data & Local Cache strictly scoped to the logged-in user
  useEffect(() => {
    let isMounted = true;

    // Immediately clear all user state when account changes to prevent any cross-account leakage
    setUserSongs([]);
    setPlaylists([]);
    setRecordings([]);
    setSelectedPlaylistId(null);
    setDeletedSongIds([]);

    const loadData = async () => {
      // If no user is logged in, keep everything empty
      if (!user) {
        return;
      }

      // Canonical account key strictly based on normalized email (or user.uid if no email)
      const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
      const uid = user.uid;

      const userSongsKey = `kolvox_user_songs_${accountKey}`;
      const userPlaylistsKey = `kolvox_user_playlists_${accountKey}`;
      const userDeletedKey = `kolvox_deleted_songs_${accountKey}`;

      try {
        let loadedSongs: Song[] = [];
        let loadedPlaylists: Playlist[] = [];
        let loadedRecordings: Recording[] = [];
        let loadedDeletedIds: string[] = [];

        // Load local songs scoped strictly to THIS user email/account only
        try {
          const localSongs =
            localStorage.getItem(userSongsKey) ||
            (uid !== accountKey ? localStorage.getItem(`kolvox_user_songs_${uid}`) : null);
          if (localSongs) {
            loadedSongs = JSON.parse(localSongs);
          }
        } catch {}

        // Load local playlists scoped strictly to THIS user email/account only
        try {
          const localPlStr = localStorage.getItem(userPlaylistsKey);
          if (localPlStr) {
            const parsed = JSON.parse(localPlStr);
            if (Array.isArray(parsed)) {
              // Ensure playlists belong strictly to this specific user account
              loadedPlaylists = parsed.filter((p: Playlist) => {
                if (p.user_email && p.user_email.toLowerCase().trim() !== accountKey) return false;
                if (!p.user_email && p.user_id && p.user_id !== uid) return false;
                return true;
              }).map((p: Playlist) => ({
                ...p,
                user_email: accountKey,
              }));
            }
          }
        } catch {}

        try {
          const localDel =
            localStorage.getItem(userDeletedKey) ||
            (uid !== accountKey ? localStorage.getItem(`kolvox_deleted_songs_${uid}`) : null);
          if (localDel) {
            loadedDeletedIds = JSON.parse(localDel);
          }
        } catch {}

        // Fetch DB data strictly for this specific user
        const [dbSongs, dbPlaylists, dbRecordings] = await Promise.all([
          getUserSongs(uid),
          getUserPlaylists(uid, accountKey),
          getUserRecordings(uid),
        ]);

        // Merge unique songs by ID for this user only
        const songMap = new Map<string, Song>();
        loadedSongs.forEach((s) => songMap.set(s.id, s));
        dbSongs.forEach((s) => songMap.set(s.id, s));
        loadedSongs = Array.from(songMap.values());

        // Merge playlists preserving songs strictly for this account
        const plMap = new Map<string, Playlist>();
        loadedPlaylists.forEach((p) => plMap.set(p.id, p));
        dbPlaylists.forEach((p) => {
          // Strictly verify that this db playlist belongs to this user account
          if (p.user_email && p.user_email.toLowerCase().trim() !== accountKey) return;
          if (!p.user_email && p.user_id && p.user_id !== uid) return;

          const existing = plMap.get(p.id);
          const mergedSongs = p.songs && p.songs.length > 0 ? p.songs : existing?.songs || [];
          plMap.set(p.id, {
            ...p,
            user_id: uid,
            user_email: accountKey,
            songs: mergedSongs,
            song_count: mergedSongs.length,
          });
        });
        loadedPlaylists = Array.from(plMap.values());
        loadedRecordings = dbRecordings;

        // STRICT ACCOUNT ISOLATION:
        // Do NOT auto-seed setlists across accounts.
        // Each email and account has its own individual list and starts with 0 setlists.

        if (isMounted) {
          setUserSongs(loadedSongs);
          setPlaylists(loadedPlaylists);
          setRecordings(loadedRecordings);
          setDeletedSongIds(loadedDeletedIds);
          if (loadedPlaylists.length > 0) {
            setSelectedPlaylistId((prev) =>
              prev && loadedPlaylists.some((p) => p.id === prev) ? prev : loadedPlaylists[0].id
            );
          } else {
            setSelectedPlaylistId(null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch data:', err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Listen for final links or URL params/hash to open login/register modal immediately
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase();
      const hasAuthParam =
        urlParams.get('login') === 'true' ||
        urlParams.get('auth') === 'true' ||
        urlParams.get('openAuth') === 'true' ||
        urlParams.get('register') === 'true' ||
        urlParams.get('action') === 'login' ||
        urlParams.get('action') === 'register' ||
        urlParams.get('final') === 'true' ||
        hash.includes('login') ||
        hash.includes('auth') ||
        hash.includes('cadastro') ||
        hash.includes('criar-conta');

      if (hasAuthParam) {
        if (
          urlParams.get('register') === 'true' ||
          urlParams.get('action') === 'register' ||
          hash.includes('cadastro') ||
          hash.includes('criar-conta')
        ) {
          setAuthModalMode('register');
        } else {
          setAuthModalMode('login');
        }
        setShowAuthModal(true);
      }
    } catch {
      // safe fallback
    }
  }, []);

  // Keep local storage in sync for current user only
  useEffect(() => {
    if (!user) return;
    const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
    try {
      localStorage.setItem(`kolvox_user_songs_${accountKey}`, JSON.stringify(userSongs));
      if (user.uid && user.uid !== accountKey) {
        localStorage.setItem(`kolvox_user_songs_${user.uid}`, JSON.stringify(userSongs));
      }
    } catch {}
  }, [userSongs, user]);

  // Keep playlists in sync with localStorage for current user only
  useEffect(() => {
    if (!user) return;
    const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
    try {
      localStorage.setItem(`kolvox_user_playlists_${accountKey}`, JSON.stringify(playlists));
    } catch {}
  }, [playlists, user]);

  // Combined Songs: STRICTLY User's library only (no auto-population of default songs)
  const allLibrarySongs = React.useMemo(() => {
    return userSongs.filter((s) => !deletedSongIds.includes(s.id));
  }, [userSongs, deletedSongIds]);

  // Instant deletion on click as requested:
  const handleDeleteSong = async (songId: string) => {
    if (user) {
      const next = [...deletedSongIds, songId];
      setDeletedSongIds(next);
      try {
        localStorage.setItem(`kolvox_deleted_songs_${user.uid}`, JSON.stringify(next));
      } catch {}
    }
    setUserSongs((prev) => prev.filter((s) => s.id !== songId));
    setFavorites((prev) => prev.filter((id) => id !== songId));
    // Also remove from all local playlists
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (!pl.songs?.some((s) => s.id === songId)) return pl;
        const nextSongs = (pl.songs || []).filter((s) => s.id !== songId);
        return { ...pl, songs: nextSongs, song_count: nextSongs.length };
      })
    );
    showToast('Música excluída da biblioteca.');
    if (user) {
      try {
        await deleteSongFromLibrary(user.uid, songId);
      } catch (err) {
        console.warn('Silent delete from db:', err);
      }
    }
  };

  const handleDeleteRecording = async (recId: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== recId));
    showToast('Gravação de áudio excluída.');
    if (user) {
      try {
        await deleteRecording(user.uid, recId);
      } catch (err) {
        console.warn('Silent delete recording:', err);
      }
    }
  };

  const activeSetlist = React.useMemo(() => {
    return playlists.find((p) => p.id === selectedPlaylistId) || playlists[0] || null;
  }, [playlists, selectedPlaylistId]);

  // Delete Setlist with INSTANT feedback (strictly for current account)
  const handleDeletePlaylist = async (playlistId: string, playlistName: string) => {
    const nextPlaylists = playlists.filter((p) => p.id !== playlistId);
    setPlaylists(nextPlaylists);
    if (user) {
      const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
      try {
        localStorage.setItem(`kolvox_user_playlists_${accountKey}`, JSON.stringify(nextPlaylists));
      } catch {}
    }

    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(nextPlaylists.length > 0 ? nextPlaylists[0].id : null);
    }

    showToast(`Setlist "${playlistName}" excluído com sucesso!`);

    // Async background sync
    try {
      await deletePlaylist(user?.uid || 'guest', playlistId);
    } catch (err) {
      console.warn('Silent delete playlist error:', err);
    }
    try {
      const token = localStorage.getItem('kolvox_token');
      await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
  };

  // Add song to setlist
  const handleAddSongToSetlist = async (playlistId: string, song: Song) => {
    let added = false;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const currentSongs = pl.songs || [];
        if (currentSongs.some((s) => s.id === song.id)) {
          showToast(`"${song.title}" já está neste setlist!`);
          return pl;
        }
        added = true;
        const updatedSongs = [...currentSongs, song];
        return {
          ...pl,
          songs: updatedSongs,
          song_count: updatedSongs.length,
          updated_at: new Date().toISOString(),
        };
      })
    );

    if (added) {
      showToast(`"${song.title}" adicionada ao setlist!`);
      confetti({ particleCount: 25, spread: 50 });
      if (user) {
        try {
          await addSongToPlaylist(user.uid, playlistId, song.id, song);
        } catch (err) {
          console.warn('Silent add song to playlist db:', err);
        }
      }
    }
  };

  // Remove song from setlist
  const handleRemoveSongFromSetlist = async (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const updatedSongs = (pl.songs || []).filter((s) => s.id !== songId);
        return {
          ...pl,
          songs: updatedSongs,
          song_count: updatedSongs.length,
          updated_at: new Date().toISOString(),
        };
      })
    );
    showToast('Música removida do setlist.');

    if (user) {
      try {
        await removeSongFromPlaylist(user.uid, playlistId, songId);
      } catch (err) {
        console.warn('Silent remove song from playlist db:', err);
      }
    }
  };

  // Reorder songs in setlist (Drag & Drop swap/reorder)
  const handleReorderPlaylistSongs = (playlistId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setPlaylists((prev) => {
      const next = prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const songs = [...(pl.songs || [])];
        if (fromIndex >= songs.length || toIndex >= songs.length) return pl;
        const [movedSong] = songs.splice(fromIndex, 1);
        songs.splice(toIndex, 0, movedSong);
        return {
          ...pl,
          songs,
          song_count: songs.length,
          updated_at: new Date().toISOString(),
        };
      });

      if (user) {
        const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
        try {
          localStorage.setItem(`kolvox_user_playlists_${accountKey}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    showToast('Ordem do repertório atualizada!');
  };

  // Drag and drop event handlers
  const handleSongDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSongIndex(index);
  };

  const handleSongDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSongIndex === null) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const isBottom = relY > rect.height / 2;

    if (dragOverSongIndex !== index || dragOverPosition !== (isBottom ? 'bottom' : 'top')) {
      setDragOverSongIndex(index);
      setDragOverPosition(isBottom ? 'bottom' : 'top');
    }
  };

  const handleSongDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSongIndex === null || !activeSetlist) {
      setDraggedSongIndex(null);
      setDragOverSongIndex(null);
      setDragOverPosition(null);
      return;
    }

    const fromIndex = draggedSongIndex;
    let toIndex = targetIndex;

    if (dragOverPosition === 'bottom' && fromIndex < targetIndex) {
      toIndex = targetIndex;
    } else if (dragOverPosition === 'bottom' && fromIndex > targetIndex) {
      toIndex = Math.min((activeSetlist.songs?.length || 1) - 1, targetIndex + 1);
    } else if (dragOverPosition === 'top' && fromIndex < targetIndex) {
      toIndex = Math.max(0, targetIndex - 1);
    }

    if (fromIndex !== toIndex) {
      handleReorderPlaylistSongs(activeSetlist.id, fromIndex, toIndex);
    }

    setDraggedSongIndex(null);
    setDragOverSongIndex(null);
    setDragOverPosition(null);
  };

  const handleSongDragEnd = () => {
    setDraggedSongIndex(null);
    setDragOverSongIndex(null);
    setDragOverPosition(null);
  };

  // Touch reordering for tablets/phones
  const handleSongTouchStart = (_e: React.TouchEvent, index: number) => {
    setDraggedSongIndex(index);
    setDragOverSongIndex(index);
  };

  const handleSongTouchMove = (e: React.TouchEvent) => {
    if (draggedSongIndex === null || !activeSetlist?.songs) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const trackElement = targetElement?.closest('[data-track-index]') as HTMLElement | null;
    if (trackElement) {
      const idxAttr = trackElement.getAttribute('data-track-index');
      if (idxAttr !== null) {
        const idx = parseInt(idxAttr, 10);
        if (!isNaN(idx) && idx !== dragOverSongIndex) {
          setDragOverSongIndex(idx);
        }
      }
    }
  };

  const handleSongTouchEnd = () => {
    if (draggedSongIndex !== null && dragOverSongIndex !== null && activeSetlist && draggedSongIndex !== dragOverSongIndex) {
      handleReorderPlaylistSongs(activeSetlist.id, draggedSongIndex, dragOverSongIndex);
    }
    setDraggedSongIndex(null);
    setDragOverSongIndex(null);
    setDragOverPosition(null);
  };

  // Quick reorder move up/down
  const handleMoveSong = (playlistId: string, fromIndex: number, toIndex: number) => {
    handleReorderPlaylistSongs(playlistId, fromIndex, toIndex);
  };

  // Seed sample songs matching the screenshot for "Rock em Replay"
  const handleSeedRockEmReplaySongs = (targetPlaylistId?: string) => {
    const defaultSongs: Song[] = [
      {
        id: 'pl_song_cbjr_te_levar',
        user_id: user?.uid || 'guest',
        title: 'Te Levar Daqui',
        artist: 'Charlie Brown Jr.',
        lyrics: `[Intro]\nAm  F  C  G\n\n[Verso 1]\nAm             F\nFaço da dificuldade a minha motivação\nC                  G\nA volta por cima vem na continuação\nAm                     F\nO que se leva dessa vida é o que se vive, é o que se faz\nC              G\nSaber chegar pra depois saber sair em paz\n\n[Refrão]\nAm         F\nMe dê a mão, vem cá!\nC               G\nVou te levar daqui!\nAm         F\nMe dê a mão, vem cá!\nC               G\nVou te levar daqui!`,
        key_signature: 'Am',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_cbjr_lugar_ao_sol',
        user_id: user?.uid || 'guest',
        title: 'Lugar ao Sol',
        artist: 'Charlie Brown Jr.',
        lyrics: `[Intro]\nG  Em  C  D\n\n[Verso 1]\nG                     Em\nO dia nasce, mais uma chance pra tentar\nC                     D\nBuscar meu rumo, encontrar o meu lugar\n\n[Refrão]\nG          Em\nUm lugar ao sol\nC          D\nOnde eu possa sonhar`,
        key_signature: 'G',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_raimundos_mulher_de_fases',
        user_id: user?.uid || 'guest',
        title: 'Mulher de Fases (Ao Vivo)',
        artist: 'Raimundos',
        lyrics: `[Intro]\nA  D  E  A\n\n[Verso 1]\nA                     D\nQue mulher ruim, jogou minhas coisas fora\nE                      A\nDisse que em sua cama eu não deito mais\n\n[Refrão]\nA       D          E       A\nComplicada e perfeitinha!`,
        key_signature: 'A',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_raimundos_eu_quero_ver_o_oco',
        user_id: user?.uid || 'guest',
        title: 'Eu Quero Ver o Oco (Ao Vivo)',
        artist: 'Raimundos',
        lyrics: `[Intro]\nE  G  A  E\n\n[Verso 1]\nE\nFui bater na porta dela bem cedinho pra chamar\n\n[Refrão]\nE                G   A\nEu quero ver o oco!`,
        key_signature: 'E',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_raimundos_i_saw_you_saying',
        user_id: user?.uid || 'guest',
        title: 'I Saw You Saying (That You Say That You Saw) [Ao Vivo]',
        artist: 'Raimundos',
        lyrics: `[Intro]\nC  G  Am  F\n\n[Refrão]\nC         G             Am   F\nI saw you saying that you say that you saw!`,
        key_signature: 'C',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_detonautas_outro_lugar',
        user_id: user?.uid || 'guest',
        title: 'Outro Lugar',
        artist: 'Detonautas',
        lyrics: `[Intro]\nBm  G  D  A\n\n[Verso 1]\nBm              G\nOlho pra trás e vejo o quanto eu caminhei\nD               A\nProcuro um abrigo onde eu me encontrei\n\n[Refrão]\nBm       G        D         A\nMe leve para outro lugar!`,
        key_signature: 'Bm',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_nxzero_so_rezo',
        user_id: user?.uid || 'guest',
        title: 'Só Rezo (Ao Vivo)',
        artist: 'NX Zero',
        lyrics: `[Intro]\nDm  Bb  F  C\n\n[Verso 1]\nDm             Bb\nEm meio ao caos eu tento encontrar a paz\nF              C\nCaminhos que me levem onde o sol se faz\n\n[Refrão]\nDm     Bb     F      C\nEu só rezo pra poder seguir!`,
        key_signature: 'Dm',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_nxzero_cedo_ou_tarde',
        user_id: user?.uid || 'guest',
        title: 'Cedo Ou Tarde',
        artist: 'NX Zero',
        lyrics: `[Intro]\nC  G  Am  F\n\n[Verso 1]\nC               G\nComo um dia de chuva que logo vai passar\nAm              F\nO tempo cura tudo se a gente acreditar\n\n[Refrão]\nC         G             Am        F\nCedo ou tarde a gente vai se encontrar!`,
        key_signature: 'C',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_cpm22_um_minuto',
        user_id: user?.uid || 'guest',
        title: 'Um Minuto Para o Fim do Mundo',
        artist: 'CPM 22',
        lyrics: `[Intro]\nE  B  C#m  A\n\n[Verso 1]\nE              B\nMeus olhos já não podem ver\nC#m            A\nO que restou daquela ilusão\n\n[Refrão]\nE              B\nUm minuto para o fim do mundo\nC#m            A\nToda sua vida em sessenta segundos!`,
        key_signature: 'E',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pl_song_cpm22_dias_atras',
        user_id: user?.uid || 'guest',
        title: 'Dias Atrás',
        artist: 'CPM 22',
        lyrics: `[Intro]\nG  D  Em  C\n\n[Verso 1]\nG             D\nQuantas vezes eu pensei em voltar atrás\nEm            C\nMas hoje sei que o tempo não volta mais\n\n[Refrão]\nG          D\nDias atrás eu era outro alguém\nEm         C\nBuscando a paz que me convém!`,
        key_signature: 'G',
        source: 'Setlist',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    if (targetPlaylistId) {
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== targetPlaylistId) return pl;
          return {
            ...pl,
            songs: defaultSongs,
            song_count: defaultSongs.length,
            updated_at: new Date().toISOString(),
          };
        })
      );
    } else {
      const newPlId = 'pl_' + Date.now();
      const accountEmail = (user?.email || user?.uid || 'guest').toLowerCase().trim();
      const newPl: Playlist = {
        id: newPlId,
        user_id: user?.uid || 'guest',
        user_email: accountEmail,
        name: 'Rock em Replay',
        song_count: defaultSongs.length,
        songs: defaultSongs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPlaylists((prev) => [newPl, ...prev]);
      setSelectedPlaylistId(newPlId);
    }

    showToast('Repertório "Rock em Replay" carregado com 10 músicas!');
    confetti({ particleCount: 35, spread: 60 });
  };

  // Open song in Show Mode strictly with setlist or library songs (no random songs)
  const handleOpenSongInShowMode = (
    song: Song,
    playlistContext?: { name: string; songs: Song[]; currentIndex: number }
  ) => {
    let poolSongs: Song[] = [];
    if (playlistContext?.songs && playlistContext.songs.length > 0) {
      poolSongs = playlistContext.songs;
    } else if (activeSetlist?.songs && activeSetlist.songs.length > 0) {
      poolSongs = activeSetlist.songs;
    } else if (allLibrarySongs.length > 0) {
      poolSongs = allLibrarySongs;
    } else {
      poolSongs = [song];
    }

    const songIndex = playlistContext?.currentIndex !== undefined
      ? playlistContext.currentIndex
      : Math.max(0, poolSongs.findIndex((s) => s.id === song.id));

    const finalPlaylist = {
      name: playlistContext?.name || activeSetlist?.name || 'Repertório do Show',
      songs: poolSongs,
      currentIndex: songIndex !== -1 ? songIndex : 0,
    };

    setActiveShowSong(song);
    setActiveShowPlaylist(finalPlaylist);
    setPreviewSong(null);
  };

  // Triggered when user clicks "Modo Show" anywhere in the app
  const handleOpenShowModeNavigation = () => {
    setShowShowModePickerModal(true);
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearchInput.trim()) {
      setCurrentPage('search');
    }
  };

  const handleCreateSongSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim()) return;

    try {
      const songPayload = {
        title: newSongTitle.trim(),
        artist: newSongArtist.trim() || 'Artista',
        lyrics: newSongLyrics.trim() || 'Letra da música',
        source: 'Manual',
        key_signature: newSongKey.trim(),
      };

      let createdSong: Song;
      if (user) {
        createdSong = await saveSongToLibrary(user.uid, songPayload);
      } else {
        const now = new Date().toISOString();
        createdSong = {
          id: 'song_' + Date.now(),
          user_id: 'guest',
          ...songPayload,
          created_at: now,
          updated_at: now,
        };
      }

      setUserSongs((prev) => [createdSong, ...prev]);
      setShowAddSongModal(false);
      setNewSongTitle('');
      setNewSongArtist('');
      setNewSongLyrics('');
      setNewSongKey('');
      showToast(`Música "${createdSong.title}" cadastrada na biblioteca!`);
      confetti({ particleCount: 35, spread: 60 });
    } catch (err) {
      console.error('Failed to create song:', err);
    }
  };

  const handleSearchCatalogForLibrary = async (q: string) => {
    setCatalogSearchQuery(q);
    if (!q.trim()) {
      setCatalogSearchResults([]);
      return;
    }
    setCatalogSearching(true);
    try {
      const results = await musicSearchProvider.search(q.trim(), 'Todas');
      setCatalogSearchResults(results);
    } catch (err) {
      console.error('Catalog search error:', err);
    } finally {
      setCatalogSearching(false);
    }
  };

  const handleAddCatalogSongToLibrary = async (item: any) => {
    let fullLyrics = item.lyrics;
    if (!fullLyrics || fullLyrics.length < 50) {
      const verified = findVerifiedFullLyrics(item.title, item.artist);
      if (verified?.lyrics) {
        fullLyrics = verified.lyrics;
      } else {
        try {
          const fetched = await musicSearchProvider.getLyrics(item.title, item.artist);
          if (fetched && fetched.length > 50) fullLyrics = fetched;
        } catch {}
      }
    }

    const songPayload = {
      title: item.title,
      artist: item.artist,
      lyrics: fullLyrics || 'Letra da música',
      source: item.source || 'Catálogo Oficial',
      key_signature: item.key_signature || '',
      cover_url: item.cover || item.coverUrl,
    };

    let created: Song;
    if (user) {
      created = await saveSongToLibrary(user.uid, songPayload);
    } else {
      const now = new Date().toISOString();
      created = {
        id: 'song_' + Date.now(),
        user_id: 'guest',
        ...songPayload,
        created_at: now,
        updated_at: now,
      };
    }

    setUserSongs((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
    setCatalogAddedIds((prev) => [...prev, item.id]);
    showToast(`"${created.title}" adicionada separadamente à Minha Biblioteca!`);
    confetti({ particleCount: 30, spread: 60 });
  };

  const handleCreateSongForActiveSetlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim() || !activeSetlist) return;

    try {
      const songPayload = {
        title: newSongTitle.trim(),
        artist: newSongArtist.trim() || 'Artista',
        lyrics: newSongLyrics.trim() || 'Letra da música',
        source: 'Manual',
        key_signature: newSongKey.trim(),
      };

      let createdSong: Song;
      if (user) {
        createdSong = await saveSongToLibrary(user.uid, songPayload);
      } else {
        const now = new Date().toISOString();
        createdSong = {
          id: 'song_' + Date.now(),
          user_id: 'guest',
          ...songPayload,
          created_at: now,
          updated_at: now,
        };
      }

      setUserSongs((prev) => [createdSong, ...prev]);
      await handleAddSongToSetlist(activeSetlist.id, createdSong);
      setNewSongTitle('');
      setNewSongArtist('');
      setNewSongLyrics('');
      setNewSongKey('');
      setShowAddToSetlistModal(false);
    } catch (err) {
      console.error('Failed to create song for setlist:', err);
    }
  };

  const handleCreateSetlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetlistName.trim() || !user) return;

    const accountKey = (user.email || user.uid || 'guest').toLowerCase().trim();
    const now = new Date().toISOString();
    const newPlaylistId = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newPlaylist: Playlist = {
      id: newPlaylistId,
      user_id: user.uid,
      user_email: accountKey,
      name: newSetlistName.trim(),
      created_at: now,
      updated_at: now,
      song_count: 0,
      songs: [],
    };

    try {
      const created = await createPlaylist(user.uid, newSetlistName.trim(), accountKey);
      if (created?.id) {
        newPlaylist.id = created.id;
      }
    } catch (err) {
      console.warn('Silent fallback playlist create:', err);
    }

    const nextPlaylists = [newPlaylist, ...playlists];
    setPlaylists(nextPlaylists);
    setSelectedPlaylistId(newPlaylist.id);
    setShowCreateSetlistModal(false);
    setNewSetlistName('');

    try {
      localStorage.setItem(`kolvox_user_playlists_${accountKey}`, JSON.stringify(nextPlaylists));
    } catch {}

    showToast(`Setlist "${newPlaylist.name}" criado com sucesso!`);
    confetti({ particleCount: 30, spread: 60 });
  };

  const playRecordingAudio = (recording: Recording) => {
    if (audioElement) {
      audioElement.pause();
    }
    const audio = new Audio(recording.file_url);
    audio.onended = () => setPlayingRecordingId(null);
    audio.play().catch((err) => console.warn('Playback error:', err));
    setAudioElement(audio);
    setPlayingRecordingId(recording.id);
  };

  const stopRecordingAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setPlayingRecordingId(null);
  };

  const downloadRecordingMedia = (recording: Recording) => {
    try {
      const a = document.createElement('a');
      a.href = recording.file_url;
      const isVideo =
        recording.media_type === 'video' ||
        (recording.file_url && recording.file_url.startsWith('data:video'));
      const safeTitle = (recording.song_title || (isVideo ? 'filmagem' : 'gravacao'))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const ext = isVideo ? 'webm' : 'webm';
      a.download = `kolvox_${safeTitle}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const downloadRecordingAudio = downloadRecordingMedia;

  const handleSaveNewRecording = async (recData: {
    song_id?: string;
    song_title: string;
    song_artist?: string;
    file_url: string;
    duration: number;
    media_type: 'audio' | 'video';
  }) => {
    try {
      const saved = await saveRecording(user?.uid || 'guest', recData);
      setRecordings((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('Error saving recording:', err);
    }
  };

  const togglePlayRecording = (recording: Recording) => {
    if (playingRecordingId === recording.id) {
      stopRecordingAudio();
    } else {
      playRecordingAudio(recording);
    }
  };

  const toggleFavorite = (songId: string) => {
    setFavorites((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#03050a] flex flex-col items-center justify-center p-4">
        <KolvoxLogo size="lg" className="mb-6" />
        <div className="w-10 h-10 border-2 border-[#08a8ff] border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-xs font-mono uppercase tracking-widest text-[#8190a8]">
          Carregando palco digital...
        </div>
      </div>
    );
  }

  // If user is not authenticated, show the Login Screen
  if (!user) {
    return (
      <>
        <div className="background-effects">
          <div className="glow glow-1" />
          <div className="glow glow-2" />
          <div className="grid-background" />
        </div>
        <AuthModal initialMode={authModalMode} />
      </>
    );
  }

  // If 7-day trial is expired for customer/guest, block access completely until payment is completed/recognized
  if (isTrialExpired && !isAdmin && !isPremiumActive) {
    return (
      <>
        <div className="background-effects">
          <div className="glow glow-1" />
          <div className="glow glow-2" />
          <div className="grid-background" />
        </div>
        <TrialExpiredLockModal onOpenSupport={() => setCurrentPage('support')} />
      </>
    );
  }

  const userName = userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Vocalista';
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* FUNDO */}
      <div className="background-effects">
        <div className="glow glow-1" />
        <div className="glow glow-2" />
        <div className="grid-background" />
      </div>

      {/* APP SCREEN */}
      <div id="appScreen" className="app-screen">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo-wrap cursor-pointer flex items-center justify-center py-2" onClick={() => setCurrentPage('home')}>
            <KolvoxLogo size="lg" />
          </div>

          <nav>
            <button
              id="kolvox-nav-home"
              onClick={() => setCurrentPage('home')}
              className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
            >
              <span>⌂</span>
              <span>Início</span>
            </button>

            <button
              id="kolvox-nav-search"
              onClick={() => setCurrentPage('search')}
              className={`nav-item ${currentPage === 'search' ? 'active' : ''}`}
            >
              <span>🔍</span>
              <span>Pesquisar</span>
            </button>

            <button
              id="kolvox-nav-library"
              onClick={() => setCurrentPage('library')}
              className={`nav-item ${currentPage === 'library' ? 'active' : ''}`}
            >
              <span>📄</span>
              <span>Minha Biblioteca</span>
            </button>

            <button
              id="kolvox-nav-setlists"
              onClick={() => setCurrentPage('setlists')}
              className={`nav-item ${currentPage === 'setlists' ? 'active' : ''}`}
            >
              <span>📋</span>
              <span>Setlists</span>
            </button>

            <button
              id="kolvox-nav-recordings"
              onClick={() => setCurrentPage('recordings')}
              className={`nav-item ${currentPage === 'recordings' ? 'active' : ''}`}
            >
              <span>🎙</span>
              <span>Gravações</span>
            </button>

            <button
              id="kolvox-nav-favorites"
              onClick={() => setCurrentPage('favorites')}
              className={`nav-item ${currentPage === 'favorites' ? 'active' : ''}`}
            >
              <span>♡</span>
              <span>Favoritos</span>
            </button>

            <button
              id="kolvox-nav-showmode"
              onClick={handleOpenShowModeNavigation}
              className="nav-item show-nav"
            >
              <span>🎧</span>
              <span>Modo Show</span>
            </button>

            <button
              id="kolvox-nav-settings"
              onClick={() => setCurrentPage('settings')}
              className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            >
              <span>⚙</span>
              <span>Configurações</span>
            </button>

            <button
              id="kolvox-nav-support"
              onClick={() => setCurrentPage('support')}
              className={`nav-item ${currentPage === 'support' ? 'active' : ''}`}
            >
              <span>🎧</span>
              <span>Suporte</span>
            </button>

            <button
              id="kolvox-nav-plans"
              onClick={() => setCurrentPage('plans')}
              className={`nav-item ${currentPage === 'plans' ? 'active' : ''}`}
              style={{ color: '#00e5ff' }}
            >
              <span>💎</span>
              <span>Planos Pagos & Pix</span>
            </button>

            {isAdmin && (
              <button
                id="kolvox-nav-admin"
                onClick={() => setCurrentPage('admin')}
                className={`nav-item ${currentPage === 'admin' ? 'active' : ''}`}
                style={{ color: '#fbbf24' }}
              >
                <span>🛡️</span>
                <span>Painel Admin</span>
              </button>
            )}
          </nav>

          <div className="sidebar-user">
            <div className="avatar">{userInitials}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--ink-muted)' }}>
                {isAdmin
                  ? 'Administrador'
                  : isPremiumActive
                  ? 'Plano PRO'
                  : `Teste (${trialDaysLeft}d)`}
              </div>
            </div>

            <button onClick={logout} title="Sair da conta">
              ↪
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          {/* TOPBAR */}
          <header className="topbar">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div
                className="mobile-brand cursor-pointer flex items-center shrink-0"
                onClick={() => setCurrentPage('home')}
              >
                <KolvoxLogo size="md" />
              </div>

              {/* Status do Plano & Tempo para Expirar */}
              {isAdmin ? (
                <div className="admin-badge text-[10px] sm:text-xs px-2 py-0.5 whitespace-nowrap">
                  <span className="hidden sm:inline">Conta </span>Admin
                </div>
              ) : isPremiumActive ? (
                <div
                  className="admin-badge text-[10px] sm:text-xs px-2 py-0.5 whitespace-nowrap"
                  style={{ color: 'rgb(52, 211, 153)', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }}
                >
                  👑 <span className="hidden sm:inline">Plano </span>PRO
                </div>
              ) : (
                <div
                  className="admin-badge text-[10px] sm:text-xs px-2 py-0.5 whitespace-nowrap"
                  style={{ color: 'rgb(251, 191, 36)', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }}
                >
                  ⏱ <span className="hidden sm:inline">Teste: </span>{trialDaysLeft}d {trialHoursLeft}h
                </div>
              )}
            </div>

            {/* AÇÕES DESKTOP */}
            <div className="top-actions hidden md:flex items-center gap-2">
              {isAdmin && (
                <button
                  id="topbar-admin-btn"
                  className="btn-primary"
                  style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink-faint)', fontSize: '0.75rem', padding: '0.45rem 0.9rem' }}
                  onClick={() => setCurrentPage('admin')}
                >
                  🛡️ Admin
                </button>
              )}

              <button
                id="topbar-plans-btn"
                className="btn-primary flex items-center gap-1.5"
                style={{
                  background: isPremiumActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 229, 255, 0.15)',
                  color: isPremiumActive ? '#10b981' : '#00e5ff',
                  border: `1px solid ${isPremiumActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 229, 255, 0.4)'}`,
                  fontSize: '0.75rem',
                  padding: '0.45rem 0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                onClick={() => setCurrentPage('plans')}
                title="Planos Pagos & Pix"
              >
                <span>💎</span>
                <span>{isPremiumActive ? '👑 Plano PRO' : 'Planos & Pix'}</span>
              </button>

              <button
                id="topbar-support-btn"
                className="btn-icon"
                title="Suporte"
                onClick={() => setCurrentPage('support')}
              >
                🎧
              </button>

              <button
                className="btn-icon"
                title="Novo item"
                onClick={() => setShowAddSongModal(true)}
              >
                +
              </button>

              <button
                className="btn-icon"
                title="Modo Show"
                onClick={handleOpenShowModeNavigation}
              >
                🎤
              </button>
            </div>

            {/* AÇÕES MOBILE COMPACTAS (SEM ESTOURAR A TELA) */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center justify-center text-sm font-bold active:scale-95 cursor-pointer"
                title="Adicionar Música"
                onClick={() => setShowAddSongModal(true)}
              >
                +
              </button>

              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center justify-center text-sm active:scale-95 shadow-sm cursor-pointer"
                title="Modo Show"
                onClick={handleOpenShowModeNavigation}
              >
                🎤
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="w-8 h-8 rounded-lg bg-cyan-500 text-zinc-950 font-black text-xs flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                title="Abrir Menu e Perfil"
              >
                {userInitials}
              </button>
            </div>
          </header>

          {/* ==================================================== */}
          {/* PÁGINA: INÍCIO (HOME) */}
          {/* ==================================================== */}
          {currentPage === 'home' && (
            <section className="page home-page">
              <div className="welcome">
                <span className="small-label">PAINEL DO VOCALISTA</span>
                <h1>
                  Olá, <span>{userName}</span>!
                </h1>
                <p>Encontre suas músicas, crie seus setlists e prepare sua performance.</p>

                {/* BUSCA RÁPIDA */}
                <form onSubmit={handleQuickSearchSubmit} className="search-box">
                  <span>⌕</span>
                  <input
                    type="text"
                    placeholder="Pesquisar música, artista ou trecho..."
                    value={quickSearchInput}
                    onChange={(e) => setQuickSearchInput(e.target.value)}
                  />
                  <button type="submit">Ir</button>
                </form>
              </div>

              {/* HERO CARD */}
              <div className="hero-card">
                <div className="hero-content">
                  <span className="small-label">PREPARE SUA PERFORMANCE</span>
                  <h2>Seu show começa aqui</h2>
                  <p>
                    Abra o teleprompter com rolagem automática contínua, velocidade
                    customizável e gravação de áudio da performance ao vivo.
                  </p>
                  <button
                    className="primary-button cursor-pointer"
                    onClick={() => {
                      if (allLibrarySongs.length > 0) {
                        handleOpenSongInShowMode(allLibrarySongs[0]);
                      } else {
                        setShowAddSongModal(true);
                      }
                    }}
                  >
                    ABRIR MODO SHOW
                  </button>
                </div>
                <div className="hero-light" />
              </div>

              {/* DASHBOARD GRID */}
              <div className="dashboard-grid">
                {/* CARD 1: ÚLTIMAS MÚSICAS */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3>Últimas músicas</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('library')}
                      className="text-xs text-blue-400 bg-transparent hover:underline"
                    >
                      Ver todas
                    </button>
                  </div>

                  <div className="flex flex-col">
                    {allLibrarySongs.length > 0 ? (
                      allLibrarySongs.slice(0, 4).map((s) => (
                        <div key={s.id} className="song-row items-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSong(s.id)}
                            title="Excluir música"
                            className="delete-front-btn"
                          >
                            <span>🗑</span>
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                          <div className="song-cover">♫</div>
                          <div className="flex-1 min-w-0">
                            <strong>{s.title}</strong>
                            <small>{s.artist}</small>
                          </div>
                          <button
                            onClick={() => handleOpenSongInShowMode(s)}
                            title="Tocar no Modo Show"
                          >
                            ▶
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-[#8190a8] flex flex-col items-center gap-1.5">
                        <span className="text-2xl">🎵</span>
                        <span>Nenhuma música na biblioteca.</span>
                        <button
                          onClick={() => setShowAddSongModal(true)}
                          className="text-xs text-blue-400 bg-transparent hover:underline mt-1"
                        >
                          + Adicionar música
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD 2: MEU ÚLTIMO SETLIST */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3>Meu último Setlist</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('setlists')}
                      className="text-xs text-blue-400 bg-transparent hover:underline"
                    >
                      Ver todos
                    </button>
                  </div>

                  <div className="setlist-preview">
                    <div className="setlist-cover">♫</div>
                    <div>
                      <strong>{activeSetlist ? activeSetlist.name : 'Show Acústico'}</strong>
                      <small>
                        {activeSetlist
                          ? `${activeSetlist.song_count || allLibrarySongs.length} músicas`
                          : '4 músicas cadastradas'}
                      </small>
                    </div>
                  </div>

                  <button
                    className="outline-button w-full justify-center"
                    onClick={() => setCurrentPage('setlists')}
                  >
                    Ver Setlist Completo
                  </button>
                </div>

                {/* CARD 3: ÚLTIMAS GRAVAÇÕES */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3>Últimas gravações</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentPage('recordings')}
                      className="text-xs text-blue-400 bg-transparent hover:underline"
                    >
                      Ver todas
                    </button>
                  </div>

                  <div className="flex flex-col">
                    {recordings.length > 0 ? (
                      recordings.slice(0, 3).map((r) => (
                        <div key={r.id} className="song-row items-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRecording(r.id)}
                            title="Excluir gravação"
                            className="delete-front-btn"
                          >
                            <span>🗑</span>
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                          <button
                            onClick={() => togglePlayRecording(r)}
                            className="play-small"
                          >
                            {playingRecordingId === r.id ? '❚❚' : '▶'}
                          </button>
                          <div className="flex-1 min-w-0">
                            <strong>{r.song_title}</strong>
                            <small>{r.duration}s de áudio</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-[#8190a8] flex flex-col items-center gap-1.5">
                        <span className="text-2xl">🎙️</span>
                        <span>Nenhuma gravação recente.</span>
                        <span className="text-[11px] text-[#55657e]">Grave suas performances ao vivo no Modo Show.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: PESQUISAR (SEARCH) */}
          {/* ==================================================== */}
          {currentPage === 'search' && (
            <section className="page search-page">
              <div className="page-title">
                <div>
                  <span className="small-label">CATÁLOGO GLOBAL</span>
                  <h1>Pesquisar músicas</h1>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setShowAddSongModal(true)}
                >
                  + Adicionar Manualmente
                </button>
              </div>

              <MusicSearchView
                onOpenSongInShowMode={handleOpenSongInShowMode}
                onOpenSongInPreview={(s) => setPreviewSong(s)}
                onAddSongToSetlistPrompt={() => setCurrentPage('setlists')}
                onSongAddedToLibrary={(song) => {
                  setUserSongs((prev) => [song, ...prev.filter((s) => s.id !== song.id)]);
                }}
              />
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: MINHA BIBLIOTECA (LIBRARY) */}
          {/* ==================================================== */}
          {currentPage === 'library' && (
            <section className="page library-page">
              <div className="page-title">
                <div>
                  <span className="small-label">REPERTÓRIO PESSOAL</span>
                  <h1>Minha Biblioteca</h1>
                </div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setAddSongModalTab('manual');
                    setShowAddSongModal(true);
                  }}
                >
                  + Adicionar música
                </button>
              </div>

              {/* BARRA DE SETLIST ALVO / ORGANIZAÇÃO */}
              <div className="bg-[#050f1d]/90 border border-blue-900/40 rounded-2xl p-3.5 px-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <ListMusic className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Setlist Ativo:
                      </span>
                      {playlists.length > 0 ? (
                        <select
                          value={activeSetlist?.id || ''}
                          onChange={(e) => setSelectedPlaylistId(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 hover:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none cursor-pointer"
                        >
                          {playlists.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.name} ({pl.songs?.length ?? pl.song_count ?? 0} faixas)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Nenhum setlist criado</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Cada música clicada em <strong className="text-amber-300">+ Setlist</strong> é adicionada individualmente ao setlist ativo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCreateSetlistModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Novo Setlist</span>
                  </button>
                  {activeSetlist && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage('setlists')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Abrir Setlists ({activeSetlist.songs?.length ?? activeSetlist.song_count ?? 0})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="library-grid">
                {allLibrarySongs.length === 0 ? (
                  <div className="col-span-full py-16 text-center bg-[#050f1d]/70 border border-[#0d4d82]/40 rounded-3xl p-8 flex flex-col items-center">
                    <div className="text-4xl mb-3">🎵</div>
                    <h3 className="text-white font-bold text-lg mb-1">Sua biblioteca está vazia</h3>
                    <p className="text-xs text-[#8190a8] max-w-sm mx-auto mb-5 leading-relaxed">
                      Nenhuma música cadastrada ainda. Adicione músicas clicando no botão abaixo ou pesquisando no catálogo.
                    </p>
                    <button
                      onClick={() => {
                        setAddSongModalTab('manual');
                        setShowAddSongModal(true);
                      }}
                      className="primary-button inline-flex items-center gap-2"
                    >
                      + Adicionar música
                    </button>
                  </div>
                ) : (
                  allLibrarySongs.map((s) => {
                  const isFav = favorites.includes(s.id);
                  const isAlreadyInActiveSetlist = Boolean(
                    activeSetlist?.songs?.some((track) => track.id === s.id)
                  );
                  return (
                    <div key={s.id} className="library-card">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteSong(s.id)}
                          title="Excluir música"
                          className="delete-front-btn"
                        >
                          <span>🗑</span>
                          <span>Excluir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(s.id)}
                          className="text-lg text-amber-400 bg-transparent p-1"
                          title="Favoritar"
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>
                      <h3>{s.title}</h3>
                      <p>{s.artist}</p>
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => handleOpenSongInShowMode(s)}
                          className="hover:border-blue-400 flex-1"
                        >
                          Abrir no Modo Show
                        </button>

                        {/* BOTÃO ADICIONAR SEPARADAMENTE À SETLIST */}
                        {isAlreadyInActiveSetlist ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeSetlist) {
                                handleRemoveSongFromSetlist(activeSetlist.id, s.id);
                                showToast(`"${s.title}" removida do setlist "${activeSetlist.name}".`);
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                            title={`Música incluída no setlist "${activeSetlist?.name}". Clique para remover se desejar.`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>✓ No Setlist</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!activeSetlist) {
                                setSongToAddToSetlist(s);
                                return;
                              }
                              await handleAddSongToSetlist(activeSetlist.id, s);
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                            title={activeSetlist ? `Adicionar individualmente ao setlist "${activeSetlist.name}"` : 'Adicionar à Minha Setlist'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Setlist</span>
                          </button>
                        )}

                        {/* ESCOLHER OUTRO SETLIST */}
                        <button
                          type="button"
                          onClick={() => setSongToAddToSetlist(s)}
                          className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-400 hover:text-white text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Escolher outro setlist para esta música..."
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: MEUS SETLISTS (SETLISTS) - VARIATION 2       */}
          {/* ==================================================== */}
          {currentPage === 'setlists' && (
            <div className="page">
              <span className="label block text-center sm:text-left mx-auto sm:mx-0">ORGANIZAÇÃO DE PALCO</span>
              <div className="flex flex-col sm:flex-row justify-center sm:justify-between items-center text-center sm:text-left flex-wrap gap-3 mb-6">
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white m-0 text-center sm:text-left">
                  Meus Setlists
                </h1>
                <button
                  className="btn-accent w-full sm:w-auto justify-center"
                  onClick={() => setShowCreateSetlistModal(true)}
                >
                  + Novo Setlist
                </button>
              </div>

              <div className="layout">
                {/* COLUNA ESQUERDA: LISTA DE SETLISTS */}
                <div className="setlists-column">
                  {playlists.length > 0 ? (
                    playlists.map((pl) => {
                      const songCount = pl.songs?.length ?? pl.song_count ?? 0;
                      const isActive = selectedPlaylistId === pl.id;
                      return (
                        <div
                          key={pl.id}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className={`setlist-item ${isActive ? 'active' : ''}`}
                        >
                          <div>
                            <div className="track-title">{pl.name}</div>
                            <div className="track-artist">
                              {songCount} {songCount === 1 ? 'música' : 'músicas'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(pl.id, pl.name);
                            }}
                            className="btn-delete"
                            title={`Excluir setlist "${pl.name}"`}
                          >
                            Excluir
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      onClick={() => setShowCreateSetlistModal(true)}
                      className="setlist-item active cursor-pointer"
                    >
                      <div>
                        <div className="track-title">Nenhum setlist criado</div>
                        <div className="track-artist" style={{ color: 'var(--accent)' }}>
                          Clique para criar seu primeiro setlist
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* COLUNA DIREITA: DETALHES DO SETLIST */}
                <div className="setlist-detail card">
                  <div className="setlist-detail-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                      {activeSetlist ? activeSetlist.name : 'Nenhum Setlist Selecionado'}
                    </h3>
                    {activeSetlist && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          background: '#f4f4f5',
                          color: '#09090b',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          padding: '0.55rem 1.15rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                        onClick={() => {
                          setAddToSetlistTab('global');
                          setShowAddToSetlistModal(true);
                        }}
                      >
                        + ADICIONAR MÚSICA
                      </button>
                    )}
                  </div>

                  {activeSetlist && (!activeSetlist.songs || activeSetlist.songs.length === 0) ? (
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-3 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-sm my-4">
                      <span className="font-mono text-cyan-400 text-2xl font-bold">00</span>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">Este setlist está vazio</h4>
                        <p className="text-xs text-zinc-400 max-w-sm">
                          Adicione músicas do Catálogo Global ou carregue o repertório clássico "Rock em Replay" para organizar a ordem das faixas arrastando e soltando.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleSeedRockEmReplaySongs(activeSetlist.id)}
                          className="btn-accent"
                          style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                        >
                          ✨ Carregar 10 Músicas do "Rock em Replay"
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddToSetlistTab('global');
                            setShowAddToSetlistModal(true);
                          }}
                          className="btn-primary"
                          style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink)', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                        >
                          + Pesquisar no Catálogo Global
                        </button>
                      </div>
                    </div>
                  ) : activeSetlist?.songs && activeSetlist.songs.length > 0 ? (
                    <div className="track-list" role="list">
                      {activeSetlist.songs.map((track, idx) => {
                        const isFloating = draggedSongIndex === idx;
                        const isTargetTop = dragOverSongIndex === idx && dragOverPosition === 'top';
                        const isTargetBottom = dragOverSongIndex === idx && dragOverPosition === 'bottom';

                        return (
                          <div
                            key={track.id}
                            data-track-index={idx}
                            draggable={true}
                            onDragStart={(e) => handleSongDragStart(e, idx)}
                            onDragOver={(e) => handleSongDragOver(e, idx)}
                            onDrop={(e) => handleSongDrop(e, idx)}
                            onDragEnd={handleSongDragEnd}
                            onTouchStart={(e) => handleSongTouchStart(e, idx)}
                            onTouchMove={handleSongTouchMove}
                            onTouchEnd={handleSongTouchEnd}
                            className={`track is-draggable group ${isFloating ? 'is-floating' : ''} ${isTargetTop ? 'drag-target-top' : ''} ${isTargetBottom ? 'drag-target-bottom' : ''}`}
                            style={{
                              cursor: isFloating ? 'grabbing' : 'grab',
                              transition: isFloating ? 'none' : 'transform 0.16s ease, background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                            }}
                            title="Arraste para reposicionar no setlist"
                          >
                            {/* Botão Handle de arrastar flutuante */}
                            <div
                              className="track-drag-handle"
                              title="Arraste para mover e trocar de lugar no repertório"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="5" cy="3.5" r="1.25" />
                                <circle cx="11" cy="3.5" r="1.25" />
                                <circle cx="5" cy="8" r="1.25" />
                                <circle cx="11" cy="8" r="1.25" />
                                <circle cx="5" cy="12.5" r="1.25" />
                                <circle cx="11" cy="12.5" r="1.25" />
                              </svg>
                            </div>

                            {/* Número da faixa em Ciano Neon mono */}
                            <span className="track-num">{String(idx + 1).padStart(2, '0')}</span>

                            {/* Informações da Música */}
                            <div className="track-info">
                              <div className="track-title">{track.title}</div>
                              <div className="track-artist">{track.artist}</div>
                            </div>

                            {/* Controles de subir/descer e remover */}
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveSong(activeSetlist.id, idx, idx - 1);
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-[10px] transition-colors"
                                title="Subir na ordem"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === (activeSetlist.songs?.length || 0) - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveSong(activeSetlist.id, idx, idx + 1);
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-[10px] transition-colors"
                                title="Descer na ordem"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSongFromSetlist(activeSetlist.id, track.id);
                                }}
                                className="w-7 h-7 rounded flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:border-rose-500/40 text-xs transition-colors ml-1"
                                title="Remover deste setlist"
                              >
                                🗑
                              </button>
                            </div>

                            {/* Botão Tocar no Modo Show */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSongInShowMode(track, {
                                  name: activeSetlist.name,
                                  songs: activeSetlist.songs || [],
                                  currentIndex: idx,
                                });
                              }}
                              className="w-8 h-8 rounded bg-[#121319] border border-zinc-800/90 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
                              title="Tocar no Modo Show"
                            >
                              <span className="text-xs ml-0.5">▶</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-zinc-500 text-sm font-mono">
                      Selecione ou crie um setlist para gerenciar as músicas.
                    </div>
                  )}

                  <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn-primary"
                      style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--ink)' }}
                      onClick={() => {
                        if (activeSetlist) {
                          setAddToSetlistTab('global');
                          setShowAddToSetlistModal(true);
                        } else {
                          setShowCreateSetlistModal(true);
                        }
                      }}
                    >
                      Adicionar música
                    </button>
                    <button
                      className="btn-accent"
                      onClick={() => {
                        if (activeSetlist && activeSetlist.songs && activeSetlist.songs.length > 0) {
                          handleOpenSongInShowMode(activeSetlist.songs[0], {
                            name: activeSetlist.name,
                            songs: activeSetlist.songs,
                            currentIndex: 0,
                          });
                        } else {
                          if (activeSetlist) {
                            setShowAddToSetlistModal(true);
                            showToast(`Adicione músicas ao setlist "${activeSetlist.name}" para iniciar o show.`);
                          } else {
                            setShowCreateSetlistModal(true);
                          }
                        }
                      }}
                    >
                      Iniciar Setlist ▶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: MINHAS GRAVAÇÕES (RECORDINGS) - VARIATION 8 */}
          {/* ==================================================== */}
          {currentPage === 'recordings' && (
            <section className="page recordings-page space-y-8">
              <div className="page-title !border-b-0 !pb-0 !mb-0">
                <div>
                  <div className="font-['JetBrains_Mono',monospace] text-[0.68rem] uppercase tracking-[0.16em] text-[#00e5ff] font-semibold mb-1.5">
                    Performance Management
                  </div>
                  <h1 className="font-['Syne',sans-serif] text-3xl sm:text-5xl font-extrabold tracking-tight text-white m-0 leading-none">
                    Minhas Gravações
                  </h1>
                </div>
              </div>

              {/* Estúdio de Gravação HD (Variation 8 Studio Box) */}
              <MediaRecordingStudio
                userSongs={allLibrarySongs}
                userId={user?.uid}
                onSaveRecording={handleSaveNewRecording}
                onShowToast={showToast}
              />

              {/* Seção Histórico de Gravações */}
              <section className="border-t border-white/10 pt-8">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-5 font-['JetBrains_Mono',monospace] tracking-wider">
                  <span>HISTÓRICO DE GRAVAÇÕES ({recordings.length})</span>
                  <span className="text-[#00e5ff]">ALTA FIDELIDADE</span>
                </div>

                {recordings.length > 0 ? (
                  <div className="recordings-list flex flex-col gap-3">
                    {recordings.map((rec) => {
                      const isVideo =
                        rec.media_type === 'video' ||
                        (rec.file_url && rec.file_url.startsWith('data:video'));
                      const isPlaying = playingRecordingId === rec.id;

                      return (
                        <div
                          key={rec.id}
                          className="recording-card flex items-center gap-3 p-4 rounded-2xl bg-[#0f172a]/90 border border-white/10 hover:border-[#00e5ff]/50 flex-wrap sm:flex-nowrap shadow-lg transition-all"
                        >
                          {/* BOTÃO EXCLUIR */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRecording(rec.id)}
                            title="Excluir gravação"
                            className="delete-front-btn mr-1 shrink-0 cursor-pointer"
                          >
                            <span>🗑</span>
                            <span>Excluir</span>
                          </button>

                          {/* PLAY BUTTON FOR VIDEO OR AUDIO */}
                          {isVideo ? (
                            <button
                              type="button"
                              onClick={() => setActiveVideoModal(rec)}
                              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 bg-gradient-to-r from-[#00e5ff] to-blue-500 hover:from-[#38bdf8] hover:to-blue-400 text-[#020617] shadow-md shadow-[#00e5ff]/25"
                              title="Assistir à Filmagem em Vídeo HD"
                            >
                              <span className="text-sm">▶</span>
                              <span>Assistir Filmagem</span>
                            </button>
                          ) : (
                            <>
                              {/* BOTÃO INICIAR (PLAY) */}
                              <button
                                type="button"
                                onClick={() => playRecordingAudio(rec)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                                  isPlaying
                                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                                    : 'bg-[#020617] hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
                                }`}
                                title="Iniciar reprodução do áudio gravado"
                              >
                                <span className="text-sm">▶</span>
                                <span>Iniciar</span>
                              </button>

                              {/* BOTÃO PARAR (STOP) */}
                              <button
                                type="button"
                                onClick={stopRecordingAudio}
                                disabled={!isPlaying}
                                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                  isPlaying
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 cursor-pointer'
                                    : 'bg-[#020617] text-zinc-600 border border-white/5 cursor-not-allowed opacity-50'
                                }`}
                                title="Parar áudio gravado"
                              >
                                <span className="text-xs">⏹</span>
                                <span>Parar</span>
                              </button>
                            </>
                          )}

                          {/* DETALHES DO ITEM */}
                          <div className="flex-1 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <strong className="block text-white text-sm font-semibold truncate">
                                {rec.song_title}
                              </strong>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 font-mono ${
                                  isVideo
                                    ? 'bg-cyan-500/20 text-[#00e5ff] border border-cyan-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {isVideo ? '📹 Filmagem HD' : '🎙️ Áudio HD'}
                              </span>
                            </div>
                            <small className="text-xs text-slate-400 font-mono">
                              {Math.round(rec.duration || 0)}s de {isVideo ? 'filmagem' : 'áudio'} • Limitador Dinâmico
                            </small>
                          </div>

                          {/* BOTÃO DE DOWNLOAD */}
                          <button
                            type="button"
                            onClick={() => downloadRecordingMedia(rec)}
                            className="px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-[#00e5ff] hover:text-white border border-[#00e5ff]/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                            title="Baixar gravação para o dispositivo"
                          >
                            <span className="text-sm">📥</span>
                            <span>Baixar {isVideo ? 'Vídeo' : 'Áudio'}</span>
                          </button>

                          <div className="recording-wave text-[#00e5ff] font-mono text-xs hidden lg:block">
                            {isPlaying ? '▅▇▃▂▆▅▃▇▅▃' : '▁▃▆▂▅▇▃▂▆▅'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state text-center py-16 px-6 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl max-w-xl mx-auto space-y-3">
                    <span className="icon text-5xl block opacity-40 mb-2">🎙️</span>
                    <h3 className="text-base font-bold text-white font-['Syne',sans-serif]">
                      Nenhuma gravação realizada
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                      Use o estúdio acima para registrar sua voz ou filmar seus ensaios com qualidade profissional.
                    </p>
                  </div>
                )}
              </section>
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: FAVORITOS (FAVORITES) */}
          {/* ==================================================== */}
          {currentPage === 'favorites' && (
            <section className="page favorites-page">
              <div className="page-title">
                <div>
                  <span className="small-label">SELEÇÃO ESPECIAL</span>
                  <h1>Meus Favoritos</h1>
                </div>
              </div>

              {favorites.length > 0 ? (
                <div className="library-grid">
                  {allLibrarySongs
                    .filter((s) => favorites.includes(s.id))
                    .map((s) => {
                      const isAlreadyInActiveSetlist = Boolean(
                        activeSetlist?.songs?.some((track) => track.id === s.id)
                      );
                      return (
                        <div key={s.id} className="library-card">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteSong(s.id)}
                              title="Excluir música"
                              className="delete-front-btn"
                            >
                              <span>🗑</span>
                              <span>Excluir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(s.id)}
                              className="text-lg text-amber-400 bg-transparent p-1"
                              title="Remover dos favoritos"
                            >
                              ★
                            </button>
                          </div>
                          <h3>{s.title}</h3>
                          <p>{s.artist}</p>
                          <div className="flex gap-2 mt-auto">
                            <button
                              onClick={() => handleOpenSongInShowMode(s)}
                              className="hover:border-blue-400 flex-1"
                            >
                              Abrir no Modo Show
                            </button>

                            {/* BOTÃO ADICIONAR SEPARADAMENTE À SETLIST */}
                            {isAlreadyInActiveSetlist ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeSetlist) {
                                    handleRemoveSongFromSetlist(activeSetlist.id, s.id);
                                    showToast(`"${s.title}" removida do setlist "${activeSetlist.name}".`);
                                  }
                                }}
                                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                                title={`Música incluída no setlist "${activeSetlist?.name}". Clique para remover se desejar.`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>✓ No Setlist</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activeSetlist) {
                                    setSongToAddToSetlist(s);
                                    return;
                                  }
                                  await handleAddSongToSetlist(activeSetlist.id, s);
                                }}
                                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                                title={activeSetlist ? `Adicionar individualmente ao setlist "${activeSetlist.name}"` : 'Adicionar à Minha Setlist'}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Setlist</span>
                              </button>
                            )}

                            {/* ESCOLHER OUTRO SETLIST */}
                            <button
                              type="button"
                              onClick={() => setSongToAddToSetlist(s)}
                              className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-400 hover:text-white text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0"
                              title="Escolher outro setlist para esta música..."
                            >
                              <ListMusic className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="empty-state">
                  <div>☆</div>
                  <h2>Nenhum favorito adicionado</h2>
                  <p>
                    Clique na estrela dentro da sua biblioteca para salvar suas músicas
                    preferidas nesta lista rápida.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: CONFIGURAÇÕES (SETTINGS) */}
          {/* ==================================================== */}
          {currentPage === 'settings' && (
            <SettingsView
              user={user}
              userProfile={userProfile}
              logout={logout}
              onNavigateToPlans={() => setCurrentPage('plans')}
            />
          )}

          {/* ==================================================== */}
          {/* PÁGINA: PLANOS PAGOS & PIX (SUBSCRIPTION & PAYMENT) */}
          {/* ==================================================== */}
          {currentPage === 'plans' && (
            <section className="page overflow-y-auto w-full">
              <SubscriptionView
                onOpenAuthModal={() => {
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
              />
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: SUPORTE AO CLIENTE (SUPPORT) */}
          {/* ==================================================== */}
          {currentPage === 'support' && (
            <section className="page p-4 sm:p-6 max-w-5xl mx-auto w-full">
              <SupportView />
            </section>
          )}

          {/* ==================================================== */}
          {/* PÁGINA: PAINEL ADMINISTRATIVO (ADMIN PANEL) */}
          {/* ==================================================== */}
          {currentPage === 'admin' && (
            <section className="page p-4 sm:p-6 w-full">
              <AdminPanel
                onLogout={logout}
                onBackToApp={() => setCurrentPage('home')}
                onNavigateToPlans={() => setCurrentPage('plans')}
              />
            </section>
          )}
        </main>
      </div>

      {/* MODAL MODO SHOW (FULLSCREEN TELEPROMPTER) */}
      {activeShowSong && (
        <ShowModeView
          song={activeShowSong}
          playlist={activeShowPlaylist}
          onClose={() => setActiveShowSong(null)}
          onOpenSetlistPicker={() => setShowShowModePickerModal(true)}
          onSelectSong={(nextSong) => {
            setActiveShowSong(nextSong);
            setActiveShowPlaylist((prev) => {
              if (!prev) return prev;
              const nextIdx = prev.songs.findIndex((s) => s.id === nextSong.id);
              return {
                ...prev,
                currentIndex: nextIdx !== -1 ? nextIdx : prev.currentIndex,
              };
            });
          }}
          onRecordingSaved={(newRec) => {
            setRecordings((prev) => [newRec, ...prev.filter((r) => r.id !== newRec.id)]);
          }}
        />
      )}

      {/* MODAL DE DETALHE DE MÚSICA */}
      {previewSong && (
        <SongDetailModal
          song={previewSong}
          onClose={() => setPreviewSong(null)}
          onApplyShowMode={(s) => {
            setPreviewSong(null);
            handleOpenSongInShowMode(s);
          }}
        />
      )}

      {/* MODAL ADICIONAR MÚSICA */}
      {showAddSongModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#080f1c] border border-blue-500/30 rounded-3xl w-full max-w-xl p-6 text-white shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-amber-400" />
                <h2 className="font-tech text-lg text-white font-bold">Adicionar à Minha Biblioteca</h2>
              </div>
              <button
                onClick={() => setShowAddSongModal(false)}
                className="text-zinc-400 hover:text-white text-xl bg-transparent cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-[#040914] p-1 rounded-xl border border-zinc-800 mb-4 gap-1">
              <button
                type="button"
                onClick={() => setAddSongModalTab('manual')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  addSongModalTab === 'manual'
                    ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ✍️ Cadastrar Manualmente
              </button>
              <button
                type="button"
                onClick={() => setAddSongModalTab('catalog')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  addSongModalTab === 'catalog'
                    ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar no Catálogo</span>
              </button>
            </div>

            {addSongModalTab === 'catalog' ? (
              <div className="flex flex-col flex-1 overflow-hidden space-y-3">
                <div className="relative">
                  <Search size={18} className="absolute left-3.5 top-3.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar música ou artista para adicionar..."
                    value={catalogSearchQuery}
                    onChange={(e) => handleSearchCatalogForLibrary(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#030912] border border-zinc-700 rounded-xl text-white text-sm focus:border-amber-400 outline-none"
                  />
                  {catalogSearching && (
                    <Loader2 size={16} className="absolute right-3.5 top-3.5 text-amber-400 animate-spin" />
                  )}
                </div>

                <div className="overflow-y-auto flex-1 max-h-[360px] space-y-2 pr-1 custom-scrollbar">
                  {catalogSearchResults.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 space-y-2">
                      <Music className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs">
                        {catalogSearchQuery.trim()
                          ? 'Nenhuma música encontrada com este termo.'
                          : 'Digite o nome de uma música ou artista para pesquisar e adicionar separadamente.'}
                      </p>
                    </div>
                  ) : (
                    catalogSearchResults.map((item) => {
                      const isAdded = catalogAddedIds.includes(item.id) || allLibrarySongs.some((s) => s.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl bg-[#030912] border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <strong className="text-white text-xs font-bold block truncate">{item.title}</strong>
                            <span className="text-zinc-400 text-[11px] block truncate">{item.artist}</span>
                          </div>
                          {isAdded ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Na Biblioteca</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddCatalogSongToLibrary(item)}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSongModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSongSubmit} className="flex flex-col gap-3 overflow-y-auto">
                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Título da Música</label>
                  <input
                    type="text"
                    placeholder="Ex: Lugar ao Sol"
                    value={newSongTitle}
                    onChange={(e) => setNewSongTitle(e.target.value)}
                    className="w-full bg-[#030912] border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-amber-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Artista / Banda</label>
                  <input
                    type="text"
                    placeholder="Ex: Charlie Brown Jr."
                    value={newSongArtist}
                    onChange={(e) => setNewSongArtist(e.target.value)}
                    className="w-full bg-[#030912] border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-amber-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Tom (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Em ou G"
                    value={newSongKey}
                    onChange={(e) => setNewSongKey(e.target.value)}
                    className="w-full bg-[#030912] border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Letra da Música</label>
                  <textarea
                    placeholder="Cole aqui os versos e estrofes para o teleprompter..."
                    value={newSongLyrics}
                    onChange={(e) => setNewSongLyrics(e.target.value)}
                    rows={5}
                    className="w-full bg-[#030912] border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-amber-400 outline-none font-mono"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSongModal(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                  >
                    Salvar Música
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL CRIAR SETLIST */}
      {showCreateSetlistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#080f1c] border border-blue-500/30 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-tech text-lg text-white">Novo Setlist</h2>
              <button
                onClick={() => setShowCreateSetlistModal(false)}
                className="text-zinc-400 hover:text-white text-xl bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSetlistSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">Nome do Setlist / Show</label>
                <input
                  type="text"
                  placeholder="Ex: Show de Sexta no Pub"
                  value={newSetlistName}
                  onChange={(e) => setNewSetlistName(e.target.value)}
                  className="w-full bg-[#030912] border border-zinc-700 rounded-lg p-3 text-white text-sm focus:border-blue-500 outline-none"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSetlistModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button cursor-pointer"
                >
                  Criar Setlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESCOLHER SETLIST PARA O MODO SHOW */}
      {showShowModePickerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#080f1c] border border-blue-500/40 rounded-3xl w-full max-w-lg p-6 text-white shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎤</span>
                  <h2 className="font-tech text-lg text-white font-bold">Escolha o Setlist para o Modo Show</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Selecione o setlist da sua apresentação. O Modo Show passará exclusivamente as músicas dele:
                </p>
              </div>
              <button
                onClick={() => setShowShowModePickerModal(false)}
                className="text-zinc-400 hover:text-white text-xl p-1 bg-transparent cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 custom-scrollbar">
              {playlists.length > 0 ? (
                playlists.map((pl) => {
                  const songCount = pl.songs?.length ?? pl.song_count ?? 0;
                  const hasSongs = songCount > 0 && pl.songs && pl.songs.length > 0;
                  return (
                    <div
                      key={pl.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        hasSongs
                          ? 'bg-[#030914] border-blue-500/30 hover:border-blue-400 hover:bg-blue-950/20 cursor-pointer shadow-md'
                          : 'bg-zinc-900/40 border-zinc-800 opacity-90'
                      }`}
                      onClick={() => {
                        if (hasSongs && pl.songs) {
                          setShowShowModePickerModal(false);
                          handleOpenSongInShowMode(pl.songs[0], {
                            name: pl.name,
                            songs: pl.songs,
                            currentIndex: 0,
                          });
                        } else {
                          setSelectedPlaylistId(pl.id);
                          setCurrentPage('setlists');
                          setShowShowModePickerModal(false);
                          setShowAddToSetlistModal(true);
                          showToast(`Adicione músicas ao setlist "${pl.name}" para tocar no Modo Show.`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold shrink-0">
                          ♫
                        </div>
                        <div className="min-w-0">
                          <strong className="block text-white text-sm truncate">{pl.name}</strong>
                          <span className={`text-xs ${hasSongs ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {songCount} {songCount === 1 ? 'música' : 'músicas'} {hasSongs ? '' : '(vazio)'}
                          </span>
                          {hasSongs && pl.songs && (
                            <p className="text-[11px] text-zinc-400 truncate max-w-[260px] mt-0.5">
                              {pl.songs.map((s) => s.title).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hasSongs ? (
                          <span className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                            <span>▶ Iniciar Show</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700">
                            + Adicionar
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-zinc-400 flex flex-col items-center gap-2">
                  <span className="text-3xl">📋</span>
                  <p className="text-sm">Você ainda não possui nenhum setlist criado.</p>
                  <button
                    onClick={() => {
                      setShowShowModePickerModal(false);
                      setShowCreateSetlistModal(true);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                  >
                    + Criar Meu Primeiro Setlist
                  </button>
                </div>
              )}

              {/* Opção alternativa: Minha Biblioteca completa se houver músicas */}
              {allLibrarySongs.length > 0 && (
                <div
                  className="mt-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-700/60 hover:border-zinc-500 flex items-center justify-between cursor-pointer"
                  onClick={() => {
                    setShowShowModePickerModal(false);
                    handleOpenSongInShowMode(allLibrarySongs[0], {
                      name: 'Minha Biblioteca',
                      songs: allLibrarySongs,
                      currentIndex: 0,
                    });
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📚</span>
                    <div>
                      <strong className="text-xs text-zinc-200 block">Tocar Minha Biblioteca Completa</strong>
                      <span className="text-[11px] text-zinc-400">{allLibrarySongs.length} músicas cadastradas</span>
                    </div>
                  </div>
                  <span className="text-xs text-blue-400 font-bold hover:underline">▶ Iniciar</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setShowShowModePickerModal(false);
                  setShowCreateSetlistModal(true);
                }}
                className="text-xs text-blue-400 hover:underline font-bold bg-transparent cursor-pointer"
              >
                + Criar Novo Setlist
              </button>
              <button
                type="button"
                onClick={() => setShowShowModePickerModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PESQUISAR E ADICIONAR MÚSICAS AO SETLIST (CATÁLOGO GLOBAL) */}
      <AddSongToSetlistModal
        isOpen={showAddToSetlistModal}
        activeSetlist={activeSetlist}
        allLibrarySongs={allLibrarySongs}
        user={user}
        initialTab={addToSetlistTab}
        onClose={() => setShowAddToSetlistModal(false)}
        onAddSongToSetlist={handleAddSongToSetlist}
        onRemoveSongFromSetlist={handleRemoveSongFromSetlist}
        onSongSavedToLibrary={(song) => {
          setUserSongs((prev) => [song, ...prev.filter((s) => s.id !== song.id)]);
        }}
        onShowToast={showToast}
      />

      {/* MODAL: ADICIONAR MÚSICA DA BIBLIOTECA À MINHA SETLIST */}
      <SelectSetlistForSongModal
        isOpen={Boolean(songToAddToSetlist)}
        song={songToAddToSetlist}
        playlists={playlists}
        onClose={() => setSongToAddToSetlist(null)}
        onAddSongToPlaylist={handleAddSongToSetlist}
        onRemoveSongFromPlaylist={handleRemoveSongFromSetlist}
        onCreatePlaylist={async (name) => {
          const created = await createPlaylist(user?.uid || 'guest', name);
          setPlaylists((prev) => [created, ...prev]);
          return created;
        }}
        onShowToast={showToast}
      />

      {/* MODAL: ASSISTIR FILMAGEM EM VÍDEO HD */}
      <VideoPlaybackModal
        isOpen={Boolean(activeVideoModal)}
        recording={activeVideoModal}
        onClose={() => setActiveVideoModal(null)}
        onDelete={handleDeleteRecording}
        onDownload={downloadRecordingMedia}
      />

      {/* MODAL: TELA DE LOGIN / CRIAR CONTA / PLANOS (ACESSÍVEL VIA LINK FINAL OU BOTÃO) */}
      {showAuthModal && (
        <AuthModal
          initialMode={authModalMode}
          isModalOverlay
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR PARA CELULARES E TABLETS (MOBILE TAB BAR) */}
      {!activeShowSong && user && (
        <nav className="mobile-bottom-nav md:hidden">
          <button
            type="button"
            onClick={() => setCurrentPage('home')}
            className={`mobile-tab-item ${currentPage === 'home' ? 'active' : ''}`}
            title="Início"
          >
            <div className="tab-icon-wrap">⌂</div>
            <span>Início</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('search')}
            className={`mobile-tab-item ${currentPage === 'search' ? 'active' : ''}`}
            title="Pesquisar músicas"
          >
            <div className="tab-icon-wrap">🔍</div>
            <span>Busca</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('library')}
            className={`mobile-tab-item ${currentPage === 'library' ? 'active' : ''}`}
            title="Minha Biblioteca"
          >
            <div className="tab-icon-wrap">📚</div>
            <span>Biblioteca</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage('setlists')}
            className={`mobile-tab-item ${currentPage === 'setlists' ? 'active' : ''}`}
            title="Meus Setlists"
          >
            <div className="tab-icon-wrap">📋</div>
            <span>Setlists</span>
          </button>

          <button
            type="button"
            onClick={handleOpenShowModeNavigation}
            className="mobile-tab-item highlight-show"
            title="Abrir Modo Show"
          >
            <div className="tab-icon-wrap">🎤</div>
            <span>Show</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`mobile-tab-item ${mobileMenuOpen ? 'active' : ''}`}
            title="Menu e Opções"
          >
            <div className="tab-icon-wrap font-black text-xs">{userInitials}</div>
            <span>Menu</span>
          </button>
        </nav>
      )}

      {/* DRAWER / MENU COMPLETO PARA DISPOSITIVOS MÓVEIS */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[#090e17] border-t sm:border border-cyan-500/30 rounded-t-3xl sm:rounded-3xl p-5 text-white max-h-[88vh] overflow-y-auto shadow-2xl flex flex-col gap-4"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-zinc-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <strong className="block text-sm text-white truncate">{userName}</strong>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-zinc-400 font-mono truncate max-w-[150px]">{user.email || 'Conta KOLVOX'}</span>
                    {isAdmin ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                        ADMIN
                      </span>
                    ) : isPremiumActive ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">
                        👑 PRO
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                        ⏱ {trialDaysLeft}d {trialHoursLeft}h
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Links Rápidos do Menu */}
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage('home');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'home'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">⌂</span>
                <span>Início</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('search');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'search'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">🔍</span>
                <span>Pesquisar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('library');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'library'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">📚</span>
                <span>Biblioteca ({allLibrarySongs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('setlists');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'setlists'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">📋</span>
                <span>Setlists ({playlists.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('recordings');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'recordings'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">🎙</span>
                <span>Gravações ({recordings.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('favorites');
                  setMobileMenuOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all cursor-pointer ${
                  currentPage === 'favorites'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <span className="text-base">♡</span>
                <span>Favoritos ({favorites.length})</span>
              </button>
            </div>

            {/* Destaque: Modo Show e Planos */}
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenShowModeNavigation();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95"
              >
                <span>🎤</span>
                <span>Abrir Modo Show (Teleprompter)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('plans');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400/20 to-amber-500/10 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-between cursor-pointer active:scale-95"
              >
                <span className="flex items-center gap-2">
                  <span>💎</span>
                  <span>{isPremiumActive ? '👑 Meu Plano PRO (Gerenciar)' : 'Planos Pagos & Pagamento Pix'}</span>
                </span>
                <span className="text-[11px] text-amber-400 font-mono">R$ 9,99/mês →</span>
              </button>
            </div>

            {/* Utilidades do Sistema */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/80 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCurrentPage('settings');
                  setMobileMenuOpen(false);
                }}
                className="p-2.5 rounded-lg hover:bg-zinc-800/80 text-zinc-300 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span>⚙</span>
                <span>Configurações & Ajustes do Palco</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage('support');
                  setMobileMenuOpen(false);
                }}
                className="p-2.5 rounded-lg hover:bg-zinc-800/80 text-zinc-300 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span>🎧</span>
                <span>Suporte ao Cliente & Chamados</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage('admin');
                    setMobileMenuOpen(false);
                  }}
                  className="p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <span>🛡️</span>
                  <span>Painel de Administrador Master</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                }}
                className="p-2.5 rounded-lg hover:bg-rose-500/20 text-rose-300 flex items-center gap-2.5 text-left font-bold mt-1 cursor-pointer"
              >
                <span>↪</span>
                <span>Sair da Conta (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK FLOATING */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#081528]/95 border border-blue-500/50 text-white px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-3 text-sm font-medium animate-fade-in backdrop-blur-md">
          <span className="text-emerald-400 text-base">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
