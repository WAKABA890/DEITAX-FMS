import React from 'react';

export type AppDialogKind = 'confirmation' | 'warning' | 'error' | 'success' | 'delete';

interface AppDialogProps {
  open: boolean;
  kind?: AppDialogKind;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Shared in-app dialog; avoids browser/Electron confirmation UI. */
export const AppDialog: React.FC<AppDialogProps> = ({ open, kind = 'confirmation', title, message, confirmLabel, busy, onConfirm, onClose }) => {
  if (!open) return null;
  const destructive = kind === 'delete' || kind === 'warning' || kind === 'error';
  return <div className="fms-dialog-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
    <div className="fms-dialog w-full max-w-md rounded-2xl border p-6">
      <h2 id="app-dialog-title" className="text-base font-bold">{title}</h2>
      <p className="fms-text-secondary mt-3 text-sm leading-6">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="fms-btn fms-btn-secondary">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className={`fms-btn ${destructive ? 'fms-btn-danger' : 'fms-btn-primary'}`}>{busy ? 'Working…' : confirmLabel || (kind === 'delete' ? 'Delete' : 'Continue')}</button>
      </div>
    </div>
  </div>;
};
