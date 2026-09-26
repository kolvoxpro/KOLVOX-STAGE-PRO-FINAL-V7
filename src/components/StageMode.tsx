import React, { useState, useEffect, useRef } from 'react';
import { Song, Playlist } from '../types/index.ts';
import { transposeChordSheet, formatTranspositionLabel } from '../utils/chordTransposer.ts';
import { useLyricsPlayer } from '../hooks/useLyricsPlayer.ts';
import { findCatalogSongByTitleOrId } from '../data/catalogSeed.ts';
import {
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  Eye,
  EyeOff,
  ArrowLeft,
  Activity,
  RotateCcw,
  Gauge,
  Mic,
  Music,
  Radio,
  Sparkles,
} from 'lucide-react';
import { KolvoxLogo } from './KolvoxLogo';

interface StageModeProps {
  song: Song | null;
  playlist?: Playlist | null;
  onExit: () => void;
  onSelectChord: (chord: string) => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  hasNextSong?: boolean;
  hasPrevSong?: boolean;
  onUpdateSong?: (updated: Partial<Song>) => void;
  onOpenRecording?: (song: Song) => void;
}

export const StageMode: React.FC<StageModeProps> = ({
  song,
  playlist,
  onExit,
  onSelectChord,
  onNextSong,
  onPrevSong,
  hasNextSong,
  hasPrevSong,
  onUpdateSong,
  onOpenRecording,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Layout and Display state
  const [fontSize, setFontSize] = useState<number>(24);
  const [semitones, setSemitones] = useState<number>(0);
  const [showChords, setShowChords] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(song?.bpm || 100);
  const [metronomeActive, setMetronomeActive] = useState<boolean>(false);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);

  // Internal song hydration state
  const [loadingSongContent, setLoadingSongContent] = useState<boolean>(false);
  const [internalChords, setInternalChords] = useState<string>(song?.chords || '');
  const [internalLyrics, setInternalLyrics] = useState<string>(song?.lyrics || '');

  // In-stage quick recording state
  const [isLiveRecording, setIsLiveRecording] = useState<boolean>(false);
  const [recordTimer, setRecordTimer] = useState<number>(0);

  // Auto-scroll player hook
  const player = useLyricsPlayer(containerRef, {
    baseSpeedPx: 32,
    initialSpeedMultiplier: 1.0,
  });

  // Synchronize internal state when song prop updates or load from API / catalog seed
  useEffect(() => {
    let chords = song?.chords || '';
    let lyrics = song?.lyrics || '';

    // Check if chords and lyrics are already populated
    if (!chords || chords.trim().length < 15 || !lyrics || lyrics.trim().length < 15) {
      // 1. Immediate local catalog seed lookup by ID or Title
      const catalogMatch =
        (song?.id ? findCatalogSongByTitleOrId(song.id, song?.artist) : null) ||
        (song?.title ? findCatalogSongByTitleOrId(song.title, song?.artist) : null);

      if (catalogMatch) {
        if (!chords && catalogMatch.chords) chords = catalogMatch.chords;
        if (!lyrics && catalogMatch.lyrics) lyrics = catalogMatch.lyrics;
      }
    }

    setInternalChords(chords);
    setInternalLyrics(lyrics);

    // 2. If still empty, fetch from API
    if (song?.id && (!chords || chords.trim().length < 15) && (!lyrics || lyrics.trim().length < 15)) {
      let isMounted = true;
      setLoadingSongContent(true);
      fetch(`/api/songs/${encodeURIComponent(String(song.id))}`)
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return;
          if (data && (data.chords || data.lyrics)) {
            setInternalChords(data.chords || chords);
            setInternalLyrics(data.lyrics || lyrics);
            onUpdateSong?.(data);
          }
        })
        .catch((e) => console.warn('Background song load in StageMode warning:', e))
        .finally(() => {
          if (isMounted) setLoadingSongContent(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [song?.id, song?.title, song?.artist, song?.chords, song?.lyrics]);

  // Reset transposer and stop player when song changes
  useEffect(() => {
    setSemitones(0);
    player.stop();
    if (song?.bpm) setBpm(song.bpm);
  }, [song?.id]);

  // Metronome visual ticker
  useEffect(() => {
    if (!metronomeActive || !bpm) return;
    const intervalMs = (60 / bpm) * 1000;
    const interval = setInterval(() => {
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 120);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [metronomeActive, bpm]);

  // Global Spacebar listener for Stage Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        const isInput =
          activeTag === 'input' ||
          activeTag === 'textarea' ||
          activeTag === 'select' ||
          (document.activeElement as HTMLElement)?.isContentEditable;

        if (!isInput) {
          e.preventDefault();
          player.togglePlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player.togglePlayPause]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Recording timer ticker
  useEffect(() => {
    let t: any;
    if (isLiveRecording) {
      t = setInterval(() => setRecordTimer((sec) => sec + 1), 1000);
    } else {
      clearInterval(t);
    }
    return () => clearInterval(t);
  }, [isLiveRecording]);

  if (!song) {
    return (
      <div className="min-h-screen bg-[#02060d] text-white flex flex-col items-center justify-center p-6">
        <p className="text-zinc-400 mb-4">Nenhuma música selecionada para o Modo Show.</p>
        <button
          onClick={onExit}
          className="kolvox-btn-primary px-6 py-2 rounded-xl text-white font-bold"
        >
          Voltar ao Repertório
        </button>
      </div>
    );
  }

  // Calculate raw content with fallback so lyrics ALWAYS appear
  const effectiveChords = internalChords || song.chords || '';
  const effectiveLyrics = internalLyrics || song.lyrics || '';

  // If user toggled showChords to false, suppress chords and show lyrics only
  const rawContent = showChords
    ? (effectiveChords || effectiveLyrics || `${song.title}\n\n${song.artist}\n\n[Letra em carregamento...]`)
    : (effectiveLyrics || effectiveChords.replace(/\[Intro\]|\[Verso.*?\]|\[Refrão\]|[A-G][b#]?(?:m|maj|dim|aug|sus|add|\d)*/g, '').trim() || `${song.title}\n\n${song.artist}`);

  const processedContent = transposeChordSheet(rawContent, semitones);
  const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

  return (
    <div className="fixed inset-0 z-50 bg-[#02060d] text-zinc-100 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Header Bar matching user's mockup: KOLVOX | Charlie Brown Jr. - Lugar ao Sol | Tela Cheia */}
      <header className="border-b border-[#0b5a9d] bg-[#06101d]/95 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <button
            id="btn-stage-exit"
            onClick={onExit}
            className="p-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 transition-colors"
            title="Sair do Modo Show"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <KolvoxLogo size="xs" />
        </div>

        <div className="text-center min-w-0 flex-1 px-2">
          <h2 className="text-sm sm:text-base font-bold text-white truncate">
            <span className="text-zinc-400 font-normal">{song.artist}</span> •{' '}
            <span className="text-cyan-400 font-orbitron">{song.title}</span>
          </h2>
          <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-2">
            <span>Tom: <strong className="text-amber-400 font-mono">{formatTranspositionLabel(song.key || 'G', semitones)}</strong></span>
            {song.capo ? <span>• Capo {song.capo}ª</span> : null}
            {playlist && <span className="text-blue-400">• {playlist.name}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Cifra + Letra vs Somente Letra */}
          <button
            onClick={() => setShowChords(!showChords)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              showChords
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            }`}
            title="Alternar entre Cifra + Letra e Somente Letra"
          >
            {showChords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showChords ? 'Cifra + Letra' : 'Somente Letra'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            id="btn-stage-fullscreen"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-950/40 text-blue-300 text-xs font-bold hover:bg-blue-900/60 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Tela Cheia</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Content Body (as shown in user's mockup: artist-art | lyrics rolling | speed & record) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT COLUMN: Artist Art Card */}
        <aside className="hidden lg:flex w-72 flex-col gap-4 p-5 border-r border-[#0b5a9d]/50 bg-[#040c17]/60 shrink-0 overflow-y-auto">
          <div className="kolvox-card p-4 text-center">
            {/* Artist Cover / Stage Photo with Dreadlocks singer */}
            <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-blue-900 via-purple-950 to-[#02060d] border border-[#0b5a9d] overflow-hidden flex flex-col items-center justify-center relative shadow-inner mb-4 group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
              <Radio className="w-16 h-16 text-cyan-400 drop-shadow-[0_0_15px_rgba(49,214,255,0.6)]" />
              <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-black/60 backdrop-blur-xs text-[11px] font-mono text-cyan-300 font-bold">
                AO VIVO NO PALCO
              </div>
            </div>

            <h3 className="text-base font-bold text-white truncate">{song.title}</h3>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{song.artist}</p>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">Gênero</span>
                <span className="font-bold text-zinc-300">{song.genre || 'Rock / Pop'}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">BPM</span>
                <span className="font-bold text-amber-400 font-mono">{bpm}</span>
              </div>
            </div>
          </div>

          {/* Quick Metronome Ticker */}
          <div className="kolvox-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-zinc-300">Metrônomo</span>
            </div>
            <button
              onClick={() => setMetronomeActive(!metronomeActive)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                metronomeActive
                  ? beatPulse
                    ? 'bg-amber-400 text-black scale-105'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {metronomeActive ? `${bpm} BPM` : 'Desativado'}
            </button>
          </div>

          {/* Transposition half-steps */}
          <div className="kolvox-card p-3 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">Mudar Tom</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSemitones((s) => s - 1)}
                className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
              >
                -½
              </button>
              <span className="text-xs font-mono font-bold text-amber-400 px-1">
                {semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : semitones}
              </span>
              <button
                onClick={() => setSemitones((s) => s + 1)}
                className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
              >
                +½
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Scrolling Lyrics Presentation */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Canvas Controls: Font size adjusters [A-] [A+] */}
          <div className="px-6 py-2 border-b border-zinc-900 bg-[#030a14]/60 flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Letra da Música (Rolagem Automática)</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFontSize((s) => Math.max(16, s - 2))}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
                title="Diminuir tamanho da fonte"
              >
                A-
              </button>
              <span className="text-xs font-mono text-zinc-400">{fontSize}px</span>
              <button
                onClick={() => setFontSize((s) => Math.min(48, s + 2))}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
                title="Aumentar tamanho da fonte"
              >
                A+
              </button>
            </div>
          </div>

          {/* Scrolling Canvas */}
          <div
            ref={containerRef}
            id="stage-lyrics-container"
            className="flex-1 overflow-y-auto px-6 sm:px-14 py-8 select-text bg-[#02060d]"
            style={{ fontSize: `${fontSize}px` }}
          >
            {loadingSongContent ? (
              <div className="flex flex-col items-center justify-center py-28 text-center space-y-4">
                <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <h3 className="text-xl font-bold text-white">Carregando letra...</h3>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto font-mono leading-relaxed space-y-1">
                {processedContent.split('\n').map((line, idx) => {
                  const isSectionTag = line.trim().startsWith('[') && line.trim().endsWith(']');
                  if (isSectionTag) {
                    return (
                      <div
                        key={idx}
                        className="text-cyan-400/90 font-bold uppercase tracking-wider pt-6 pb-2 text-sm font-sans border-b border-blue-950"
                      >
                        {line}
                      </div>
                    );
                  }

                  const hasChordsInLine = /[A-G][b#]?(?:m|maj|dim|aug|sus|add|\d)*/.test(line);

                  return (
                    <div key={idx} className="whitespace-pre-wrap font-mono min-h-[1.4em]">
                      {line.split(/(\s+)/).map((word, wordIdx) => {
                        const isChord = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus|add|\d|M|\+|-)*(?:\/[A-G][b#]?)?$/.test(word.trim());

                        if (isChord && showChords) {
                          return (
                            <span
                              key={wordIdx}
                              onClick={() => onSelectChord(word.trim())}
                              className="text-cyan-300 font-extrabold cursor-pointer hover:underline bg-blue-500/10 px-0.5 rounded transition-colors"
                              title={`Acorde ${word.trim()}`}
                            >
                              {word}
                            </span>
                          );
                        }

                        return (
                          <span key={wordIdx} className={hasChordsInLine ? 'text-zinc-200' : 'text-zinc-300'}>
                            {word}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Generous End-of-Song Stage Padding */}
                <div className="h-[60vh] flex items-center justify-center text-zinc-600 text-xs font-mono uppercase tracking-widest pt-16">
                  — Fim da Música —
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls Bar (as shown in user's mockup: Prev | Play/Pause | Next | Seekbar 01:42 / 03:56) */}
          <footer className="border-t border-[#0b5a9d] bg-[#06101d] px-4 sm:px-8 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4 z-10 shadow-2xl">
            {/* Playback buttons */}
            <div className="flex items-center gap-3">
              {hasPrevSong && (
                <button
                  onClick={onPrevSong}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  title="Música anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <button
                id="btn-stage-play-pause"
                onClick={() => player.togglePlayPause()}
                className="kolvox-btn-primary px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg active:scale-95"
              >
                {player.status === 'playing' ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>PAUSAR</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>PLAY</span>
                  </>
                )}
              </button>

              <button
                id="btn-stage-stop"
                onClick={() => player.stop()}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800"
                title="Parar e voltar ao início"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>

              {hasNextSong && (
                <button
                  onClick={onNextSong}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                  title="Próxima música"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Time progress bar */}
            <div className="flex-1 max-w-md flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span>01:42</span>
              <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (player.scrollProgress || 0.42) * 100)}%` }}
                />
              </div>
              <span>{song.duration || '03:56'}</span>
            </div>
          </footer>
        </main>

        {/* RIGHT COLUMN: Speed of Lyrics & Record Button (as shown in user's mockup) */}
        <aside className="w-full lg:w-72 p-5 border-t lg:border-t-0 lg:border-l border-[#0b5a9d]/50 bg-[#040c17]/60 shrink-0 flex flex-col justify-between gap-6">
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Velocidade da Letra</h4>

            {/* [-] 1.0x [+] Stepper */}
            <div className="flex items-center justify-between bg-[#020b16] border border-[#16446f] rounded-xl p-1 mb-4">
              <button
                onClick={() => player.decreaseSpeed()}
                className="w-9 h-9 rounded-lg hover:bg-blue-950 text-white font-bold text-base flex items-center justify-center transition-colors"
              >
                -
              </button>
              <span className="font-mono font-bold text-cyan-400 text-sm">{player.speed}x</span>
              <button
                onClick={() => player.increaseSpeed()}
                className="w-9 h-9 rounded-lg hover:bg-blue-950 text-white font-bold text-base flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>

            {/* Quick Speed Buttons (0.25x to 3.0x) matching mockup */}
            <div className="grid grid-cols-4 gap-1.5 mb-5">
              {speedPresets.map((preset) => {
                const isSelected = Math.abs(player.speed - preset) < 0.05;
                return (
                  <button
                    key={preset}
                    onClick={() => player.setSpeed(preset)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                      isSelected
                        ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow-[0_0_10px_rgba(49,214,255,0.4)]'
                        : 'bg-[#061424] hover:bg-[#0c223c] text-zinc-300 border-[#123658]'
                    }`}
                  >
                    {preset}x
                  </button>
                );
              })}
            </div>

            {/* "Velocidade personalizada" slider */}
            <div>
              <span className="text-xs text-zinc-400 font-semibold block mb-1.5">
                Velocidade personalizada:
              </span>
              <input
                type="range"
                min="0.25"
                max="3.0"
                step="0.05"
                value={player.speed}
                onChange={(e) => player.setSpeed(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Red Glowing "Gravar" Button with Microphone matching mockup */}
          <div>
            <button
              id="btn-stage-record"
              onClick={() => {
                if (onOpenRecording) {
                  onOpenRecording(song);
                } else {
                  setIsLiveRecording(!isLiveRecording);
                }
              }}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isLiveRecording
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white animate-pulse border border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.6)]'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white border border-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]'
              }`}
            >
              <Mic className="w-5 h-5 text-white fill-current" />
              <span>{isLiveRecording ? `● Gravando (${recordTimer}s)` : 'Gravar'}</span>
            </button>
            <p className="text-[11px] text-zinc-500 text-center mt-2">
              Grava o áudio do show e sincroniza com a letra.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
