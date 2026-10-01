import React, { useState, useEffect } from 'react';
import { Song, Playlist, Recording, PlaylistSongItem } from '../types/kolvox';
import { useAuth } from '../context/AuthContext';
import {
  getUserSongs,
  getUserPlaylists,
  createPlaylist,
  addSongToPlaylist,
  getPlaylistSongs,
  removeSongFromPlaylist,
  deletePlaylist,
  deleteSongFromLibrary,
  getUserRecordings,
  deleteRecording,
} from '../services/DatabaseService';
import {
  Library,
  ListMusic,
  Mic,
  Play,
  Trash2,
  Plus,
  Music,
  FolderPlus,
  Clock,
  ExternalLink,
  ChevronRight,
  Disc3,
  Calendar,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RecordingPlayer } from './RecordingPlayer';

interface LibraryViewProps {
  onOpenSongInShowMode: (song: Song, playlistContext?: { name: string; songs: Song[]; currentIndex: number }) => void;
  onOpenSongInPreview: (song: Song) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenSongInShowMode,
  onOpenSongInPreview,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'songs' | 'playlists' | 'recordings'>('songs');

  // Data states
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Playlist Inspection
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistSongItem[]>([]);
  const playlistSongs: Song[] = playlistItems
    .map((item) => item.song)
    .filter((s): s is Song => Boolean(s));

