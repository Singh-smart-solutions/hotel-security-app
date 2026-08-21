import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

const ICONS = {
  success: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  error:   <AlertTriangle className="h-4 w-4 text-red-400" />,
  info:    <Info className="h-4 w-4 text-indigo-400" />,
};

const BORDERS = {
  success: 'border-emerald-500/40 bg-emerald-950/80',
  error:   'border-red-500/40 bg-red-950/80',
  info:    'border-indigo-500/40 bg-indigo-950/80',
};

export default function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-4 duration-300 ${BORDERS[t.type] || BORDERS.info}`}
        >
          <span className="mt-0.5 flex-shrink-0">{ICONS[t.type] || ICONS.info}</span>
          <p className="flex-1 text-sm text-white leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-slate-400 hover:text-white transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
