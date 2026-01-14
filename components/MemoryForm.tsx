import React, { useState, useRef } from 'react';
import { MemoryEntry } from '../types';

interface MemoryFormProps {
  onSave: (memory: Omit<MemoryEntry, 'id' | 'memoryNumber'>) => void;
  onClose: () => void;
  memoryCount: number;
}

export function MemoryForm({ onSave, onClose, memoryCount }: MemoryFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB for base64 storage)
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Compress image if needed
      compressImage(result, 800, 0.8).then((compressed) => {
        setPhotoUrl(compressed);
        setIsUploading(false);
      });
    };
    reader.onerror = () => {
      alert('Failed to read photo');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Simple image compression using canvas
  const compressImage = (base64: string, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('Please add a title for your memory');
      return;
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      photoUrl,
      timestamp: Date.now(),
    });
  };

  const removePhoto = () => {
    setPhotoUrl(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-pink-50 to-purple-50 rounded-2xl p-6 w-full max-w-md shadow-2xl border-4 border-pink-200">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-pink-600">New Memory</h2>
          <p className="text-sm text-purple-500">Memory #{memoryCount + 1}</p>
        </div>

        {/* Photo Upload */}
        <div className="mb-4">
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            ref={fileInputRef}
            className="hidden"
            id="photo-upload"
          />

          {photoUrl ? (
            <div className="relative">
              <img
                src={photoUrl}
                alt="Memory photo"
                className="w-full h-48 object-cover rounded-xl border-2 border-pink-300"
              />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
              >
                X
              </button>
            </div>
          ) : (
            <label
              htmlFor="photo-upload"
              className={`block w-full h-32 border-2 border-dashed border-pink-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors ${isUploading ? 'opacity-50' : ''}`}
            >
              {isUploading ? (
                <span className="text-pink-400">Processing...</span>
              ) : (
                <>
                  <span className="text-3xl mb-1">📷</span>
                  <span className="text-pink-500 text-sm">Add a photo (optional)</span>
                </>
              )}
            </label>
          )}
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give this memory a title..."
          className="w-full p-3 rounded-xl border-2 border-pink-200 focus:border-pink-400 outline-none mb-3 text-gray-700"
          maxLength={100}
        />

        {/* Content Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What happened? How did it make you feel? (optional)"
          className="w-full p-3 rounded-xl border-2 border-pink-200 focus:border-pink-400 outline-none mb-4 text-gray-700 resize-none"
          rows={4}
          maxLength={1000}
        />

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-600 font-bold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Memory
          </button>
        </div>

        {/* Hint about unlock */}
        <p className="text-center text-xs text-stone-400 mt-3">
          Each memory unlocks a new garden item!
        </p>
      </div>
    </div>
  );
}
