import { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag, Check, Sparkles } from 'lucide-react';
import type { CustomTag } from '../types/Course';
import { TAG_COLOR_PALETTE, TAG_EMOJI_PALETTE } from '../types/Course';

interface TagManagerProps {
  customTags: CustomTag[];
  onAddTag: (tag: CustomTag) => void;
  onDeleteTag: (tagId: string) => void;
  onUpdateTag: (tag: CustomTag) => void;
}

// Koyu modda pastel beyazı yerine şık, mat ve canlı OLED uyumlu renk tonları
const DARK_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'dark:bg-red-950/50', text: 'dark:text-red-300', border: 'dark:border-red-800/60' },
  orange: { bg: 'dark:bg-orange-950/50', text: 'dark:text-orange-300', border: 'dark:border-orange-800/60' },
  amber: { bg: 'dark:bg-amber-950/50', text: 'dark:text-amber-300', border: 'dark:border-amber-800/60' },
  yellow: { bg: 'dark:bg-yellow-950/50', text: 'dark:text-yellow-300', border: 'dark:border-yellow-800/60' },
  lime: { bg: 'dark:bg-lime-950/50', text: 'dark:text-lime-300', border: 'dark:border-lime-800/60' },
  green: { bg: 'dark:bg-green-950/50', text: 'dark:text-green-300', border: 'dark:border-green-800/60' },
  emerald: { bg: 'dark:bg-emerald-950/50', text: 'dark:text-emerald-300', border: 'dark:border-emerald-800/60' },
  teal: { bg: 'dark:bg-teal-950/50', text: 'dark:text-teal-300', border: 'dark:border-teal-800/60' },
  cyan: { bg: 'dark:bg-cyan-950/50', text: 'dark:text-cyan-300', border: 'dark:border-cyan-800/60' },
  sky: { bg: 'dark:bg-sky-950/50', text: 'dark:text-sky-300', border: 'dark:border-sky-800/60' },
  blue: { bg: 'dark:bg-blue-950/50', text: 'dark:text-blue-300', border: 'dark:border-blue-800/60' },
  indigo: { bg: 'dark:bg-indigo-950/50', text: 'dark:text-indigo-300', border: 'dark:border-indigo-800/60' },
  violet: { bg: 'dark:bg-violet-950/50', text: 'dark:text-violet-300', border: 'dark:border-violet-800/60' },
  purple: { bg: 'dark:bg-purple-950/50', text: 'dark:text-purple-300', border: 'dark:border-purple-800/60' },
  fuchsia: { bg: 'dark:bg-fuchsia-950/50', text: 'dark:text-fuchsia-300', border: 'dark:border-fuchsia-800/60' },
  pink: { bg: 'dark:bg-pink-950/50', text: 'dark:text-pink-300', border: 'dark:border-pink-800/60' },
  rose: { bg: 'dark:bg-rose-950/50', text: 'dark:text-rose-300', border: 'dark:border-rose-800/60' },
  slate: { bg: 'dark:bg-zinc-800/60', text: 'dark:text-zinc-300', border: 'dark:border-zinc-700/60' },
};

