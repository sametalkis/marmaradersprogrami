import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import type { ExcelData } from '../types/Course';

interface ExcelUploaderProps {
  onDataLoaded: (data: ExcelData) => void;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onDataLoaded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    // Excel dosyası kontrolü
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx',
      '.xls'
    ];

    const isExcelFile = allowedTypes.some(type => 
      file.type === type || file.name.toLowerCase().endsWith(type)
    );

    if (!isExcelFile) {
      setError('Lütfen geçerli bir Excel dosyası (.xlsx veya .xls) seçin.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await parseExcelFile(file);
      onDataLoaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosya işlenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative group border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-200
          ${isDragOver
            ? 'border-accent-500 bg-accent-500/10 shadow-xl shadow-accent-500/10'
            : 'border-slate-300 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-xl hover:border-slate-400 dark:hover:border-slate-700 shadow-xl shadow-slate-900/5 dark:shadow-2xl dark:shadow-black/40'}
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <div className="p-4 bg-accent-500/10 border border-accent-500/20 rounded-2xl">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent-500/30 border-t-accent-400" />
            </div>
          ) : (
            <div className="p-4 bg-accent-500/10 border border-accent-500/20 rounded-2xl text-accent-400 group-hover:scale-110 group-hover:border-accent-500/40 transition-all">
              <FileSpreadsheet className="h-10 w-10" />
            </div>
          )}
          
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">
              {isLoading ? 'Dosya İşleniyor...' : 'Excel Dosyasını Sürükleyin'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Sunulan dersler listesini içeren .xlsx veya .xls uzantılı dosyayı buraya bırakın veya cihazınızdan seçin
            </p>
            
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="excel-upload"
              disabled={isLoading}
            />
            <label
              htmlFor="excel-upload"
              className="inline-flex items-center px-5 py-2.5 bg-accent-600 hover:bg-accent-500 active:scale-[0.98] text-white font-medium rounded-xl shadow-md shadow-accent-600/30 cursor-pointer transition-all gap-2"
            >
              <Upload className="h-4 w-4" />
              Dosya Seç
            </label>
          </div>
          
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Desteklenen formatlar: .xlsx, .xls
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
