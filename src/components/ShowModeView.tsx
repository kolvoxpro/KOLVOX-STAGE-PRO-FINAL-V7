import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Song, Recording } from '../types/kolvox';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { saveRecording } from '../services/DatabaseService';
import { useAuth } from '../context/AuthContext';
import { musicSearchProvider } from '../services/MusicSearchProvider';
import {
  parseLrcToKaraokeTimeline,
  generateSmartKaraokeTimeline,
  getKaraokeState,
  formatKaraokeTime,
  hasLrcTimestamps,
  KaraokeItem,
} from '../utils/karaokeTimeline';
import confetti from 'canvas-confetti';
import {
  Check,
  Mic,
  Volume2,
  RefreshCw,
  X,
  SkipForward,
  SkipBack,
  Zap,
  Sliders,
  Music,
  RotateCcw,
} from 'lucide-react';
import showRolandoSingerImg from '../assets/images/show_cantor_cap_1789915458182.jpg';
import { KolvoxLogo } from './KolvoxLogo';

interface ShowModeViewProps {
  song: Song;
  playlist?: {
    name: string;
    songs: Song[];
    currentIndex: number;
  };
  onClose: () => void;
  onSelectSong?: (song: Song) => void;
  onRecordingSaved?: (recording: Recording) => void;
  onOpenSetlistPicker?: () => void;
}

