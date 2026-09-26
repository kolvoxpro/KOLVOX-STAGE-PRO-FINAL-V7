import React from 'react';
import { Recording } from '../types/kolvox';
import { X, Download, Trash2, Video, Calendar, Clock } from 'lucide-react';

interface VideoPlaybackModalProps {
  isOpen: boolean;
  recording: Recording | null;
  onClose: () => void;
  onDelete?: (recId: string) => void;
  onDownload?: (rec: Recording) => void;
}

export const VideoPlaybackModal: React.FC<VideoPlaybackModalProps> = ({
  isOpen,
  recording,
  onClose,
  onDelete,
  onDownload,
}) => {
  if (!isOpen || !recording) return null;

  return (
    <div
      id="video-playback-modal-overlay"
      className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="video-playback-modal-dialog"
        className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4 p-5 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white truncate max-w-md">
                {recording.song_title}
              </h3>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span>{recording.song_artist || 'Kolvox Studio'}</span>
                <span>•</span>
                <span>{Math.round(recording.duration)}s</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Fechar Vídeo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Element */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-800">
          <video
            src={recording.file_url}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 text-xs">
          <div className="text-zinc-500 font-mono text-[11px]">
            {recording.created_at
              ? new Date(recording.created_at).toLocaleString('pt-BR')
              : 'Gravação Recente'}
          </div>

          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(recording)}
                className="px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Vídeo (.webm)</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(recording.id);
                  onClose();
                }}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                title="Excluir gravação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
