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
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isLoading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center space-y-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          ) : (
            <FileSpreadsheet className="h-12 w-12 text-gray-400" />
          )}
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isLoading ? 'Dosya işleniyor...' : 'Excel Dosyasını Yükleyin'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Sunulan dersler listesini içeren Excel dosyasını sürükleyin veya seçin
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
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Dosya Seç
            </label>
          </div>
          
          <p className="text-xs text-gray-500">
            Desteklenen formatlar: .xlsx, .xls
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