export const ShowModeView: React.FC<ShowModeViewProps> = ({
  song,
  playlist,
  onClose,
  onSelectSong,
  onRecordingSaved,
  onOpenSetlistPicker,
}) => {
  const { user } = useAuth();

  // Playback & Timing State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0); // 1.0 = Original Studio Tempo
  const [fontSize, setFontSize] = useState<number>(26);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isKaraokeMode, setIsKaraokeMode] = useState<boolean>(true); // Active by default!
  const [isSyncingLrc, setIsSyncingLrc] = useState<boolean>(false);
  const [savedRecordingToast, setSavedRecordingToast] = useState<string | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState<boolean>(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string>('');

  // Song duration extraction
  const defaultDuration = useMemo(() => {
    if (song.duration) {
      if (typeof song.duration === 'number' && song.duration > 0) return Math.round(song.duration);
      if (typeof song.duration === 'string') {
        const parts = song.duration.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return parts[0] * 60 + parts[1];
        }
        const parsed = Number(song.duration);
        if (!isNaN(parsed) && parsed > 0) return Math.round(parsed);
      }
    }
    return 210; // Default 3m30s
  }, [song.duration]);

  const [customDuration, setCustomDuration] = useState<number>(defaultDuration);
  const [songBpm, setSongBpm] = useState<number>(song.bpm || 115);
  const [showTempoModal, setShowTempoModal] = useState<boolean>(false);

  // Audio Recording
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  // DOM Refs
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineElementRef = useRef<HTMLDivElement | null>(null);
  const lineElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(performance.now());
  const isPlayingRef = useRef<boolean>(false);
  const speedRef = useRef<number>(speed);
  const isKaraokeModeRef = useRef<boolean>(isKaraokeMode);

  // Synchronization refs for smooth frame-by-frame auto-scroll
  const currentTimeRef = useRef<number>(currentTime);
  const totalDurationRef = useRef<number>(defaultDuration);
  const timelineRef = useRef<KaraokeItem[]>([]);
  const isUserInteractingRef = useRef<boolean>(false);
  const userInteractionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      lastTimestampRef.current = performance.now();
    }
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isKaraokeModeRef.current = isKaraokeMode;
  }, [isKaraokeMode]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    return () => {
      if (userInteractionTimeoutRef.current) {
        window.clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  // Next / Previous song in setlist calculation
  const hasPlaylist = Boolean(playlist && playlist.songs && playlist.songs.length > 0);
  const nextSong = useMemo(() => {
    if (!hasPlaylist || !playlist) return null;
    const nextIdx = (playlist.currentIndex + 1) % playlist.songs.length;
    return playlist.songs[nextIdx];
  }, [hasPlaylist, playlist]);

  const prevSong = useMemo(() => {
    if (!hasPlaylist || !playlist) return null;
    const prevIdx = (playlist.currentIndex - 1 + playlist.songs.length) % playlist.songs.length;
    return playlist.songs[prevIdx];
  }, [hasPlaylist, playlist]);

  // Karaoke Timeline Building
  const [rawLrcText, setRawLrcText] = useState<string>(song.synced_lyrics || '');

  // Fetch verified synchronized LRC from LRCLIB if not present
  useEffect(() => {
    let isCancelled = false;

    // Check if song already has timestamps in lyrics or synced_lyrics
    if (hasLrcTimestamps(song.synced_lyrics || '') || hasLrcTimestamps(song.lyrics || '')) {
      setRawLrcText(song.synced_lyrics || song.lyrics);
      return;
    }

    // Attempt to query LRCLIB for the exact original studio timestamps
    const fetchLrcData = async () => {
      setIsSyncingLrc(true);
      try {
        const result = await musicSearchProvider.getSyncedLyricsData(song.title, song.artist);
        if (!isCancelled && result) {
          if (result.syncedLyrics && hasLrcTimestamps(result.syncedLyrics)) {
            setRawLrcText(result.syncedLyrics);
            if (result.duration && result.duration > 30) {
              setCustomDuration(result.duration);
            }
          } else if (result.duration && result.duration > 30) {
            setCustomDuration(result.duration);
          }
        }
      } catch (err) {
        console.warn('Silent synced lyrics fetch notice:', err);
      } finally {
        if (!isCancelled) {
          setIsSyncingLrc(false);
        }
      }
    };

    fetchLrcData();

    return () => {
      isCancelled = true;
    };
  }, [song.id, song.title, song.artist, song.lyrics, song.synced_lyrics]);

  // Generate parsed timeline
  const { timeline, cleanLines, totalDuration } = useMemo(() => {
    const hasTimestamps = hasLrcTimestamps(rawLrcText) || hasLrcTimestamps(song.lyrics);
    const textToParse = hasTimestamps
      ? (hasLrcTimestamps(rawLrcText) ? rawLrcText : song.lyrics)
      : (song.lyrics || '');

    if (hasTimestamps) {
      return parseLrcToKaraokeTimeline(textToParse, customDuration);
    } else {
      return generateSmartKaraokeTimeline(textToParse, customDuration, songBpm);
    }
  }, [rawLrcText, song.lyrics, customDuration, songBpm]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  useEffect(() => {
    lineElementsRef.current = lineElementsRef.current.slice(0, cleanLines.length);
  }, [cleanLines]);

  // Current Karaoke State
  const karaokeState = useMemo(() => {
    return getKaraokeState(timeline, currentTime, totalDuration);
  }, [timeline, currentTime, totalDuration]);

  // Auto-scroll when paused (scrubbing or jumping)
  useEffect(() => {
    if (!isPlaying && lyricsContainerRef.current && !isUserInteractingRef.current) {
      const idx = karaokeState.activeLineIndex;
      const targetEl = lineElementsRef.current[idx];
      const container = lyricsContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const targetScrollContentY = targetRect.top - containerRect.top + container.scrollTop;
        const targetScroll = Math.max(
          0,
          targetScrollContentY - container.clientHeight * 0.36
        );
        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });
      }
    }
  }, [isPlaying, karaokeState.activeLineIndex]);

  // Main playback timer loop (Tempo Original com Auto-Scroll Contínuo Subindo em Tempo Real)
  useEffect(() => {
    const updatePlayback = (now: number) => {
      if (isPlayingRef.current) {
        const deltaSeconds = (now - lastTimestampRef.current) / 1000;
        lastTimestampRef.current = now;

        if (deltaSeconds > 0 && deltaSeconds < 1.0) {
          const currentT = currentTimeRef.current;
          const nextTime = Math.min(
            totalDurationRef.current,
            currentT + deltaSeconds * speedRef.current
          );
          currentTimeRef.current = nextTime;
          setCurrentTime(nextTime);

          if (nextTime >= totalDurationRef.current) {
            setIsPlaying(false);
          }

          // Teleprompter / Karaokê: Auto-Scroll Contínuo Subindo Conforme a Letra Passa
          const container = lyricsContainerRef.current;
          if (container && !isUserInteractingRef.current && timelineRef.current.length > 0) {
            const currentState = getKaraokeState(
              timelineRef.current,
              nextTime,
              totalDurationRef.current
            );
            const idx = currentState.activeLineIndex;
            const curEl = lineElementsRef.current[idx];

            if (curEl) {
              const containerRect = container.getBoundingClientRect();
              const curRect = curEl.getBoundingClientRect();
              // Posição absoluta da linha atual no conteúdo com scroll
              const curTop = curRect.top - containerRect.top + container.scrollTop;

              const nextEl = lineElementsRef.current[idx + 1];
              let nextTop: number;
              if (nextEl) {
                const nextRect = nextEl.getBoundingClientRect();
                nextTop = nextRect.top - containerRect.top + container.scrollTop;
              } else {
                nextTop = curTop + curEl.offsetHeight + 28;
              }

              let fraction = 0;
              if (currentState.isPause) {
                // Durante a introdução instrumental, nos últimos 4s aproxima suavemente do 1º verso
                if (currentState.pauseCountdown <= 4 && currentState.pauseTotalDuration > 0) {
                  const remaining = Math.max(0, currentState.pauseCountdown);
                  fraction = ((4 - remaining) / 4) * 0.15;
                }
              } else {
                fraction = Math.max(0, Math.min(1, currentState.lineProgress / 100));
              }

              // Ponto focal interpola continuamente entre a linha atual e a próxima a cada milissegundo
              const targetY = curTop + (nextTop - curTop) * fraction;
              const desiredScrollTop = Math.max(
                0,
                targetY - container.clientHeight * 0.36
              );

              const currentScroll = container.scrollTop;
              const diff = desiredScrollTop - currentScroll;

              if (Math.abs(diff) > 0.2) {
                // Deslize contínuo a 60fps (lerp 0.22 para fluidez máxima da subida)
                container.scrollTop = currentScroll + diff * 0.22;
              }
            }
          }
        }
      } else {
        lastTimestampRef.current = now;
      }

      if (isPlayingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updatePlayback);
      }
    };

    if (isPlaying) {
      lastTimestampRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSpeed((prev) => Math.min(2.0, +(prev + 0.25).toFixed(2)));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSpeed((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, prev - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(totalDuration, prev + 5));
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, totalDuration]);

  const handleNextSong = () => {
    if (nextSong && onSelectSong) {
      onSelectSong(nextSong);
      setCurrentTime(0);
      setIsPlaying(false);
      setSavedRecordingToast(`Próxima música: ${nextSong.title}`);
      setTimeout(() => setSavedRecordingToast(null), 2500);
    }
  };

  const handlePrevSong = () => {
    if (prevSong && onSelectSong) {
      onSelectSong(prevSong);
      setCurrentTime(0);
      setIsPlaying(false);
      setSavedRecordingToast(`Música anterior: ${prevSong.title}`);
      setTimeout(() => setSavedRecordingToast(null), 2500);
    }
  };

  const togglePlayback = () => {
    isUserInteractingRef.current = false;
    setIsPlaying((prev) => !prev);
  };

  const handleUserInteraction = () => {
    isUserInteractingRef.current = true;
    if (userInteractionTimeoutRef.current) {
      window.clearTimeout(userInteractionTimeoutRef.current);
    }
    userInteractionTimeoutRef.current = window.setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 1200);
  };

  const handleRewindToStart = () => {
    isUserInteractingRef.current = false;
    currentTimeRef.current = 0;
    setCurrentTime(0);
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSkipTime = (delta: number) => {
    isUserInteractingRef.current = false;
    setCurrentTime((prev) => {
      const next = Math.max(0, Math.min(totalDuration, prev + delta));
      currentTimeRef.current = next;
      return next;
    });
  };

  const handleJumpToLine = (lineIdx: number) => {
    const targetItem = timeline.find((item) => item.type === 'line' && item.lineIndex === lineIdx);
    if (targetItem) {
      isUserInteractingRef.current = false;
      currentTimeRef.current = targetItem.startTime;
      setCurrentTime(targetItem.startTime);
      const targetEl = lineElementsRef.current[lineIdx];
      const container = lyricsContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const targetScrollContentY = targetRect.top - containerRect.top + container.scrollTop;
        const targetScroll = Math.max(
          0,
          targetScrollContentY - container.clientHeight * 0.36
        );
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    }
  };

  const changeSpeed = (delta: number) => {
    setSpeed((prev) => Math.max(0.5, Math.min(2.0, +(prev + delta).toFixed(2))));
  };

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => Math.max(16, Math.min(50, prev + delta)));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      const recResult = await stopRecording();
      if (recResult) {
        try {
          const recName = `${song.title} (Ao Vivo)`;
          const savedRec = await saveRecording(user?.uid || 'guest', {
            song_id: song.id,
            song_title: recName,
            song_artist: song.artist,
            file_url: recResult.base64 || recResult.url,
            duration: recResult.duration || recordingTime,
          });

          onRecordingSaved?.(savedRec);
          setSavedRecordingToast(`Gravação salva com sucesso! Enviada para Minhas Gravações.`);
          confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
          setTimeout(() => setSavedRecordingToast(null), 4000);
        } catch (err) {
          console.error('Failed to save live recording:', err);
        }
      }
    } else {
      const rec = await startRecording();
      if (!rec.success) {
        if (rec.isPermissionDenied) {
          setMicErrorMessage(
            rec.error || 'A permissão de acesso ao microfone foi negada pelo navegador.'
          );
          setShowMicPermissionModal(true);
        } else {
          setSavedRecordingToast(rec.error || 'Não foi possível iniciar a gravação.');
          setTimeout(() => setSavedRecordingToast(null), 4000);
        }
      } else if (rec.isFallback) {
        setSavedRecordingToast('Gravando áudio de demonstração (simulação ativa)!');
        setTimeout(() => setSavedRecordingToast(null), 3500);
      }
    }
  };

  // Progress bar seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const nextTime = pct * totalDuration;
    isUserInteractingRef.current = false;
    currentTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  };

  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <section id="showMode" className="show-mode relative select-none">
      {/* TOAST FEEDBACK */}
      {savedRecordingToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#041324]/95 border border-[#08a8ff] text-white px-5 py-2.5 rounded-2xl shadow-[0_0_30px_rgba(8,168,255,0.4)] flex items-center gap-2.5 text-sm font-medium animate-fade-in backdrop-blur-md">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{savedRecordingToast}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="show-header flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-zinc-950/90 border-b border-zinc-800 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="show-brand shrink-0">
            <KolvoxLogo size="xs" />
          </div>
          {playlist && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold shadow-sm shrink-0">
              <span>♫ Setlist:</span>
              <span className="text-white font-black truncate max-w-[120px]">{playlist.name}</span>
              <span className="text-amber-400 text-[11px]">
                ({(playlist.currentIndex ?? 0) + 1}/{playlist.songs.length})
              </span>
            </div>
          )}
        </div>

        <div className="show-song flex-1 min-w-0 text-center px-2">
          <strong className="block text-[10px] sm:text-xs text-zinc-400 truncate uppercase tracking-wider">
            {song.artist || 'Artista'}
          </strong>
          <span id="showSongTitle" className="block text-xs sm:text-base font-black text-white truncate max-w-full">
            {song.title}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* BADGE KARAOKE TEMPO ORIGINAL */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] font-bold font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>KARAOKÊ COM PAUSAS</span>
          </div>

          {onOpenSetlistPicker && (
            <button
              type="button"
              className="px-2 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-200 cursor-pointer hidden md:flex items-center gap-1 transition-colors"
              onClick={onOpenSetlistPicker}
              title="Trocar de repertório / setlist"
            >
              <span>📋 Setlist</span>
            </button>
          )}

          <button
            className="fullscreen-button hidden sm:inline-flex text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            onClick={toggleFullscreen}
            title="Tela Cheia"
          >
            ⛶
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            title="Sair do Modo Show"
          >
            ✕ <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ÁREA DE LETRAS & PALCO */}
      <main className="lyrics-area w-full max-w-full overflow-hidden">
        {/* CARD LATERAL ESQUERDO: CANTOR AO VIVO */}
        <div className="artist-image">
          <div className="artist-stage-card">
            <img
              src={showRolandoSingerImg}
              alt={song.artist || 'Show Ao Vivo'}
              className="artist-stage-img"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/show-rolando.jpg';
              }}
            />
            <div className="artist-card-overlay">
              <span className="artist-card-live-tag">● AO VIVO</span>
              <p className="artist-card-artist">{song.artist || 'Artista no Palco'}</p>
              <h4 className="artist-card-title">{song.title}</h4>

              {/* Status de Karaokê no Card */}
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Tempo:</span>
                <span className="text-amber-300 font-bold">
                  {formatKaraokeTime(currentTime)} / {formatKaraokeTime(totalDuration)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTAINER CENTRAL: LETRAS KARAOKÊ */}
        <div className="flex flex-col h-full min-h-0 min-w-0 max-w-2xl mx-auto w-full relative overflow-hidden">
          {/* BANNER APENAS NA INTRODUÇÃO INICIAL DA MÚSICA (NUNCA A CADA FIM DE FRASE) */}
          {karaokeState.isPause && karaokeState.pauseType === 'intro' && currentTime < 25 && (
            <div className="w-full mb-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-zinc-900/95 to-amber-500/20 border-2 border-amber-400/60 shadow-[0_0_35px_rgba(251,191,36,0.25)] backdrop-blur-md animate-fade-in shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🎸</span>
                  <div>
                    <span className="font-mono text-[10px] sm:text-xs font-black tracking-widest uppercase text-amber-400 block">
                      INTRODUÇÃO INSTRUMENTAL
                    </span>
                    <span className="text-xs text-zinc-300 font-medium">
                      Aguarde a entrada do primeiro verso
                    </span>
                  </div>
                </div>

                {/* COUNTDOWN REGRESSIVO COM EQUALIZADOR */}
                <div className="flex items-center gap-3 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-amber-400/30">
                  <div className="flex items-end gap-0.5 h-4">
                    <span className="w-1 bg-amber-400 rounded-full animate-pulse h-3" />
                    <span className="w-1 bg-amber-300 rounded-full animate-bounce h-4" />
                    <span className="w-1 bg-amber-400 rounded-full animate-pulse h-2" />
                    <span className="w-1 bg-amber-300 rounded-full animate-bounce h-3.5" />
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] uppercase tracking-wider text-zinc-400 font-mono">
                      Vocal entra em
                    </span>
                    <span className="font-mono text-base sm:text-lg font-black text-amber-300">
                      {formatKaraokeTime(karaokeState.pauseCountdown)}
                    </span>
                  </div>
                </div>
              </div>

              {/* BARRA DE PROGRESSO DA INTRO */}
              <div className="mt-2.5">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-100 ease-linear"
                    style={{ width: `${karaokeState.pauseProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE LETRAS DO TELEPROMPTER */}
          <div
            id="lyrics"
            className="lyrics relative flex-1 min-h-0 w-full px-2 sm:px-6 text-center select-none overflow-y-auto"
            ref={lyricsContainerRef}
            onWheel={handleUserInteraction}
            onTouchMove={handleUserInteraction}
            style={{ fontSize: `${fontSize}px` }}
          >
            {/* Espaçador superior para permitir que os primeiros versos subam continuamente desde o início */}
            <div style={{ height: '36vh' }} className="shrink-0 pointer-events-none" />

            {cleanLines.map((line, idx) => {
              const isCurrentVocal = !karaokeState.isPause && idx === karaokeState.activeLineIndex;
              const isPastVocal = !karaokeState.isPause ? idx < karaokeState.activeLineIndex : idx < karaokeState.activeLineIndex;

              return (
                <div
                  key={idx}
                  ref={(el) => {
                    lineElementsRef.current[idx] = el;
                    if (isCurrentVocal) {
                      activeLineElementRef.current = el;
                    }
                  }}
                  onClick={() => handleJumpToLine(idx)}
                  className={`relative my-3 p-3 rounded-2xl transition-all duration-200 cursor-pointer ${
                    isCurrentVocal
                      ? 'bg-cyan-500/15 border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.3)] scale-[1.02]'
                      : isPastVocal
                      ? 'opacity-35 hover:opacity-75'
                      : 'opacity-70 hover:opacity-95'
                  }`}
                  title="Clique para avançar/voltar o karaokê para esta linha"
                >
                  <p
                    className={`m-0 break-words leading-relaxed font-sans ${
                      isCurrentVocal
                        ? 'font-black text-white text-shadow-lg'
                        : 'font-medium text-zinc-300'
                    }`}
                  >
                    {line}
                  </p>

                  {/* BARRA DE VARREDURA DA FRASE ATUAL (KARAOKE LINE SWEEP) */}
                  {isCurrentVocal && (
                    <div className="w-full max-w-md mx-auto h-1.5 bg-zinc-800 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-amber-300 to-lime-400 transition-all duration-75 ease-linear rounded-full"
                        style={{ width: `${karaokeState.lineProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {/* Espaçador inferior para que todos os versos possam subir até a linha focal */}
            <div style={{ height: '55vh' }} className="shrink-0 pointer-events-none" />
          </div>
        </div>

        {/* CONTROLES LATERAIS (DESKTOP) */}
        <aside className="show-controls overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar flex flex-col gap-2.5">
          <span className="control-title">ANDAMENTO / TEMPO DO SHOW</span>

          {/* RELÓGIO DE TEMPO REAL */}
          <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              Tempo Decorrido
            </span>
            <div className="font-mono text-xl font-black text-white mt-0.5">
              <span className="text-amber-400">{formatKaraokeTime(currentTime)}</span>
              <span className="text-zinc-500 mx-1">/</span>
              <span className="text-zinc-300">{formatKaraokeTime(totalDuration)}</span>
            </div>
            <span className="text-[9px] font-mono text-zinc-400 mt-1">
              {progressPct.toFixed(0)}% concluído
            </span>
          </div>

          <div className="speed-control my-1">
            <button onClick={() => changeSpeed(-0.25)} aria-label="Diminuir velocidade">−</button>
            <strong id="speedValue">{speed.toFixed(2)}x</strong>
            <button onClick={() => changeSpeed(0.25)} aria-label="Aumentar velocidade">+</button>
          </div>

          <div className="speed-list">
            {[0.75, 1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={speed === s ? 'active' : ''}
                title={s === 1.0 ? 'Tempo Original 1:1' : `${s}x`}
              >
                {s === 1.0 ? '1.0x (Original)' : `${s}x`}
              </button>
            ))}
          </div>

          {/* AJUSTAR DURAÇÃO / BPM */}
          <div className="mt-1 p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Sincronia
              </span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {formatKaraokeTime(totalDuration)} ({songBpm} BPM)
              </span>
            </div>

            <button
              type="button"
              id="btn-open-tempo-modal"
              onClick={() => setShowTempoModal(true)}
              className="w-full py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
            >
              <span>Ajustar Duração / BPM</span>
            </button>
          </div>

          {/* BOTÃO GRAVAÇÃO AO VIVO */}
          <div className="pt-1 mt-auto shrink-0">
            <button
              id="recordButton"
              className={`record-show-button !mt-0 ${isRecording ? 'recording' : ''}`}
              onClick={toggleRecording}
            >
              {isRecording ? `🔴 Gravando (${recordingTime}s)` : '🔴 Gravar Apresentação'}
            </button>
          </div>
        </aside>
      </main>

      {/* RODAPÉ DO REPRODUTOR / TELEPROMPTER */}
      <footer className="show-player">
        {/* BARRA DE PROGRESSO COM INTERAÇÃO DE CLIQUE / SEEK */}
        <div className="progress cursor-pointer group" onClick={handleSeek} title="Clique para avançar ou voltar na música">
          <div
            id="progressBar"
            className="progress-fill bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="show-player-content w-full max-w-5xl mx-auto px-2">
          {/* ========================================================= */}
          {/* 1. MODO DESKTOP / TABLET (>= 768px / md): 3 COLUNAS */}
          {/* ========================================================= */}
          <div className="hidden md:flex items-center justify-between w-full gap-4">
            {/* GRUPO ESQUERDA: GRAVAÇÃO, TEMPO & TAMANHO FONTE */}
            <div className="flex items-center gap-2.5 shrink-0 flex-1 justify-start">
              <button
                id="mobileRecordButton"
                className={`record-show-button-mobile shrink-0 ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title="Gravar áudio da apresentação"
              >
                <span className="rec-dot">●</span>
                <span className="rec-label text-xs">
                  {isRecording ? `${recordingTime}s` : 'Gravar'}
                </span>
              </button>

              {/* RELÓGIO MM:SS NO RODAPÉ */}
              <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs flex items-center gap-1">
                <span className="text-amber-400 font-bold">{formatKaraokeTime(currentTime)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-400">{formatKaraokeTime(totalDuration)}</span>
              </div>

              {/* Botões de Pular -10s / +10s */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSkipTime(-10)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-zinc-800 cursor-pointer"
                  title="Voltar 10 segundos"
                >
                  -10s
                </button>
                <button
                  type="button"
                  onClick={() => handleSkipTime(10)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-mono border border-zinc-800 cursor-pointer"
                  title="Avançar 10 segundos"
                >
                  +10s
                </button>
              </div>

              {/* Tamanho da Fonte */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={() => changeFontSize(-2)}
                  className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                  title="Diminuir fonte"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(2)}
                  className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                  title="Aumentar fonte"
                >
                  A+
                </button>
              </div>
            </div>

            {/* GRUPO CENTRAL: TRANSPORTE PRINCIPAL KARAOKÊ */}
            <div className="player-controls flex items-center justify-center gap-3 shrink-0 flex-nowrap">
              {/* REWIND TO START */}
              <button
                type="button"
                onClick={handleRewindToStart}
                title="Reiniciar karaokê do início (00:00)"
                className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {hasPlaylist && (
                <button
                  type="button"
                  id="btn-prev-song-setlist"
                  onClick={handlePrevSong}
                  disabled={!prevSong}
                  className="px-3 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold disabled:opacity-30 shrink-0 shadow-sm"
                  title={prevSong ? `Anterior: ${prevSong.title}` : 'Música anterior'}
                >
                  <SkipBack className="w-3.5 h-3.5 fill-current" />
                  <span>Ant</span>
                </button>
              )}

              {/* BOTÃO PLAY / PAUSE PRINCIPAL */}
              <button
                type="button"
                id="playButton"
                className="play-main hover:scale-105 active:scale-95 transition-transform shrink-0 cursor-pointer shadow-[0_0_25px_rgba(251,191,36,0.4)]"
                onClick={togglePlayback}
                title={isPlaying ? 'Pausar karaokê' : 'Iniciar karaokê'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>

              {hasPlaylist && (
                <button
                  type="button"
                  id="btn-next-song-setlist-main"
                  onClick={handleNextSong}
                  disabled={!nextSong}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-xs tracking-wide flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer border border-amber-300/50 disabled:opacity-40 shrink-0"
                  title={nextSong ? `Próxima: ${nextSong.title}` : 'Próxima música'}
                >
                  <span>Próx</span>
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setCurrentTime(totalDuration)}
                title="Avançar ao final da música"
                className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              >
                ▶|
              </button>
            </div>

            {/* GRUPO DIREITA: VELOCIDADE & SAIR */}
            <div className="player-options flex items-center justify-end gap-2 shrink-0 flex-1">
              <div className="mobile-speed-control flex items-center shrink-0" title="Velocidade de reprodução">
                <button onClick={() => changeSpeed(-0.25)} aria-label="Diminuir velocidade">−</button>
                <span className="speed-val font-mono">{speed.toFixed(2)}x</span>
                <button onClick={() => changeSpeed(0.25)} aria-label="Aumentar velocidade">+</button>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-bold transition-colors cursor-pointer"
                title="Tela Cheia"
              >
                ⛶
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Sair do modo show"
              >
                ✕ Sair
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. MODO CELULAR (< md): COMPACTO & ERGONÔMICO              */}
          {/* ========================================================= */}
          <div className="flex md:hidden flex-col w-full gap-2">
            {/* LINHA 1: CONTROLES PRINCIPAIS */}
            <div className="flex items-center justify-between gap-1.5 w-full">
              <button
                type="button"
                onClick={handleRewindToStart}
                className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center justify-center text-xs shrink-0"
                title="Reiniciar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {hasPlaylist && (
                <button
                  type="button"
                  id="mobile-btn-prev-song"
                  onClick={handlePrevSong}
                  disabled={!prevSong}
                  className="px-2 py-1.5 rounded-xl bg-zinc-850 text-zinc-200 border border-zinc-700/80 flex items-center gap-1 text-xs font-bold disabled:opacity-30 shrink-0"
                >
                  <SkipBack className="w-3 h-3 fill-current" />
                  <span>Ant</span>
                </button>
              )}

              {/* BOTÃO PLAY / PAUSE CENTRALIZADO */}
              <button
                type="button"
                id="mobilePlayButton"
                className="play-main hover:scale-105 active:scale-95 transition-transform shrink-0"
                onClick={togglePlayback}
                title={isPlaying ? 'Pausar' : 'Iniciar'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>

              {hasPlaylist && (
                <button
                  type="button"
                  id="mobile-btn-next-song"
                  onClick={handleNextSong}
                  disabled={!nextSong}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1 shadow-md shrink-0"
                >
                  <span>Próx</span>
                  <SkipForward className="w-3 h-3 fill-current" />
                </button>
              )}

              {/* GRAVAÇÃO MOBILE */}
              <button
                id="mobileFooterRecordButton"
                className={`record-show-button-mobile shrink-0 ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title="Gravar"
              >
                <span className="rec-dot">●</span>
                <span className="rec-label text-xs">
                  {isRecording ? `${recordingTime}s` : 'Gravar'}
                </span>
              </button>
            </div>

            {/* LINHA 2: TEMPO & CONTROLES */}
            <div className="flex items-center justify-between gap-1 w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-2 py-1 text-xs">
              <div className="font-mono text-amber-400 font-bold">
                {formatKaraokeTime(currentTime)} / {formatKaraokeTime(totalDuration)}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSkipTime(-5)}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-300"
                >
                  -5s
                </button>
                <button
                  type="button"
                  onClick={() => handleSkipTime(5)}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-300"
                >
                  +5s
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(-2)}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-300 font-bold"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(2)}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-300 font-bold"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]"
                >
                  ✕ Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL CONFIGURAÇÃO TEMPO REAL (BPM & DURAÇÃO) */}
      {showTempoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Tempo Original da Gravação</h3>
              </div>
              <button
                onClick={() => setShowTempoModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Duração da Gravação Original (Minutos : Segundos)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[150, 180, 210, 240, 270, 300, 330, 360].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setCustomDuration(sec)}
                      className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all ${
                        customDuration === sec
                          ? 'bg-amber-400 text-zinc-950 shadow-md'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {formatKaraokeTime(sec)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Andamento Musical (BPM: {songBpm})
                </label>
                <input
                  type="range"
                  min={60}
                  max={200}
                  step={2}
                  value={songBpm}
                  onChange={(e) => setSongBpm(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>60 Lento</span>
                  <span>115 Médio</span>
                  <span>180 Rápido</span>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs text-zinc-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tempo total do áudio:</span>
                  <strong className="text-white font-mono">{formatKaraokeTime(customDuration)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pausas Instrumentais:</span>
                  <strong className="text-emerald-400 font-mono">Sincronizadas</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTempoModal(false);
                  setSavedRecordingToast(`Duração ajustada para ${formatKaraokeTime(customDuration)}`);
                  setTimeout(() => setSavedRecordingToast(null), 2500);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setShowTempoModal(false)}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PERMISSÃO DE MICROFONE */}
      {showMicPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#040e1c] border border-blue-500/40 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(8,168,255,0.25)] text-white relative">
            <button
              onClick={() => setShowMicPermissionModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Acesso ao Microfone</h3>
                <p className="text-xs text-amber-300 font-medium">Permissão necessária para gravação ao vivo</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
              {micErrorMessage || 'O navegador não permitiu o acesso ao seu microfone.'}
            </p>

            <div className="bg-[#07172c] border border-blue-900/50 rounded-xl p-3.5 mb-5 text-xs text-zinc-300 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-sky-400 font-bold shrink-0">1.</span>
                <span>Clique no ícone de <strong>cadeado ou permissões</strong> na barra de endereço do navegador e marque <strong>Microfone: Permitir</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-sky-400 font-bold shrink-0">2.</span>
                <span>Se estiver no modo de visualização incorporado (iframe), abra em uma <strong>nova aba</strong> para liberar o hardware.</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  const rec = await startRecording();
                  if (rec.success) {
                    setShowMicPermissionModal(false);
                    setSavedRecordingToast(rec.isFallback ? 'Gravação iniciada com áudio de teste!' : 'Microfone ativado! Gravando performance...');
                    setTimeout(() => setSavedRecordingToast(null), 3000);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(14,165,233,0.35)] transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Novamente (Microfone)</span>
              </button>

              <button
                onClick={async () => {
                  const rec = await startRecording({ forceFallbackStream: true });
                  if (rec.success) {
                    setShowMicPermissionModal(false);
                    setSavedRecordingToast('Gravando áudio de demonstração! (Simulação ativa)');
                    setTimeout(() => setSavedRecordingToast(null), 3500);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Gravar com Áudio de Demonstração (Sem Microfone)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
