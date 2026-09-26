import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song, Recording } from '../types/kolvox';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { saveRecording } from '../services/DatabaseService';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { Check, Mic, AlertCircle, Volume2, RefreshCw, X, SkipForward, SkipBack, Zap, Clock, Activity, Sliders } from 'lucide-react';
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

  // Playback & Auto-scroll State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [fontSize, setFontSize] = useState<number>(26);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [savedRecordingToast, setSavedRecordingToast] = useState<string | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState<boolean>(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string>('');

  // Real-time Song Tempo & BPM Sync State
  const defaultDuration = React.useMemo(() => {
    if (song.duration) {
      if (typeof song.duration === 'number' && song.duration > 0) return song.duration;
      if (typeof song.duration === 'string') {
        const parts = song.duration.split(':').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return parts[0] * 60 + parts[1];
        }
        const parsed = Number(song.duration);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 210; // Default 3m30s
  }, [song.duration]);

  const [isRealTempoMode, setIsRealTempoMode] = useState<boolean>(false);
  const [customDurationSeconds, setCustomDurationSeconds] = useState<number>(defaultDuration);
  const [songBpm, setSongBpm] = useState<number>(song.bpm || 120);
  const [showTempoModal, setShowTempoModal] = useState<boolean>(false);

  // Audio Recording
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    isUsingFallback,
  } = useAudioRecorder();

  // DOM Refs
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollAccRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const speedRef = useRef<number>(speed);
  const isRealTempoRef = useRef<boolean>(isRealTempoMode);
  const customDurationRef = useRef<number>(customDurationSeconds);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isRealTempoRef.current = isRealTempoMode;
  }, [isRealTempoMode]);

  useEffect(() => {
    customDurationRef.current = customDurationSeconds;
  }, [customDurationSeconds]);

  // Next / Previous song in setlist calculation
  const hasPlaylist = Boolean(playlist && playlist.songs && playlist.songs.length > 0);
  const nextSong = React.useMemo(() => {
    if (!hasPlaylist || !playlist) return null;
    const nextIdx = (playlist.currentIndex + 1) % playlist.songs.length;
    return playlist.songs[nextIdx];
  }, [hasPlaylist, playlist]);

  const prevSong = React.useMemo(() => {
    if (!hasPlaylist || !playlist) return null;
    const prevIdx = (playlist.currentIndex - 1 + playlist.songs.length) % playlist.songs.length;
    return playlist.songs[prevIdx];
  }, [hasPlaylist, playlist]);

  const handleNextSong = () => {
    if (nextSong && onSelectSong) {
      onSelectSong(nextSong);
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
      setScrollProgress(0);
      setActiveLineIndex(0);
      setSavedRecordingToast(`Próxima música: ${nextSong.title}`);
      setTimeout(() => setSavedRecordingToast(null), 2500);
    }
  };

  const handlePrevSong = () => {
    if (prevSong && onSelectSong) {
      onSelectSong(prevSong);
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
      setScrollProgress(0);
      setActiveLineIndex(0);
      setSavedRecordingToast(`Música anterior: ${prevSong.title}`);
      setTimeout(() => setSavedRecordingToast(null), 2500);
    }
  };

  // Split lyrics into lines/paragraphs - strictly authentic text
  const lines = React.useMemo(() => {
    if (!song.lyrics || song.lyrics.trim().length === 0) {
      return [
        '(Letra oficial não cadastrada para esta música)',
        'Para adicionar a letra oficial do cantor, clique em Editar Música na Biblioteca.'
      ];
    }
    return song.lyrics
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [song.lyrics]);

  // Update progress bar on scroll
  const handleScrollUpdate = useCallback(() => {
    const el = lyricsContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      return;
    }
    const current = el.scrollTop;
    const pct = Math.min(100, Math.max(0, (current / maxScroll) * 100));
    setScrollProgress(pct);

    // Calculate approximate active line
    const approxLine = Math.floor((current / maxScroll) * lines.length);
    setActiveLineIndex(approxLine);
  }, [lines.length]);

  // Auto-scroll loop
  const autoScrollStep = useCallback(() => {
    if (isPlayingRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (container.scrollTop >= maxScroll - 2) {
        setIsPlaying(false);
      } else {
        let pxPerFrame: number;
        if (isRealTempoRef.current) {
          // Exact sync with real duration of the song
          const targetDuration = Math.max(20, customDurationRef.current || 210);
          const pxPerSec = maxScroll / targetDuration;
          pxPerFrame = (pxPerSec * speedRef.current) / 60;
        } else {
          const basePxPerSec = 45;
          pxPerFrame = (basePxPerSec * speedRef.current) / 60;
        }
        scrollAccRef.current += pxPerFrame;

        if (scrollAccRef.current >= 1) {
          const moveBy = Math.floor(scrollAccRef.current);
          container.scrollTop += moveBy;
          scrollAccRef.current -= moveBy;
          handleScrollUpdate();
        }
      }
    }

    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(autoScrollStep);
    }
  }, [handleScrollUpdate]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(autoScrollStep);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, autoScrollStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSpeed((prev) => Math.min(3.0, +(prev + 0.25).toFixed(2)));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSpeed((prev) => Math.max(0.25, +(prev - 0.25).toFixed(2)));
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleLyrics = () => {
    setIsPlaying((prev) => !prev);
  };

  const lyricsStart = () => {
    if (lyricsContainerRef.current) {
      lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setScrollProgress(0);
      setActiveLineIndex(0);
    }
  };

  const lyricsEnd = () => {
    if (lyricsContainerRef.current) {
      const maxScroll =
        lyricsContainerRef.current.scrollHeight - lyricsContainerRef.current.clientHeight;
      lyricsContainerRef.current.scrollTo({ top: maxScroll, behavior: 'smooth' });
      setScrollProgress(100);
      setActiveLineIndex(lines.length - 1);
    }
  };

  const changeSpeed = (delta: number) => {
    setSpeed((prev) => {
      const next = Math.max(0.25, Math.min(3.0, +(prev + delta).toFixed(2)));
      return next;
    });
  };

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => Math.max(16, Math.min(52, prev + delta)));
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
          setSavedRecordingToast(`Gravação salva com sucesso! Enviada para a aba Minhas Gravações.`);
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = lyricsContainerRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop = maxScroll * pct;
    handleScrollUpdate();
  };

  return (
    <section id="showMode" className="show-mode relative">
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
          <strong className="block text-[10px] sm:text-xs text-zinc-400 truncate uppercase tracking-wider">{song.artist || 'Artista'}</strong>
          <span id="showSongTitle" className="block text-xs sm:text-base font-black text-white truncate max-w-full">{song.title}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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

      {/* ÁREA DE LETRAS */}
      <main className="lyrics-area w-full max-w-full overflow-hidden">
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
            </div>
          </div>
        </div>

        <div
          id="lyrics"
          className="lyrics w-full max-w-2xl mx-auto px-2 sm:px-6 text-center select-none"
          ref={lyricsContainerRef}
          onScroll={handleScrollUpdate}
          style={{ fontSize: `${fontSize}px` }}
        >
          {lines.map((line, idx) => {
            const isHighlighted = idx === activeLineIndex;
            return (
              <p
                key={idx}
                className={`${isHighlighted ? 'highlight' : ''} break-words leading-relaxed`}
                onClick={() => {
                  setActiveLineIndex(idx);
                  if (lyricsContainerRef.current) {
                    const maxScroll =
                      lyricsContainerRef.current.scrollHeight -
                      lyricsContainerRef.current.clientHeight;
                    lyricsContainerRef.current.scrollTop =
                      (idx / lines.length) * maxScroll;
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {line}
              </p>
            );
          })}
          <div className="h-64" />
        </div>

        {/* CONTROLES DE ROLAGEM (DESKTOP) */}
        <aside className="show-controls">
          <span className="control-title">VELOCIDADE DA LETRA</span>

          <div className="speed-control">
            <button onClick={() => changeSpeed(-0.25)}>−</button>
            <strong id="speedValue">{speed.toFixed(1)}x</strong>
            <button onClick={() => changeSpeed(0.25)}>+</button>
          </div>

          <div className="speed-list">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={speed === s ? 'active' : ''}
              >
                {s.toFixed(2).replace('.00', '.0').replace('0.75', '0.75')}x
              </button>
            ))}
          </div>

          {/* MODO VELOCIDADE TEMPO REAL (BPM / TEMPO DA MÚSICA) */}
          <div className="mt-3 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Tempo Real (BPM)
              </span>
              <button
                type="button"
                id="btn-toggle-realtime-tempo"
                onClick={() => {
                  setIsRealTempoMode(!isRealTempoMode);
                  setSavedRecordingToast(
                    !isRealTempoMode
                      ? `Modo Tempo Real ativado! A letra acompanhará a duração de ${Math.floor(customDurationSeconds / 60)}:${String(customDurationSeconds % 60).padStart(2, '0')}.`
                      : 'Modo velocidade manual ativado.'
                  );
                  setTimeout(() => setSavedRecordingToast(null), 3000);
                }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  isRealTempoMode
                    ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/30'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {isRealTempoMode ? 'ATIVO' : 'DESLIGADO'}
              </button>
            </div>

            <p className="text-[10px] text-zinc-400 leading-tight">
              {isRealTempoMode
                ? `⚡ Sincronizado: ${Math.floor(customDurationSeconds / 60)}:${String(customDurationSeconds % 60).padStart(2, '0')} (${songBpm} BPM)`
                : 'Ajusta a rolagem para passar a letra exatamente no tempo real da música.'}
            </p>

            <button
              type="button"
              id="btn-open-tempo-modal"
              onClick={() => setShowTempoModal(true)}
              className="w-full py-1.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>Ajustar BPM / Tempo</span>
            </button>
          </div>

          <button
            id="recordButton"
            className={`record-show-button ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
          >
            {isRecording ? `🔴 Gravando (${recordingTime}s)` : '🔴 Gravar'}
          </button>
        </aside>
      </main>

      {/* BARRA INFERIOR (RODAPÉ) */}
      <footer className="show-player">
        <div className="progress" onClick={handleSeek}>
          <div
            id="progressBar"
            className="progress-fill"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        <div className="show-player-content w-full max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 w-full">
            {/* GRUPO ESQUERDA: GRAVAR, VELOCIDADE & FONTE */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start flex-wrap">
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

              <div className="mobile-speed-control flex items-center shrink-0" title="Velocidade da letra">
                <button onClick={() => changeSpeed(-0.25)} aria-label="Diminuir velocidade">−</button>
                <span className="speed-val">{speed.toFixed(1)}x</span>
                <button onClick={() => changeSpeed(0.25)} aria-label="Aumentar velocidade">+</button>
              </div>

              {/* Controles de fonte em mobile */}
              <div className="flex sm:hidden items-center gap-1 shrink-0">
                <button onClick={() => changeFontSize(-2)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700" title="Diminuir fonte">A−</button>
                <button onClick={() => changeFontSize(2)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold border border-zinc-700" title="Aumentar fonte">A+</button>
              </div>
            </div>

            {/* GRUPO CENTRAL: TRANSPORTE DE MÚSICA & ROLAGEM */}
            <div className="player-controls flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button onClick={lyricsStart} title="Voltar ao início da letra" className="hover:text-white transition-colors p-1.5 text-xs text-zinc-400 hidden xs:inline-flex">
                |◀
              </button>

              {hasPlaylist && (
                <button
                  id="btn-prev-song-setlist"
                  onClick={handlePrevSong}
                  disabled={!prevSong}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold disabled:opacity-30 shrink-0"
                  title={prevSong ? `Anterior: ${prevSong.title}` : 'Música anterior'}
                >
                  <SkipBack className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs">Ant</span>
                </button>
              )}

              {/* BOTÃO PLAY / PAUSE TELEPROMPTER */}
              <button
                id="playButton"
                className="play-main hover:scale-105 active:scale-95 transition-transform shrink-0"
                onClick={toggleLyrics}
                title={isPlaying ? 'Pausar rolagem automática' : 'Iniciar rolagem automática'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>

              {hasPlaylist && (
                <button
                  id="btn-next-song-setlist-main"
                  onClick={handleNextSong}
                  disabled={!nextSong}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-xs tracking-wide flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer border border-amber-300/50 disabled:opacity-40 shrink-0"
                  title={nextSong ? `Próxima: ${nextSong.title}` : 'Próxima música'}
                >
                  <span className="text-xs">Próx</span>
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button onClick={lyricsEnd} title="Ir ao final da letra" className="hover:text-white transition-colors p-1.5 text-xs text-zinc-400 hidden xs:inline-flex">
                ▶|
              </button>
            </div>

            {/* GRUPO DIREITA: DESKTOP FONTE E SAIR */}
            <div className="player-options hidden sm:flex items-center gap-2">
              <button onClick={() => changeFontSize(-2)} title="Diminuir fonte">
                A−
              </button>
              <button onClick={() => changeFontSize(2)} title="Aumentar fonte">
                A+
              </button>
              <button onClick={onClose} title="Sair do modo show">
                ✕ Sair
              </button>
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
                <h3 className="text-base font-bold">Modo Tempo Real da Música</h3>
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
                  Duração Real da Música (Minutos : Segundos)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[150, 180, 210, 240, 270, 300, 330, 360].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setCustomDurationSeconds(sec)}
                      className={`py-2 px-1 rounded-xl text-xs font-mono font-bold transition-all ${
                        customDurationSeconds === sec
                          ? 'bg-amber-400 text-zinc-950 shadow-md'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Andamento da Música (BPM: {songBpm})
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
                  <span>60 Lento (Balada)</span>
                  <span>120 Padrão</span>
                  <span>200 Rápido (Rock)</span>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs text-zinc-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tempo total:</span>
                  <strong className="text-white font-mono">
                    {Math.floor(customDurationSeconds / 60)}m {customDurationSeconds % 60}s
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Velocidade calculada:</span>
                  <strong className="text-amber-400 font-mono">Sincronia Exata</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRealTempoMode(true);
                  setShowTempoModal(false);
                  setSavedRecordingToast(
                    `Tempo Real Ativado: ${Math.floor(customDurationSeconds / 60)}:${String(customDurationSeconds % 60).padStart(2, '0')}`
                  );
                  setTimeout(() => setSavedRecordingToast(null), 3000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
              >
                Ativar & Sincronizar
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
