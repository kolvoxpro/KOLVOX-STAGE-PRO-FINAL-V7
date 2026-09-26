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
    <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold mb-1 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ESTÚDIO DE GRAVAÇÃO & FILMAGEM KOLVOX</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Gravação HD & Filmagem de Palco
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Áudio com limitador dinâmico de estúdio (sem distorção / sem estourar) e modo filmagem com câmera ao vivo.
          </p>
        </div>

        {/* Mode Selector (Apenas Áudio vs Filmagem com Vídeo) */}
        {!isRecording && (
          <div className="flex items-center bg-zinc-950 p-1 rounded-2xl border border-zinc-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('audio')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'audio'
                  ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Apenas Áudio</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('video')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'video'
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 shadow-md shadow-cyan-400/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Filmagem & Áudio</span>
            </button>
          </div>
        )}
      </div>

      {/* Video Viewfinder Screen (when mode is video) */}
      {mode === 'video' && (
        <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 aspect-video max-h-[380px] w-full flex items-center justify-center shadow-inner">
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
              <Camera className="w-12 h-12 text-zinc-600 mx-auto animate-pulse" />
              <div className="text-sm font-bold text-zinc-300">
                Câmera em Espera
              </div>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                A prévia da sua câmera será ativada ao iniciar a filmagem ou você pode testá-la gravando um ensaio.
              </p>
            </div>
          )}

          {/* Video Overlay Top Badge */}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-red-500/50 text-red-400 text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
              <span>REC • {formatTimer(recordingTime)}</span>
            </div>
          )}

          {/* Camera Switcher (Front/Back) */}
          {liveStream && (
            <button
              type="button"
              onClick={switchCamera}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Trocar Câmera (Frontal / Traseira)"
            >
              <SwitchCamera className="w-4 h-4" />
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
      <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-zinc-200">
              Nível de Captação do Microfone:
            </span>
            <span className="font-mono text-zinc-400">{volumeLevel}%</span>
          </div>

          {/* Audio Safety Status */}
          <div className="flex items-center gap-1.5">
            {isLimiterActive ? (
              <span className="text-[11px] font-extrabold text-amber-400 flex items-center gap-1 animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                <span>Limitador Dinâmico Atuando (Sem Estourar)</span>
              </span>
            ) : volumeLevel > 0 ? (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Nível Perfeito • Protegido Contra Estouro</span>
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-medium">
                Aguardando sinal de áudio...
              </span>
            )}
          </div>
        </div>

        {/* Visual VU Meter Bar */}
        <div className="h-3 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 flex">
          <div
            className={`h-full transition-all duration-75 rounded-full ${
              isLimiterActive
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
            }`}
            style={{ width: `${Math.max(4, volumeLevel)}%` }}
          />
        </div>
      </div>

      {/* Song Association & Title Input (when idle) */}
      {!isRecording && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-zinc-400 font-bold mb-1">
              Associar a uma Música do seu Acervo (Opcional):
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-hidden focus:border-amber-400"
            >
              <option value="">— Nenhuma música específica (Gravação Livre) —</option>
              {userSongs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} • {s.artist}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-bold mb-1">
              Título da Gravação:
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-hidden focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        {/* Timer display */}
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-ping shrink-0" />
            <div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-white tracking-wider">
                {formatTimer(recordingTime)}
              </div>
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest block">
                {isPaused
                  ? 'Gravação Pausada'
                  : mode === 'video'
                  ? 'Filmando Vídeo & Captando Áudio HD'
                  : 'Gravando Áudio Studio HD'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-400">
            Pressione para iniciar a gravação com qualidade de estúdio e proteção de ganho.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {!isRecording ? (
            <button
              type="button"
              onClick={handleStart}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer hover:scale-102 active:scale-98 ${
                mode === 'video'
                  ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-zinc-950 shadow-cyan-500/25'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 shadow-amber-500/25'
              }`}
            >
              {mode === 'video' ? (
                <>
                  <Video className="w-4 h-4" />
                  <span>INICIAR FILMAGEM & CAPTAÇÃO</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>INICIAR GRAVAÇÃO DE ÁUDIO</span>
                </>
              )}
            </button>
          ) : (
            <>
              {/* Pause / Resume */}
              <button
                type="button"
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 fill-current text-amber-400" />
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
                className="p-3 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                title="Descartar gravação atual"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
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
