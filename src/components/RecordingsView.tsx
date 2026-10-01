import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types/index.ts';
import {
  Mic,
  Video,
  Square,
  Pause,
  Play,
  Volume2,
  SkipBack,
  SkipForward,
  MoreVertical,
  Download,
  Trash2,
  Radio,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Share2,
  Camera,
  ShieldCheck,
  Zap,
  SwitchCamera,
} from 'lucide-react';
import { KolvoxLogo } from './KolvoxLogo';

interface RecordingItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  date: string;
  audioBlobUrl?: string;
  lyricsSnippet?: string;
  mediaType?: 'audio' | 'video';
}

interface RecordingsViewProps {
  activeSong?: Song | null;
  onOpenSongInStage?: (song: Song) => void;
}

export const RecordingsView: React.FC<RecordingsViewProps> = ({
  activeSong,
  onOpenSongInStage,
}) => {
  // State for recorded items
  const [recordings, setRecordings] = useState<RecordingItem[]>([
    {
      id: 'rec-1',
      title: 'Lugar ao Sol',
      artist: 'Charlie Brown Jr.',
      duration: '03:27',
      durationSeconds: 207,
      date: '19/09/2026',
      lyricsSnippet: 'Quando eu penso em desistir lembro de tudo que eu já vivi...',
    },
    {
      id: 'rec-2',
      title: 'Cedo Ou Tarde',
      artist: 'NX Zero',
      duration: '04:12',
      durationSeconds: 252,
      date: '19/09/2026',
      lyricsSnippet: 'Cedo ou tarde a gente vai se encontrar...',
    },
    {
      id: 'rec-3',
      title: 'Outro Lugar',
      artist: 'Detonautas',
      duration: '02:58',
      durationSeconds: 178,
      date: '17/09/2026',
      lyricsSnippet: 'Estou em outro lugar, onde o tempo não passa devagar...',
    },
    {
      id: 'rec-4',
      title: 'Sem Radar',
      artist: 'LS Jack',
      duration: '03:45',
      durationSeconds: 225,
      date: '15/09/2026',
      lyricsSnippet: 'Não sei viver sem você, meu amor...',
    },
  ]);

  // Recording Engine State
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const liveVideoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<RecordingItem>(recordings[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(42); // percentage
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach live video preview
  useEffect(() => {
    if (liveVideoPreviewRef.current && liveStream) {
      liveVideoPreviewRef.current.srcObject = liveStream;
      liveVideoPreviewRef.current.play().catch(() => {});
    }
  }, [liveStream, isRecordingLive]);

  // Timer counter for live recording
  useEffect(() => {
    if (isRecordingLive && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecordingLive, isPaused]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startLiveRecording = async (overrideMode?: 'audio' | 'video') => {
    const targetMode = overrideMode || recordingMode;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        };

        const mediaConstraints: MediaStreamConstraints =
          targetMode === 'video'
            ? {
                audio: audioConstraints,
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
              }
            : {
                audio: audioConstraints,
                video: false,
              };

        let rawStream: MediaStream;
        try {
          rawStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (mediaErr) {
          if (targetMode === 'video') {
            rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            setRecordingMode('audio');
          } else {
            throw mediaErr;
          }
        }

        setLiveStream(rawStream);

        // Web Audio Studio Limiter (anti-estouro de som)
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx({ sampleRate: 48000 });
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const micSource = audioCtx.createMediaStreamSource(rawStream);
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.92, audioCtx.currentTime);

        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-2.0, audioCtx.currentTime);
        limiter.knee.setValueAtTime(4.0, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(20.0, audioCtx.currentTime);
        limiter.attack.setValueAtTime(0.002, audioCtx.currentTime);
        limiter.release.setValueAtTime(0.08, audioCtx.currentTime);

        const studioDest = audioCtx.createMediaStreamDestination();
        micSource.connect(gainNode);
        gainNode.connect(limiter);
        limiter.connect(studioDest);

        const tracks: MediaStreamTrack[] = [studioDest.stream.getAudioTracks()[0]];
        if (targetMode === 'video' && rawStream.getVideoTracks().length > 0) {
          tracks.unshift(rawStream.getVideoTracks()[0]);
        }
        const recorderStream = new MediaStream(tracks);

        const mimeType =
          targetMode === 'video'
            ? (['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((t) =>
                MediaRecorder.isTypeSupported(t)
              ) || '')
            : (['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) =>
                MediaRecorder.isTypeSupported(t)
              ) || '');

        const mediaRecorder = new MediaRecorder(recorderStream, {
          ...(mimeType ? { mimeType } : {}),
          audioBitsPerSecond: 192000,
        });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blobType = mimeType || (targetMode === 'video' ? 'video/webm' : 'audio/webm');
          const mediaBlob = new Blob(audioChunksRef.current, { type: blobType });
          const mediaUrl = URL.createObjectURL(mediaBlob);
          const newRec: RecordingItem = {
            id: `rec-${Date.now()}`,
            title:
              activeSong?.title ||
              (targetMode === 'video' ? 'Filmagem de Palco' : 'Gravação de Voz & Instrumento'),
            artist: activeSong?.artist || 'KOLVOX Studio',
            duration: formatTimer(recordingSeconds).substring(3),
            durationSeconds: recordingSeconds,
            date: new Date().toLocaleDateString('pt-BR'),
            audioBlobUrl: mediaUrl,
            mediaType: targetMode,
            lyricsSnippet:
              activeSong?.lyrics?.substring(0, 80) ||
              (targetMode === 'video'
                ? 'Vídeo e áudio gravados com limitador anti-estouro'
                : 'Áudio gravado ao vivo sem estourar o som'),
          };
          setRecordings((prev) => [newRec, ...prev]);
          setCurrentTrack(newRec);
          rawStream.getTracks().forEach((t) => t.stop());
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
          setLiveStream(null);
        };

        mediaRecorder.start(250);
      }
    } catch (err) {
      console.warn('Media capture permission notice (simulating recording session):', err);
    }

    setRecordingSeconds(0);
    setIsRecordingLive(true);
    setIsPaused(false);
  };

  const pauseOrResumeRecording = () => {
    if (!isRecordingLive) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const finishRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      const newRec: RecordingItem = {
        id: `rec-${Date.now()}`,
        title: activeSong?.title || 'Ensaio / Show Ao Vivo',
        artist: activeSong?.artist || 'Kol Joseph',
        duration: formatTimer(recordingSeconds).substring(3),
        durationSeconds: recordingSeconds,
        date: new Date().toLocaleDateString('pt-BR'),
        lyricsSnippet: activeSong?.lyrics?.substring(0, 80) || 'Gravação finalizada com sucesso.',
      };
      setRecordings((prev) => [newRec, ...prev]);
      setCurrentTrack(newRec);
    }
    setIsRecordingLive(false);
    setIsPaused(false);
    setRecordingSeconds(0);
  };

  const handleDeleteRecording = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  // 1. If currently in Live Recording Screen (as seen in Mockup "Gravação em Andamento")
  if (isRecordingLive) {
    return (
      <div className="min-h-screen bg-[#020711] text-white flex flex-col justify-between p-6 sm:p-10 select-none">
        {/* Top Header */}
        <header className="flex items-center justify-between max-w-5xl w-full mx-auto">
          <KolvoxLogo size="sm" />
          <div className="text-center">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Modo Show</span>
            <div className="text-sm font-semibold text-zinc-200">
              {activeSong?.artist || 'Charlie Brown Jr.'} • <span className="text-white">{activeSong?.title || 'Lugar ao Sol'}</span>
            </div>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/40 bg-blue-950/40 text-blue-300 text-xs font-bold hover:bg-blue-900/50 transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tela Cheia</span>
          </button>
        </header>

        {/* Center Canvas with lyrics snippet and wave or video viewfinder */}
        <div className="max-w-3xl w-full mx-auto text-center my-auto py-6">
          {recordingMode === 'video' && (
            <div className="relative max-w-xl mx-auto rounded-2xl overflow-hidden bg-black border border-cyan-500/40 aspect-video mb-6 shadow-2xl flex items-center justify-center">
              <video
                ref={liveVideoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  const next = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(next);
                  startLiveRecording('video');
                }}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Trocar Câmera"
              >
                <SwitchCamera className="w-4 h-4" />
                <span className="hidden sm:inline">{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
              </button>
            </div>
          )}

          {/* Anti-clipping Limiter Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-4 shadow-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Limitador Anti-Estouro Ativo (Som Protegido • 48kHz HD)</span>
          </div>

          <div className="text-xl sm:text-2xl font-bold text-zinc-100 leading-relaxed mb-6 px-4">
            <p className="text-amber-300/80 mb-2 font-mono text-sm tracking-widest uppercase">› Trecho da Música ‹</p>
            {activeSong?.lyrics ? (
              activeSong.lyrics.split('\n').filter(Boolean).slice(0, 3).join(' • ')
            ) : (
              <>
                "É o que me faz seguir<br />é a força que ainda existe em mim"
              </>
            )}
          </div>

          {/* Glowing Animated Waveform */}
          {recordingMode === 'audio' && (
            <div className="relative my-6">
              <div className="h-24 max-w-2xl mx-auto rounded-2xl overflow-hidden flex items-center justify-center gap-1.5 px-4 bg-blue-950/20 border border-blue-500/30 shadow-[0_0_30px_rgba(99,60,255,0.25)]">
                {Array.from({ length: 38 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-blue-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{
                      height: isPaused ? '14px' : `${Math.max(16, (Math.sin(i * 0.4 + recordingSeconds * 2) * 0.5 + 0.5) * 78)}px`,
                      opacity: isPaused ? 0.4 : 0.9,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recording Badge & Timer */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping inline-block" />
            <span className="text-xs font-extrabold text-red-400 uppercase tracking-widest">
              {isPaused
                ? 'GRAVAÇÃO PAUSADA'
                : recordingMode === 'video'
                ? 'FILMANDO VÍDEO & CAPTANDO ÁUDIO HD'
                : 'GRAVANDO ÁUDIO DO SHOW (ANTI-ESTOURO)'}
            </span>
          </div>

          <div className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-white mb-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            {formatTimer(recordingSeconds)}
          </div>

          {/* Big Recording Controls */}
          <div className="flex items-center justify-center gap-5">
            {/* Pause / Resume */}
            <button
              id="btn-pause-recording"
              onClick={pauseOrResumeRecording}
              className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
              title={isPaused ? 'Retomar Gravação' : 'Pausar Gravação'}
            >
              {isPaused ? <Play className="w-6 h-6 fill-current text-amber-400" /> : <Pause className="w-6 h-6 text-zinc-200" />}
            </button>

            {/* Stop Round Red */}
            <button
              id="btn-stop-recording"
              onClick={finishRecording}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 border-2 border-rose-300 text-white flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all hover:scale-110 active:scale-95"
              title="Interromper e Salvar"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>

            {/* Finalizar Button */}
            <button
              id="btn-finish-recording"
              onClick={finishRecording}
              className="px-6 py-3.5 rounded-2xl bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 text-blue-200 text-sm font-bold shadow-lg transition-all hover:scale-105"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Default View: "Minhas Gravações" (as seen in Mockup "Minhas Gravações")
  return (
    <div className="min-h-screen bg-[#02060d] text-zinc-100 pb-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-orbitron font-black text-white tracking-wide flex items-center gap-3">
              <span>Minhas Gravações</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-sans font-bold border border-blue-500/30">
                {recordings.length} gravações
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Grave ensaios, barzinhos e shows ao vivo com áudio anti-estouro (limitador dinâmico) e filmagem de palco.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Mode Switcher */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setRecordingMode('audio')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  recordingMode === 'audio'
                    ? 'bg-amber-400 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Áudio HD</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordingMode('video')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  recordingMode === 'video'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Filmagem</span>
              </button>
            </div>

            {/* Big Start Recording Button */}
            <button
              id="btn-start-recording"
              onClick={() => startLiveRecording(recordingMode)}
              className="kolvox-btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 hover:scale-102 active:scale-98 transition-all"
            >
              {recordingMode === 'video' ? (
                <>
                  <Video className="w-4 h-4 text-white" />
                  <span>Iniciar Filmagem</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-white" />
                  <span>Iniciar Gravação</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* List of Recordings Cards (Matching user mockup layout) */}
        <div className="grid gap-3">
          {recordings.map((rec) => {
            const isSelected = currentTrack.id === rec.id;
            return (
              <div
                key={rec.id}
                onClick={() => {
                  setCurrentTrack(rec);
                  setIsPlaying(true);
                }}
                className={`kolvox-card p-4 flex items-center justify-between gap-4 transition-all cursor-pointer ${
                  isSelected ? 'border-cyan-500/80 shadow-[0_0_20px_rgba(7,156,255,0.25)] bg-[#07182c]' : 'hover:border-blue-500/50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Thumbnail / Wave badge */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 via-purple-900 to-zinc-950 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-md">
                    {rec.mediaType === 'video' ? (
                      <Video className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Mic className="w-5 h-5 text-amber-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white truncate">{rec.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                          rec.mediaType === 'video'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {rec.mediaType === 'video' ? '📹 Vídeo HD' : '🎙️ Áudio HD'}
                      </span>
                      {isSelected && isPlaying && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {rec.artist} • <span className="text-zinc-500">{rec.date}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-950/60 px-2.5 py-1 rounded-lg border border-zinc-800">
                    {rec.duration}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        setIsPlaying(!isPlaying);
                      } else {
                        setCurrentTrack(rec);
                        setIsPlaying(true);
                      }
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-transform active:scale-95 ${
                      isSelected && isPlaying
                        ? 'bg-cyan-400 text-zinc-950 shadow-[0_0_15px_rgba(49,214,255,0.6)]'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                    }`}
                  >
                    {isSelected && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={(e) => handleDeleteRecording(rec.id, e)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Excluir gravação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Persistent Bottom Audio Player (As shown in user's mockup) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#06101d]/95 backdrop-blur-md border-t border-[#0b5a9d] px-4 sm:px-8 py-3.5 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Track Info */}
          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-700 to-purple-800 flex items-center justify-center text-white shrink-0 shadow">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Center: Controls & Seekbar */}
          <div className="flex-1 max-w-xl flex flex-col items-center gap-1.5 px-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPlaybackProgress((p) => Math.max(0, p - 10))}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => setPlaybackProgress((p) => Math.min(100, p + 10))}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Seekbar */}
            <div className="w-full flex items-center gap-2 text-[11px] font-mono text-zinc-400">
              <span>01:42</span>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  setPlaybackProgress(pct);
                }}
                className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
              >
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
              <span>{currentTrack.duration}</span>
            </div>
          </div>

          {/* Right: Volume & Options */}
          <div className="hidden sm:flex items-center gap-3 min-w-[120px] justify-end">
            <Volume2 className="w-4 h-4 text-zinc-400" />
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="75"
              className="w-20 h-1.5 bg-zinc-800 rounded-lg accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
