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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Saat Çakışması Tespit Edildi</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {/* Eklenecek ders */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Eklemek istediğiniz ders:</p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="font-bold text-blue-800 text-lg">{course.courseCode}</div>
                <div className="text-blue-700">{course.courseName}</div>
                <div className="text-blue-600 text-sm mt-1">{course.instructor}</div>
                <div className="text-blue-500 text-xs mt-2 font-mono">{course.dayTimeLocation}</div>
              </div>
            </div>

            {/* Çakışan dersler */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                Bu ders aşağıdaki {conflicts.length > 1 ? 'derslerle' : 'dersle'} çakışıyor:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <div 
                    key={index} 
                    className="bg-red-50 border border-red-200 rounded-xl p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-red-100 rounded-lg flex-shrink-0">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-red-800">
                          {conflict.course2.courseCode}
                        </div>
                        <div className="text-red-700 text-sm truncate">
                          {conflict.course2.courseName}
                        </div>
                        <div className="text-red-600 text-xs mt-1 bg-red-100 inline-block px-2 py-0.5 rounded-full">
                          {conflict.conflictReason}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Uyarı mesajı */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
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
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              İptal
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-5 py-2.5 text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-colors flex items-center gap-2 shadow-lg shadow-orange-500/25"
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
