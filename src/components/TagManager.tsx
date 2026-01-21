import { useState } from 'react';
import { Plus, X, Tag, Palette, Smile } from 'lucide-react';
import type { CustomTag } from '../types/Course';
import { TAG_COLOR_PALETTE, TAG_EMOJI_PALETTE } from '../types/Course';

interface TagManagerProps {
  customTags: CustomTag[];
  onAddTag: (tag: CustomTag) => void;
  onDeleteTag: (tagId: string) => void;
  onUpdateTag: (tag: CustomTag) => void;
}

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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const resetForm = () => {
    setNewTagName('');
    setSelectedColor(TAG_COLOR_PALETTE[0].id);
    setSelectedEmoji(TAG_EMOJI_PALETTE[0]);
    setIsAdding(false);
    setEditingId(null);
    setShowColorPicker(false);
    setShowEmojiPicker(false);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    const newTag: CustomTag = {
      id: `custom_${Date.now()}`,
      name: newTagName.trim(),
      emoji: selectedEmoji,
      color: selectedColor
    };

    onAddTag(newTag);
    resetForm();
  };

  const handleUpdateTag = () => {
    if (!newTagName.trim() || !editingId) return;

    const updatedTag: CustomTag = {
      id: editingId,
      name: newTagName.trim(),
      emoji: selectedEmoji,
      color: selectedColor
    };

    onUpdateTag(updatedTag);
    resetForm();
  };

  const startEdit = (tag: CustomTag) => {
    setEditingId(tag.id);
    setNewTagName(tag.name);
    setSelectedColor(tag.color);
    setSelectedEmoji(tag.emoji);
    setIsAdding(true);
  };

  const getColorStyle = (colorId: string) => {
    return TAG_COLOR_PALETTE.find(c => c.id === colorId) || TAG_COLOR_PALETTE[0];
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Özel Etiketler</h3>
          <span className="text-xs text-slate-500">({customTags.length})</span>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Yeni Etiket
          </button>
        )}
      </div>

      {/* Mevcut Etiketler */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {customTags.map(tag => {
            const colorStyle = getColorStyle(tag.color);
            return (
              <div
                key={tag.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all ${colorStyle.light} ${colorStyle.text} border ${colorStyle.border} hover:shadow-sm`}
                onClick={() => startEdit(tag)}
                title="Düzenlemek için tıkla"
              >
                <span>{tag.emoji}</span>
                <span>{tag.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTag(tag.id);
                  }}
                  className="ml-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/50 transition-all"
                  title="Sil"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Etiket Ekleme/Düzenleme Formu */}
      {isAdding && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <div className="space-y-3">
            {/* İsim girişi */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Etiket Adı
              </label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Örn: Kolay Ders, Zor Hoca..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>

            {/* Emoji ve Renk seçimi */}
            <div className="flex gap-4">
              {/* Emoji seçici */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Emoji
                </label>
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowColorPicker(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-white transition-colors"
                >
                  <span className="text-lg">{selectedEmoji}</span>
                  <Smile className="h-4 w-4 text-slate-400" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-64">
                    <div className="grid grid-cols-10 gap-1">
                      {TAG_EMOJI_PALETTE.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setSelectedEmoji(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className={`p-1.5 text-lg rounded hover:bg-slate-100 transition-colors ${
                            selectedEmoji === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Renk seçici */}
              <div className="relative flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Renk
                </label>
                <button
                  onClick={() => {
                    setShowColorPicker(!showColorPicker);
                    setShowEmojiPicker(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-white transition-colors w-full"
                >
                  <div className={`w-5 h-5 rounded-full ${getColorStyle(selectedColor).bg}`} />
                  <span className="text-sm text-slate-600 capitalize">{selectedColor}</span>
                  <Palette className="h-4 w-4 text-slate-400 ml-auto" />
                </button>

                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-full">
                    <div className="grid grid-cols-6 gap-1">
                      {TAG_COLOR_PALETTE.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => {
                            setSelectedColor(color.id);
                            setShowColorPicker(false);
                          }}
                          className={`p-1 rounded transition-all ${
                            selectedColor === color.id ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                          }`}
                          title={color.id}
                        >
                          <div className={`w-6 h-6 rounded-full ${color.bg}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Önizleme */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Önizleme
              </label>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getColorStyle(selectedColor).light} ${getColorStyle(selectedColor).text} border ${getColorStyle(selectedColor).border}`}>
                  <span>{selectedEmoji}</span>
                  <span>{newTagName || 'Etiket Adı'}</span>
                </div>
              </div>
            </div>

            {/* Butonlar */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={editingId ? handleUpdateTag : handleAddTag}
                disabled={!newTagName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boş durum */}
      {customTags.length === 0 && !isAdding && (
        <div className="text-center py-6 text-slate-500">
          <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Henüz özel etiket yok</p>
          <p className="text-xs mt-1">Derslerinizi organize etmek için etiket ekleyin</p>
        </div>
      )}
    </div>
  );
};
