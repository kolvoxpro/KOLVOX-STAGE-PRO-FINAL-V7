import React, { useState, useRef, useEffect } from 'react';
import { Song, Recording } from '../types/kolvox';
import {
  useMediaStudioRecorder,
  RecordingMode,
} from '../hooks/useMediaStudioRecorder';
import {
  Mic,
  Video,
  Square,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Camera,
  SwitchCamera,
  Volume2,
  AlertTriangle,
  Loader2,
  Music,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MediaRecordingStudioProps {
  userSongs?: Song[];
  userId?: string;
  onSaveRecording: (recording: {
    song_id?: string;
    song_title: string;
    song_artist?: string;
    file_url: string;
    duration: number;
    media_type: 'audio' | 'video';
  }) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const MediaRecordingStudio: React.FC<MediaRecordingStudioProps> = ({
  userSongs = [],
  userId,
  onSaveRecording,
  onShowToast,
}) => {
  const {
    isRecording,
    isPaused,
    mode,
    recordingTime,
    volumeLevel,
    isLimiterActive,
    liveStream,
    error,
    setMode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    switchCamera,
    currentFacingMode,
  } = useMediaStudioRecorder();

  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Attach live camera stream to video preview element
  useEffect(() => {
    if (videoPreviewRef.current && liveStream) {
      videoPreviewRef.current.srcObject = liveStream;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [liveStream]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    const res = await startRecording({ mode });
    if (!res.success) {
      onShowToast(res.error || 'Erro ao iniciar dispositivo de captura.');
    } else {
      const typeLabel = mode === 'video' ? 'Filmagem em Vídeo' : 'Gravação de Áudio';
      onShowToast(`${typeLabel} iniciada com proteção anti-estouro ativada!`);
    }
  };

  const handleFinishAndSave = async () => {
    setIsSaving(true);
    try {
      const res = await stopRecording();
      if (!res) {
        setIsSaving(false);
        return;
      }

      const songObj = userSongs.find((s) => s.id === selectedSongId);
      const defaultTitle =
        mode === 'video'
          ? (songObj ? `${songObj.title} (Filmagem Ao Vivo)` : 'Filmagem & Captação Ao Vivo')
          : (songObj ? `${songObj.title} (Áudio de Ensaio)` : 'Gravação de Voz & Instrumento');

      const song_title = customTitle.trim() || defaultTitle;
      const song_artist = songObj?.artist || 'Kolvox Studio';

      await onSaveRecording({
        song_id: songObj?.id || '',
        song_title,
        song_artist,
        file_url: res.base64 || res.url,
        duration: res.duration || 1,
        media_type: res.mode,
      });

      confetti({ particleCount: 35, spread: 65, origin: { y: 0.6 } });
      onShowToast(
        mode === 'video'
          ? 'Filmagem em vídeo salva com sucesso!'
          : 'Gravação de áudio de alta qualidade salva com sucesso!'
      );
      setCustomTitle('');
    } catch (err) {
      console.error('Error saving recording:', err);
      onShowToast('Falha ao salvar a gravação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#0f172a] border-2 border-[#00e5ff] rounded-[24px] p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] space-y-6 sm:space-y-7">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none mb-1.5">
            Estúdio de Gravação HD
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Captura profissional com limitador dinâmico de estúdio.
          </p>
        </div>

        {/* Mode Selector (Apenas Áudio vs Filmagem + Áudio) */}
        {!isRecording && (
          <div className="flex bg-[#020617] p-1 rounded-xl border border-white/10 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setMode('audio')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'audio'
                  ? 'bg-[#00e5ff] text-[#020617] font-bold shadow-md shadow-[#00e5ff]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Apenas Áudio
            </button>
            <button
              type="button"
              onClick={() => setMode('video')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'video'
                  ? 'bg-[#00e5ff] text-[#020617] font-bold shadow-md shadow-[#00e5ff]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Filmagem + Áudio
            </button>
          </div>
        )}
      </div>

      {/* Video Viewfinder Screen (when mode is video) */}
      {mode === 'video' && (
        <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-video max-h-[380px] w-full flex items-center justify-center shadow-inner">
          {liveStream ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <Camera className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
              <div className="text-sm font-bold text-slate-300">
                Câmera em Espera
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                A prévia da sua câmera será ativada ao iniciar a filmagem ou você pode testá-la gravando um ensaio.
              </p>
            </div>
          )}

          {/* Video Overlay Top Badge */}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-red-500/50 text-red-400 text-xs font-black font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
              <span>REC • {formatTimer(recordingTime)}</span>
            </div>
          )}

          {/* Camera Switcher (Front/Back) */}
          {liveStream && (
            <button
              type="button"
              onClick={switchCamera}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Trocar Câmera (Frontal / Traseira)"
            >
              <SwitchCamera className="w-4 h-4 text-[#00e5ff]" />
              <span className="hidden sm:inline">
                {currentFacingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}
              </span>
            </button>
          )}

          {/* Studio Audio Limiter Pill Overlay on Video */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Limitador Anti-Estouro Ativo</span>
            </div>
            {isLimiterActive && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-zinc-950 text-[10px] font-black animate-pulse">
                <Zap className="w-3 h-3 fill-current" />
                <span>LIMITANDO PICO (-2dB)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-time Studio VU Meter & Anti-Clipping Indicator */}
      <div className="p-4 sm:p-5 bg-black/30 rounded-2xl border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs font-['JetBrains_Mono',monospace] font-medium">
          <span className="text-slate-400 tracking-wider">NÍVEL DE ENTRADA</span>
          <span className="text-[#00e5ff] font-semibold">
            {isLimiterActive
              ? '⚡ LIMITADOR DINÂMICO ATIVO (-2dB)'
              : volumeLevel > 0
              ? `Captação Ativa: ${volumeLevel}%`
              : 'Aguardando sinal... 0%'}
          </span>
        </div>

        {/* Visual VU Meter Bar */}
        <div className="h-3 bg-[#020617] rounded-full overflow-hidden border border-white/10 mt-2 flex">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${Math.max(4, volumeLevel)}%`,
              background: isLimiterActive
                ? 'linear-gradient(90deg, #00e5ff, #f59e0b, #ef4444)'
                : 'linear-gradient(90deg, #00e5ff, #10b981)',
            }}
          />
        </div>
      </div>

      {/* Song Association & Title Input (when idle) */}
      {!isRecording && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400">
              Associar a uma Música:
            </label>
            <select
              value={selectedSongId}
              onChange={(e) => {
                setSelectedSongId(e.target.value);
                const found = userSongs.find((s) => s.id === e.target.value);
                if (found && !customTitle) {
                  setCustomTitle(found.title);
                }
              }}
              className="bg-[#020617] border border-white/10 p-3 rounded-xl text-white text-xs sm:text-sm focus:border-[#00e5ff] focus:outline-hidden transition-colors"
            >
              <option value="">— Gravação Livre —</option>
              {userSongs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.artist ? `${s.artist} - ${s.title}` : s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400">
              Título da Performance:
            </label>
            <input
              type="text"
              placeholder={
                mode === 'video'
                  ? 'Ex: Filmagem do Ensaio, Solo de Guitarra...'
                  : 'Ex: Ensaio Vocal, Voz e Violão...'
              }
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="bg-[#020617] border border-white/10 p-3 rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-600 focus:border-[#00e5ff] focus:outline-hidden transition-colors"
            />
          </div>
        </div>
      )}

      {/* Controls Bar / Action Button */}
      <div className="pt-2">
        {!isRecording ? (
          <button
            type="button"
            onClick={handleStart}
            className="w-full bg-[#00e5ff] hover:bg-[#38bdf8] text-[#020617] p-4 sm:p-5 rounded-xl font-extrabold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(0,229,255,0.35)] active:translate-y-0 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" />
            </svg>
            <span>
              {mode === 'video' ? 'Iniciar Filmagem + Áudio' : 'Iniciar Gravação de Áudio'}
            </span>
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Timer display */}
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-ping shrink-0" />
              <div>
                <div className="text-2xl sm:text-3xl font-['JetBrains_Mono',monospace] font-black text-white tracking-wider">
                  {formatTimer(recordingTime)}
                </div>
                <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest block font-mono">
                  {isPaused
                    ? 'Gravação Pausada'
                    : mode === 'video'
                    ? 'Filmando Vídeo & Captando Áudio HD'
                    : 'Gravando Áudio Studio HD'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Pause / Resume */}
              <button
                type="button"
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 fill-current text-[#00e5ff]" />
                    <span>Retomar</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 text-zinc-200" />
                    <span>Pausar</span>
                  </>
                )}
              </button>

              {/* Stop & Save */}
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinishAndSave}
                className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalizar & Salvar</span>
                  </>
                )}
              </button>

              {/* Cancel / Discard */}
              <button
                type="button"
                onClick={cancelRecording}
                className="p-3 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Descartar gravação atual"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
