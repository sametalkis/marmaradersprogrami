import React from 'react';
import { AlertTriangle, X, Check, XCircle } from 'lucide-react';
import type { Course, ScheduleConflict } from '../types/Course';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  course: Course | null;
  conflicts: ScheduleConflict[];
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  course,
  conflicts
}) => {
  if (!isOpen || !course) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl max-w-lg w-full transform transition-all border border-slate-200 dark:border-zinc-900">
          {/* Header */}
          <div className="bg-slate-900 rounded-t-2xl px-6 py-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 id="confirm-modal-title" className="text-xl font-bold text-white tracking-tight">Saat Çakışması Tespit Edildi</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {/* Eklenecek ders */}
            <div className="mb-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Eklemek istediğiniz ders:</p>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl p-4">
                <div className="font-bold text-indigo-800 dark:text-indigo-300 text-lg">{course.courseCode}</div>
                <div className="text-indigo-700 dark:text-indigo-400">{course.courseName}</div>
                <div className="text-indigo-600 dark:text-indigo-400 text-sm mt-1">{course.instructor}</div>
                <div className="text-indigo-500 dark:text-indigo-300 text-xs mt-2 font-mono">{course.dayTimeLocation}</div>
              </div>
            </div>

            {/* Çakışan dersler */}
            <div className="mb-4">
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-2">
                Bu ders aşağıdaki {conflicts.length > 1 ? 'derslerle' : 'dersle'} çakışıyor:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <div 
                    key={index} 
                    className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-lg flex-shrink-0">
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-red-800 dark:text-red-200">
                          {conflict.course2.courseCode}
                        </div>
                        <div className="text-red-700 dark:text-red-300 text-sm truncate">
                          {conflict.course2.courseName}
                        </div>
                        <div className="text-red-600 dark:text-red-300 text-xs mt-1 bg-red-100 dark:bg-red-900/50 inline-block px-2 py-0.5 rounded-full">
                          {conflict.conflictReason}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Uyarı mesajı */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Dikkat!</p>
                  <p>
                    Bu dersi eklerseniz programınızda saat çakışması oluşacak. 
                    Çakışan derslerden birini daha sonra çıkarmanız gerekebilir.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Buttons */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-950 rounded-b-2xl flex gap-3 justify-end border-t border-slate-200 dark:border-zinc-900">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              İptal
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-5 py-2.5 text-white bg-amber-600 hover:bg-amber-500 active:scale-[0.98] rounded-xl font-medium transition-all flex items-center gap-2 shadow-sm shadow-amber-600/25"
            >
              <Check className="h-4 w-4" />
              Yine de Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