export const TagManager = ({
  customTags,
  onAddTag,
  onDeleteTag,
  onUpdateTag
}: TagManagerProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(TAG_COLOR_PALETTE[0].id);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(TAG_EMOJI_PALETTE[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const resetForm = () => {
    setNewTagName('');
    setSelectedColor(TAG_COLOR_PALETTE[0].id);
    setSelectedEmoji(TAG_EMOJI_PALETTE[0]);
    setIsAdding(false);
    setEditingId(null);
    setShowEmojiPicker(false);
  };

  const handleSave = () => {
    if (!newTagName.trim()) return;

    if (editingId) {
      onUpdateTag({
        id: editingId,
        name: newTagName.trim(),
        emoji: selectedEmoji,
        color: selectedColor
      });
    } else {
      onAddTag({
        id: `custom_${Date.now()}`,
        name: newTagName.trim(),
        emoji: selectedEmoji,
        color: selectedColor
      });
    }
    resetForm();
  };

  const startEdit = (tag: CustomTag) => {
    setEditingId(tag.id);
    setNewTagName(tag.name);
    setSelectedColor(tag.color);
    setSelectedEmoji(tag.emoji);
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const getColorStyle = (colorId: string) => {
    const base = TAG_COLOR_PALETTE.find(c => c.id === colorId) || TAG_COLOR_PALETTE[0];
    const dark = DARK_COLOR_MAP[colorId] || DARK_COLOR_MAP.slate;
    return { ...base, dark };
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 transition-all shadow-sm">
      {/* Başlık Satırı */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Tag className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Özel Etiketler</h3>
          <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-full">
            {customTags.length}
          </span>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              setIsAdding(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-all active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Yeni Etiket
          </button>
        )}
      </div>

      {/* Mevcut Etiketler */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {customTags.map(tag => {
            const colorStyle = getColorStyle(tag.color);
            return (
              <div
                key={tag.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-sm hover:shadow hover:scale-[1.02] ${colorStyle.light} ${colorStyle.text} ${colorStyle.border} ${colorStyle.dark.bg} ${colorStyle.dark.text} ${colorStyle.dark.border}`}
                onClick={() => startEdit(tag)}
                title="Düzenlemek için tıkla"
              >
                <span className="text-sm select-none">{tag.emoji}</span>
                <span className="truncate max-w-[120px]">{tag.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTag(tag.id);
                  }}
                  className="ml-1 p-0.5 rounded-md opacity-60 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/15 transition-all"
                  title="Sil"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Etiket Oluşturucu / Düzenleyici */}
      {isAdding && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/80 dark:bg-zinc-900/60 shadow-inner space-y-3.5">
          {/* Üst Satır: Emoji Seçici + İsim Inputu */}
          <div className="flex items-center gap-2.5">
            {/* Emoji Seçici Butonu */}
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-xl hover:border-indigo-500 dark:hover:border-indigo-400 hover:scale-105 active:scale-95 transition-all shadow-sm select-none"
                title="Emoji Değiştir"
              >
                {selectedEmoji}
              </button>

              {/* Emoji Popover */}
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-3 w-72 backdrop-blur-xl">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                    Emoji Seçin
                  </div>
                  <div className="grid grid-cols-6 gap-1 max-h-52 overflow-y-auto scrollbar-thin p-1">
                    {TAG_EMOJI_PALETTE.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setSelectedEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                          selectedEmoji === emoji 
                            ? 'bg-indigo-100 dark:bg-indigo-950/80 ring-2 ring-indigo-500 shadow-sm' 
                            : 'hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* İsim Girişi */}
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') resetForm();
                }}
                placeholder="Etiket adı (örn: Kolay Ders, Proje)..."
                className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Renk Paleti - Doğrudan Görünür Renk Düğmeleri */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-2">
              Renk Paleti
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700/80">
              {TAG_COLOR_PALETTE.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColor(color.id)}
                  className={`w-5 h-5 rounded-full ${color.bg} transition-all duration-150 relative ${
                    selectedColor === color.id 
                      ? 'ring-2 ring-indigo-500 dark:ring-white scale-125 shadow-md z-10' 
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  title={color.id}
                >
                  {selectedColor === color.id && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-black">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Canlı Önizleme & Aksiyon Butonları */}
          <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            {/* Canlı Önizleme Rozeti */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">Önizleme:</span>
              {(() => {
                const colorStyle = getColorStyle(selectedColor);
                return (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${colorStyle.light} ${colorStyle.text} ${colorStyle.border} ${colorStyle.dark.bg} ${colorStyle.dark.text} ${colorStyle.dark.border}`}>
                    <span>{selectedEmoji}</span>
                    <span className="truncate max-w-[100px]">{newTagName.trim() || 'Etiket Adı'}</span>
                  </div>
                );
              })()}
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!newTagName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                {editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boş Durum */}
      {customTags.length === 0 && !isAdding && (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-zinc-800/80 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/30">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-2.5 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Henüz özel etiket oluşturulmadı</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Derslerinizi emojiler ve renklerle kolayca filtreleyin</p>
        </div>
      )}
    </div>
  );
};
