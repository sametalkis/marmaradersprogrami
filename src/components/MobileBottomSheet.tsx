import React from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  count?: number;
  children: React.ReactNode;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  count,
  children
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="w-full bg-white dark:bg-zinc-950 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-zinc-800 max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle Bar */}
        <div className="w-full flex items-center justify-center pt-3 pb-1 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-800 dark:text-white tracking-tight">
              {title}
            </h3>
            {count !== undefined && (
              <span className="inline-flex items-center justify-center min-w-[20px] px-2 py-1 text-xs leading-none font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full font-mono">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scroll-smooth">
          {children}
        </div>
      </div>
    </div>
  );
};
