import React, { useState } from 'react';
import { MemoryEntry } from '../types';

interface GalleryProps {
  memories: MemoryEntry[];
  onClose: () => void;
}

export function Gallery({ memories, onClose }: GalleryProps) {
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(null);

  // Filter memories with photos
  const memoriesWithPhotos = memories.filter((m) => m.photoUrl);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2">
      <div className="bg-gradient-to-b from-pink-50 to-purple-50 rounded-2xl w-full max-w-lg shadow-2xl border-4 border-pink-200 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 border-b border-pink-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-pink-600">Memory Gallery</h2>
            <button
              onClick={onClose}
              className="text-2xl text-gray-500 hover:text-gray-700"
            >
              x
            </button>
          </div>
          <p className="text-sm text-purple-500">
            {memoriesWithPhotos.length} photos | {memories.length} total memories
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {memoriesWithPhotos.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl mb-4 block">📷</span>
              <p className="text-gray-500">No photos yet!</p>
              <p className="text-sm text-gray-400 mt-2">
                Add photos to your memories to see them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {memoriesWithPhotos.map((memory) => (
                <button
                  key={memory.id}
                  onClick={() => setSelectedMemory(memory)}
                  className="aspect-square rounded-lg overflow-hidden border-2 border-pink-200 hover:border-pink-400 transition-colors"
                >
                  <img
                    src={memory.photoUrl}
                    alt={memory.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* All Memories List */}
        <div className="border-t border-pink-200 p-4 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-bold text-purple-600 mb-2">All Memories</h3>
          <div className="space-y-2">
            {memories.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">
                No memories yet. Start adding some!
              </p>
            ) : (
              memories
                .slice()
                .reverse()
                .map((memory) => (
                  <button
                    key={memory.id}
                    onClick={() => setSelectedMemory(memory)}
                    className="w-full text-left p-2 rounded-lg bg-white hover:bg-pink-50 transition-colors flex items-center gap-3"
                  >
                    {memory.photoUrl ? (
                      <img
                        src={memory.photoUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-400">#{memory.memoryNumber}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{memory.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(memory.timestamp)}</p>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Photo */}
            {selectedMemory.photoUrl && (
              <div className="relative">
                <img
                  src={selectedMemory.photoUrl}
                  alt={selectedMemory.title}
                  className="w-full max-h-64 object-contain bg-black"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm bg-pink-100 text-pink-600 px-2 py-1 rounded-full">
                  Memory #{selectedMemory.memoryNumber}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDate(selectedMemory.timestamp)}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {selectedMemory.title}
              </h3>

              {selectedMemory.content && (
                <p className="text-gray-600 whitespace-pre-wrap">
                  {selectedMemory.content}
                </p>
              )}
            </div>

            {/* Close Button */}
            <div className="p-4 border-t">
              <button
                onClick={() => setSelectedMemory(null)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
