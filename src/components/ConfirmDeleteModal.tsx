import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  warningMessage?: string;
  itemName?: string;
  itemType?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Confirmar Exclusão',
  message,
  warningMessage,
  itemName,
  itemType,
  confirmText = 'EXCLUIR',
  cancelText = 'CANCELAR',
  loading = false,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  const isBusy = loading || isDeleting;
  const displayMessage = message || warningMessage || 'Tem certeza que deseja excluir este item?';

  return (
    <div
      id="confirm-delete-modal-overlay"
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        id="confirm-delete-modal-dialog"
        className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close icon */}
        <button
          id="btn-confirm-modal-close"
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white font-display">
              {title}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Esta ação removerá o registro definitivamente da base de dados.
            </p>
          </div>
        </div>

        {/* Message body */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 space-y-1">
          <p className="font-medium">{displayMessage}</p>
          {itemName && (
            <p className="font-bold text-amber-400 font-mono break-all text-[13px] pt-1">
              "{itemName}"
            </p>
          )}
        </div>

        {/* Actions buttons: [CANCELAR] [EXCLUIR] */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            id="btn-confirm-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            id="btn-confirm-modal-confirm"
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>EXCLUINDO...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