  // Create Playlist Modal
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Add Song to Playlist Picker
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [fetchedSongs, fetchedPlaylists, fetchedRecordings] = await Promise.all([
        getUserSongs(user.uid),
        getUserPlaylists(user.uid),
        getUserRecordings(user.uid),
      ]);
      setSongs(fetchedSongs);
      setPlaylists(fetchedPlaylists);
      setRecordings(fetchedRecordings);
    } catch (err) {
      console.error('Error loading library data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Load songs inside a selected playlist
  const handleSelectPlaylist = async (pl: Playlist) => {
    if (!user) return;
    setSelectedPlaylist(pl);
    const items = await getPlaylistSongs(user.uid, pl.id);
    setPlaylistItems(items);
  };

  const handleRemoveSongFromPlaylist = async (itemDocId: string) => {
    if (!user || !selectedPlaylist) return;
    try {
      await removeSongFromPlaylist(user.uid, selectedPlaylist.id, itemDocId);
      setPlaylistItems((prev) => prev.filter((it) => it.id !== itemDocId));
    } catch (err) {
      console.error('Failed to remove song from playlist:', err);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPlaylistName.trim()) return;

    setCreatingPlaylist(true);
    try {
      const created = await createPlaylist(user.uid, newPlaylistName.trim());
      setPlaylists((prev) => [created, ...prev]);
      setNewPlaylistName('');
      setShowNewPlaylistModal(false);
      confetti({ particleCount: 25, spread: 50 });
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (plId: string) => {
    if (!user || !confirm('Tem certeza que deseja remover esta setlist?')) return;
    try {
      await deletePlaylist(user.uid, plId);
      setPlaylists((prev) => prev.filter((p) => p.id !== plId));
      if (selectedPlaylist?.id === plId) {
        setSelectedPlaylist(null);
        setPlaylistItems([]);
      }
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (!user || !confirm('Remover música do seu repertório?')) return;
    try {
      await deleteSongFromLibrary(user.uid, songId);
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    } catch (err) {
      console.error('Failed to delete song:', err);
    }
  };

  const handleDeleteRecording = async (recId: string) => {
    if (!user || !confirm('Deseja excluir esta gravação de áudio?')) return;
    try {
      await deleteRecording(user.uid, recId);
      setRecordings((prev) => prev.filter((r) => r.id !== recId));
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  const handleBatchDeleteSongs = async () => {
    if (songs.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir todas as ${songs.length} músicas do seu repertório pessoal?`)) return;
    try {
      if (user) {
        await Promise.allSettled(songs.map((s) => deleteSongFromLibrary(user.uid, s.id)));
      }
      setSongs([]);
    } catch (err) {
      console.error('Failed to batch delete songs:', err);
    }
  };

  const handleBatchDeletePlaylists = async () => {
    if (playlists.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir todas as ${playlists.length} setlists?`)) return;
    try {
      if (user) {
        await Promise.allSettled(playlists.map((p) => deletePlaylist(user.uid, p.id)));
      }
      setPlaylists([]);
      setSelectedPlaylist(null);
      setPlaylistItems([]);
    } catch (err) {
      console.error('Failed to batch delete playlists:', err);
    }
  };

  const handleBatchDeleteRecordings = async () => {
    if (recordings.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir todas as ${recordings.length} gravações de áudio?`)) return;
    try {
      if (user) {
        await Promise.allSettled(recordings.map((r) => deleteRecording(user.uid, r.id)));
      }
      setRecordings([]);
    } catch (err) {
      console.error('Failed to batch delete recordings:', err);
    }
  };

  const handleAddSongToExistingPlaylist = async (pl: Playlist) => {
    if (!user || !songToAddToPlaylist) return;
    try {
      await addSongToPlaylist(user.uid, pl.id, songToAddToPlaylist.id, songToAddToPlaylist);
      confetti({ particleCount: 30, spread: 60 });
      setSongToAddToPlaylist(null);
      loadData();
    } catch (err) {
      console.error('Failed to add song to setlist:', err);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header with Navigation Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
        <div>
          <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block mb-1">
            Meu Acervo Pessoal
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Biblioteca & Setlists</h2>
        </div>

        {/* Tab Switcher with integrated Excluir buttons */}
        <div className="flex items-center flex-wrap bg-zinc-950 border border-zinc-800 rounded-2xl p-1.5 gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* ABA 1: MÚSICAS */}
          <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
            activeTab === 'songs' && !selectedPlaylist
              ? 'bg-amber-500/20 border-amber-500/50'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}>
            <button
              id="kolvox-tab-songs"
              type="button"
              onClick={() => {
                setActiveTab('songs');
                setSelectedPlaylist(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'songs' && !selectedPlaylist
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Músicas ({songs.length})</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBatchDeleteSongs();
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Excluir todas as músicas da biblioteca"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] hidden sm:inline">Excluir</span>
            </button>
          </div>

          {/* ABA 2: SETLISTS */}
          <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
            activeTab === 'playlists' || selectedPlaylist
              ? 'bg-amber-500/20 border-amber-500/50'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}>
            <button
              id="kolvox-tab-playlists"
              type="button"
              onClick={() => setActiveTab('playlists')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'playlists' || selectedPlaylist
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Setlists ({playlists.length})</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBatchDeletePlaylists();
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Excluir todas as setlists"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] hidden sm:inline">Excluir</span>
            </button>
          </div>

          {/* ABA 3: GRAVAÇÕES */}
          <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
            activeTab === 'recordings'
              ? 'bg-amber-500/20 border-amber-500/50'
              : 'bg-zinc-900/60 border-zinc-800'
          }`}>
            <button
              id="kolvox-tab-recordings"
              type="button"
              onClick={() => {
                setActiveTab('recordings');
                setSelectedPlaylist(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === 'recordings'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Gravações ({recordings.length})</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBatchDeleteRecordings();
              }}
              className="px-2 py-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Excluir todas as gravações de áudio"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] hidden sm:inline">Excluir</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-xs uppercase tracking-wider">Carregando seus dados...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: REPERTÓRIO DE MÚSICAS */}
          {activeTab === 'songs' && !selectedPlaylist && (
            <div className="space-y-4">
              {songs.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
                  <Music className="w-12 h-12 text-zinc-600 mx-auto" />
                  <h3 className="text-lg font-bold text-white">Seu repertório está vazio</h3>
                  <p className="text-sm text-zinc-400 max-w-md mx-auto">
                    Pesquise suas músicas favoritas ou adicione letras manualmente para começar a usar no palco.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {songs.map((song) => (
                    <div
                      key={song.id}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-lg"
                    >
                      <div className="flex gap-3.5 items-start">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-500 font-bold shrink-0">
                          <Music className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate block">
                            {song.artist}
                          </span>
                          <h4 className="text-base font-bold text-white truncate">{song.title}</h4>
                          {song.key_signature && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Tom: {song.key_signature} {song.bpm ? `• ${song.bpm} BPM` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
                        {/* Play in Show Mode */}
                        <button
                          id={`kolvox-lib-play-${song.id}`}
                          onClick={() => onOpenSongInShowMode(song)}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Modo Show
                        </button>

                        <button
                          id={`kolvox-lib-add-to-setlist-${song.id}`}
                          onClick={() => setSongToAddToPlaylist(song)}
                          className="py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Adicionar à Minha Setlist"
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                          <span>+ Setlist</span>
                        </button>

                        <button
                          id={`kolvox-lib-delete-${song.id}`}
                          onClick={() => handleDeleteSong(song.id)}
                          className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          title="Excluir música"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLAYLISTS / SETLISTS */}
          {(activeTab === 'playlists' || selectedPlaylist) && (
            <div className="space-y-4">
              {/* If a playlist is selected for inspection */}
              {selectedPlaylist ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                    <div>
                      <button
                        onClick={() => setSelectedPlaylist(null)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold mb-1 block"
                      >
                        ← Voltar para todas as Setlists
                      </button>
                      <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <ListMusic className="w-5 h-5 text-amber-500" />
                        {selectedPlaylist.name}
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-normal">
                          {playlistSongs.length} músicas
                        </span>
                      </h3>
                    </div>

                    {playlistSongs.length > 0 && (
                      <button
                        id="kolvox-btn-play-entire-setlist"
                        onClick={() =>
                          onOpenSongInShowMode(playlistSongs[0], {
                            name: selectedPlaylist.name,
                            songs: playlistSongs,
                            currentIndex: 0,
                          })
                        }
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Iniciar Show Completo
                      </button>
                    )}
                  </div>

                  {playlistItems.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-sm">
                      Nenhuma música adicionada a esta setlist ainda.
                      <br />
                      Vá até "Músicas" ou na busca e clique em "+ Setlist" para adicionar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {playlistItems.map((item, idx) => {
                        const s = item.song;
                        if (!s) return null;
                        return (
                          <div
                            key={item.id || `${s.id}-${idx}`}
                            className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 text-center text-xs font-mono font-bold text-amber-500">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{s.title}</h4>
                                <span className="text-xs text-zinc-400 truncate block">{s.artist}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  onOpenSongInShowMode(s, {
                                    name: selectedPlaylist.name,
                                    songs: playlistSongs,
                                    currentIndex: idx,
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold uppercase flex items-center gap-1"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                Tocar
                              </button>
                              <button
                                onClick={() => handleRemoveSongFromPlaylist(item.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors"
                                title="Remover da setlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* List of Playlists */
                <>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      Suas Listas de Apresentação
                    </span>
                    <button
                      id="kolvox-btn-new-setlist"
                      onClick={() => setShowNewPlaylistModal(true)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-amber-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      Criar Nova Setlist
                    </button>
                  </div>

                  {playlists.length === 0 ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
                      <ListMusic className="w-12 h-12 text-zinc-600 mx-auto" />
                      <h3 className="text-lg font-bold text-white">Nenhuma setlist criada</h3>
                      <p className="text-sm text-zinc-400 max-w-md mx-auto">
                        Crie listas para bares, casamentos, voz e violão ou eventos temáticos.
                      </p>
                      <button
                        onClick={() => setShowNewPlaylistModal(true)}
                        className="px-5 py-2.5 bg-amber-500 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl"
                      >
                        + Criar Minha Primeira Setlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {playlists.map((pl) => (
                        <div
                          key={pl.id}
                          className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-lg"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                                {pl.song_count || 0} faixas
                              </span>
                              <button
                                onClick={() => handleDeletePlaylist(pl.id)}
                                className="text-zinc-500 hover:text-red-400 p-1"
                                title="Excluir setlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <h4 className="text-lg font-bold text-white mt-1 tracking-tight">{pl.name}</h4>
                            <span className="text-[10px] text-zinc-500">
                              Criada em {new Date(pl.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end">
                            <button
                              id={`kolvox-open-setlist-${pl.id}`}
                              onClick={() => handleSelectPlaylist(pl)}
                              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-colors"
                            >
                              Ver Músicas
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: GRAVAÇÕES DE ÁUDIO */}
          {activeTab === 'recordings' && (
            <div className="space-y-4">
              {recordings.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center space-y-3">
                  <Mic className="w-12 h-12 text-zinc-600 mx-auto" />
                  <h3 className="text-lg font-bold text-white">Nenhuma gravação encontrada</h3>
                  <p className="text-sm text-zinc-400 max-w-md mx-auto">
                    Ao cantar no "Modo Show", clique no botão "GRAVAR" para capturar seu áudio ao vivo diretamente pelo microfone.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recordings.map((rec) => (
                    <RecordingPlayer
                      key={rec.id}
                      recording={rec}
                      onDelete={handleDeleteRecording}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create New Playlist */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Criar Nova Setlist</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Dê um nome para sua apresentação (ex: "Show de Sexta - Botequim", "Voz e Violão")
            </p>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <input
                id="kolvox-input-new-playlist-name"
                type="text"
                required
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Nome da setlist..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlaylistModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  id="kolvox-btn-submit-new-playlist"
                  type="submit"
                  disabled={creatingPlaylist}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
                >
                  {creatingPlaylist ? 'Criando...' : 'Criar Setlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Song to Playlist Selection */}
      {songToAddToPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Adicionar à Setlist</h3>
            <p className="text-xs text-amber-500 font-semibold mb-4">
              "{songToAddToPlaylist.title}" - {songToAddToPlaylist.artist}
            </p>

            {playlists.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-400 mb-3">Você ainda não possui setlists criadas.</p>
                <button
                  onClick={() => {
                    setSongToAddToPlaylist(null);
                    setShowNewPlaylistModal(true);
                  }}
                  className="px-4 py-2 bg-amber-500 text-zinc-950 text-xs font-bold uppercase rounded-xl"
                >
                  Criar Setlist Agora
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddSongToExistingPlaylist(pl)}
                    className="w-full text-left p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500 flex items-center justify-between text-xs text-zinc-200 transition-colors"
                  >
                    <span className="font-bold text-white">{pl.name}</span>
                    <span className="text-[10px] text-zinc-500">{pl.song_count || 0} faixas</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setSongToAddToPlaylist(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
