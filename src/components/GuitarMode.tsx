import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types/index.ts';
import { transposeChordSheet, formatTranspositionLabel, CHORD_REGEX } from '../utils/chordTransposer.ts';
import { useLyricsPlayer, SPEED_PRESETS } from '../hooks/useLyricsPlayer.ts';
import { downloadLyricsOnly, downloadChordsAndLyrics } from '../utils/songExport.ts';
import { findCatalogSongByTitleOrId } from '../data/catalogSeed.ts';
import {
  Guitar,
  Sliders,
  Copy,
  Printer,
  Eye,
  Check,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Gauge,
  Download,
  FileText,
} from 'lucide-react';

interface GuitarModeProps {
  song: Song | null;
  onOpenInStage: (song: Song) => void;
  onSelectChord: (chord: string) => void;
  onUpdateSong?: (updated: Partial<Song>) => void;
}

export const GuitarMode: React.FC<GuitarModeProps> = ({
  song,
  onOpenInStage,
  onSelectChord,
  onUpdateSong,
}) => {
  const [semitones, setSemitones] = useState<number>(0);
  const [capo, setCapo] = useState<number>(song?.capo || 0);
  const [fontSize, setFontSize] = useState<number>(16);
  const [copied, setCopied] = useState<boolean>(false);
  const [uniqueChords, setUniqueChords] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Background hydration state
  const [loadingSongContent, setLoadingSongContent] = useState<boolean>(false);
  const [internalChords, setInternalChords] = useState<string>(song?.chords || '');
  const [internalLyrics, setInternalLyrics] = useState<string>(song?.lyrics || '');

  const sheetContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll player for Guitar Mode
  const player = useLyricsPlayer(sheetContainerRef, {
    baseSpeedPx: 28,
    initialSpeedMultiplier: 1.0,
  });

  useEffect(() => {
    setSemitones(0);
    setCapo(song?.capo || 0);
    player.stop();
  }, [song?.id]);

  // Synchronize internal state and load from API / catalog seed if empty
  useEffect(() => {
    let chords = song?.chords || '';
    let lyrics = song?.lyrics || '';

    // Check if chords and lyrics are already populated
    if (!chords || chords.trim().length < 15 || !lyrics || lyrics.trim().length < 15) {
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

    const needsContent = (!chords || chords.trim().length < 15) && (!lyrics || lyrics.trim().length < 15);
    if (song?.id && needsContent) {
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
        .catch((e) => console.warn('Background song load in GuitarMode warning:', e))
        .finally(() => {
          if (isMounted) setLoadingSongContent(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [song?.id, song?.title, song?.artist, song?.chords, song?.lyrics]);

  // Extract distinct chords
  useEffect(() => {
    if (!song) return;
    const text = internalChords || song.chords || internalLyrics || song.lyrics || '';
    const matches = text.match(CHORD_REGEX) || [];
    const unique = Array.from<string>(new Set(matches)).filter(
      (c) => c.length > 0 && !c.includes('[')
    );
    setUniqueChords(unique);
  }, [song, internalChords, internalLyrics]);

  // Global Spacebar listener for Guitar Mode
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!song) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <Guitar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-zinc-200">Nenhuma música selecionada</h3>
        <p className="text-sm text-zinc-400 mt-1">
          Selecione uma música no seu acervo ou pesquise para praticar violão.
        </p>
      </div>
    );
  }

  const effectiveChords = internalChords || song.chords || '';
  const effectiveLyrics = internalLyrics || song.lyrics || '';
  const rawContent = effectiveChords || effectiveLyrics || '';
  const transposedContent = transposeChordSheet(rawContent, semitones);

  const handleCopy = () => {
    navigator.clipboard.writeText(transposedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Controls Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold mb-2 border border-purple-500/20">
              <Guitar className="w-3.5 h-3.5" />
              <span>MODO VIOLÃO & ACORDES</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-display">
              {song.title}
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {song.artist} • Tom Base: <strong className="text-amber-400">{song.key || 'G'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-guitar-copy"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-zinc-700"
              title="Copiar cifra transposta"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              id="btn-guitar-print"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-zinc-700"
              title="Imprimir cifra"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            {/* Opção 1: Baixar Somente a Letra */}
            <button
              id="btn-guitar-download-lyrics"
              onClick={() => downloadLyricsOnly(song)}
              className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-sky-500/30"
              title="Baixar somente a letra da música (.txt)"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Só Letra (.txt)</span>
            </button>

            {/* Opção 2: Baixar Letra + Cifra (Barzinho) */}
            <button
              id="btn-guitar-download-chords"
              onClick={() => downloadChordsAndLyrics(song)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-amber-500/40"
              title="Baixar letra e cifra completa (.txt) com tom e acordes para barzinho"
            >
              <Guitar className="w-4 h-4 text-amber-400" />
              <span>Letra + Cifra (.txt)</span>
            </button>

            <button
              id="btn-guitar-to-stage"
              onClick={() => onOpenInStage(song)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-zinc-950 text-xs font-extrabold shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              <span>Modo Palco</span>
            </button>
          </div>
        </div>

        {/* Dynamic Tooling Bar */}
        <div className="mt-6 pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Transposer */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
            <span className="text-xs font-bold text-zinc-400 block mb-2">Transposição de Tom</span>
            <div className="flex items-center justify-between">
              <button
                id="btn-guitar-transp-down"
                onClick={() => setSemitones((s) => s - 1)}
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center text-sm"
              >
                -½
              </button>
              <div className="text-center">
                <span className="text-sm font-extrabold text-amber-400 font-mono block">
                  {formatTranspositionLabel(song.key || 'G', semitones)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {semitones === 0 ? 'Tom Original' : `${semitones > 0 ? '+' : ''}${semitones} semitons`}
                </span>
              </div>
              <button
                id="btn-guitar-transp-up"
                onClick={() => setSemitones((s) => s + 1)}
                className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center text-sm"
              >
                +½
              </button>
            </div>
            {semitones !== 0 && (
              <button
                onClick={() => setSemitones(0)}
                className="mt-2 text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 mx-auto"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar tom original
              </button>
            )}
          </div>

          {/* 2. Capo Selector */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
            <span className="text-xs font-bold text-zinc-400 block mb-2">Capotraste (Braçadeira)</span>
            <select
              id="select-guitar-capo"
              value={capo}
              onChange={(e) => setCapo(Number(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-400 font-medium"
            >
              <option value="0">Sem capotraste</option>
              <option value="1">Capo na 1ª casa</option>
              <option value="2">Capo na 2ª casa</option>
              <option value="3">Capo na 3ª casa</option>
              <option value="4">Capo na 4ª casa</option>
              <option value="5">Capo na 5ª casa</option>
              <option value="6">Capo na 6ª casa</option>
              <option value="7">Capo na 7ª casa</option>
            </select>
            <span className="text-[10px] text-zinc-500 mt-2 block">
              {capo > 0 ? `Toque os acordes indicados com o capo na ${capo}ª casa.` : 'Afinação aberta padrão.'}
            </span>
          </div>

          {/* 3. Guitar Tuning */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold text-zinc-400 block">Afinação Padrão</span>
            <div className="flex items-center justify-center gap-2 font-mono text-sm font-bold text-amber-400 my-1">
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">E</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">A</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">D</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">G</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">B</span>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded">E</span>
            </div>
            <span className="text-[10px] text-zinc-500 text-center block">
              BPM: {song.bpm || 100} • 4/4
            </span>
          </div>
        </div>

        {/* Unique Chords Interactive Pills */}
        {uniqueChords.length > 0 && (
          <div className="mt-5 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-zinc-300">
                Acordes desta música (clique para ver o diagrama no braço do violão):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueChords.map((chord) => (
                <button
                  key={chord}
                  onClick={() => onSelectChord(chord)}
                  className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-amber-300 font-mono font-bold text-xs border border-zinc-700 transition-colors shadow-xs"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auto-Scroll & View Toolbar for Guitar Mode */}
      <div className="sticky top-20 z-20 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-guitar-play"
            onClick={() => player.play()}
            disabled={player.status === 'playing'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
              player.status === 'playing'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>PLAY</span>
          </button>

          <button
            id="btn-guitar-pause"
            onClick={() => player.pause()}
            disabled={player.status !== 'playing'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
              player.status === 'playing'
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                : 'bg-zinc-800 text-zinc-600 border border-zinc-700 pointer-events-none'
            }`}
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>PAUSAR</span>
          </button>

          <button
            id="btn-guitar-stop"
            onClick={() => player.stop()}
            className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-zinc-700"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>PARAR</span>
          </button>

          {/* Speed Stepper */}
          <div className="flex items-center bg-zinc-950 rounded-xl border border-zinc-800 p-0.5 text-xs ml-1">
            <button
              onClick={() => player.decreaseSpeed()}
              className="px-2 py-0.5 hover:bg-zinc-800 text-zinc-400 font-bold"
            >
              −
            </button>
            <span className="px-1.5 font-mono font-bold text-amber-400">
              {player.speed}x
            </span>
            <button
              onClick={() => player.increaseSpeed()}
              className="px-2 py-0.5 hover:bg-zinc-800 text-zinc-400 font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Font size & Fullscreen */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-950 rounded-xl border border-zinc-800 p-0.5 text-xs">
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 2))}
              className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded"
              title="Diminuir fonte"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-zinc-300 font-bold">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(32, s + 2))}
              className="p-1.5 hover:bg-zinc-800 text-zinc-300 rounded"
              title="Aumentar fonte"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
            title="Tela cheia"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sheet Content Box with Scroll Container */}
      <div
        ref={sheetContainerRef}
        id="guitar-sheet-container"
        className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-10 font-mono leading-relaxed overflow-y-auto max-h-[70vh] shadow-inner"
        style={{ fontSize: `${fontSize}px` }}
      >
        {loadingSongContent ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-xl font-bold text-white">Carregando cifra e acordes...</h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Buscando a cifra completa e diagramas para seu estudo.
            </p>
          </div>
        ) : transposedContent.trim().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-8 max-w-md mx-auto my-6">
            <Guitar className="w-10 h-10 text-zinc-600 mb-1" />
            <h3 className="text-base font-bold text-zinc-200">Cifra ainda não disponível</h3>
            <p className="text-xs text-zinc-400">
              Esta música não contém texto de cifra ou letra cadastrado.
            </p>
          </div>
        ) : (
          <>
            <div className="max-w-3xl whitespace-pre-wrap">
              {transposedContent.split('\n').map((line, idx) => {
                const isTag = line.trim().startsWith('[') && line.trim().endsWith(']');
                if (isTag) {
                  return (
                    <div key={idx} className="text-amber-400 font-bold uppercase tracking-wider pt-4 pb-1 text-xs font-sans">
                      {line}
                    </div>
                  );
                }

                return (
                  <div key={idx} className="min-h-[1.5em]">
                    {line.split(/(\s+)/).map((segment, sIdx) => {
                      const isChord = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus|add|\d|M|\+|-)*(?:\/[A-G][b#]?)?$/.test(segment.trim());
                      if (isChord) {
                        return (
                          <span
                            key={sIdx}
                            onClick={() => onSelectChord(segment.trim())}
                            className="text-amber-400 font-extrabold cursor-pointer hover:underline hover:text-amber-300"
                            title={`Clique para ver o diagrama do acorde ${segment.trim()}`}
                          >
                            {segment}
                          </span>
                        );
                      }
                      return <span key={sIdx} className="text-zinc-300">{segment}</span>;
                    })}
                  </div>
                );
              })}
            </div>

            {/* Bottom padding */}
            <div className="h-64 flex items-center justify-center text-zinc-700 text-xs font-mono pt-12">
              — Fim da Cifra —
            </div>
          </>
        )}
      </div>
    </div>
  );
};
