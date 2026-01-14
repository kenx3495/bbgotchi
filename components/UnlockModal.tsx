import React, { useEffect, useState } from 'react';
import { TerrariumItem } from '../types';
import { getTerrariumAsset } from '../services/terrariumAssets';

interface UnlockModalProps {
  items: TerrariumItem[];
  onClose: () => void;
  onOpenTerrarium: () => void;
}

export function UnlockModal({ items, onClose, onOpenTerrarium }: UnlockModalProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Simple confetti effect
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const currentItem = items[currentIndex];
  const hasMore = currentIndex < items.length - 1;
  const isBonus = currentItem?.isBonus;

  const handleNext = () => {
    if (hasMore) {
      setCurrentIndex(currentIndex + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      onClose();
    }
  };

  if (!currentItem) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      {/* Confetti animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <span
                className="text-2xl"
                style={{
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              >
                {['*', '+', '.', 'o'][Math.floor(Math.random() * 4)]}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`bg-gradient-to-b ${isBonus ? 'from-yellow-100 to-amber-100 border-yellow-400' : 'from-green-50 to-emerald-50 border-green-300'} rounded-2xl p-6 w-full max-w-sm shadow-2xl border-4 transform animate-pulse`}
        style={{ animationDuration: '2s' }}
      >
        {/* Bonus badge */}
        {isBonus && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
            BONUS UNLOCK!
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-4">
          <h2 className={`text-2xl font-bold ${isBonus ? 'text-amber-600' : 'text-green-600'}`}>
            New Item Unlocked!
          </h2>
          {items.length > 1 && (
            <p className="text-sm text-gray-500 mt-1">
              {currentIndex + 1} of {items.length}
            </p>
          )}
        </div>

        {/* Item Display */}
        <div className="flex flex-col items-center my-6">
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center ${isBonus ? 'bg-gradient-to-br from-yellow-200 to-amber-300' : 'bg-gradient-to-br from-green-200 to-emerald-300'} shadow-inner`}
          >
            <img
              src={getTerrariumAsset(currentItem)}
              alt={currentItem.name}
              className="w-20 h-20 animate-bounce"
              style={{ animationDuration: '1s' }}
            />
          </div>

          <h3 className="text-xl font-bold text-gray-800 mt-4">{currentItem.name}</h3>

          <div className="flex gap-2 mt-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                currentItem.category === 'plant'
                  ? 'bg-green-200 text-green-700'
                  : currentItem.category === 'decoration'
                    ? 'bg-purple-200 text-purple-700'
                    : currentItem.category === 'creature'
                      ? 'bg-amber-200 text-amber-700'
                      : 'bg-pink-200 text-pink-700'
              }`}
            >
              {currentItem.category}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
              {currentItem.layer} layer
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-600 font-bold hover:bg-gray-300 transition-colors"
          >
            {hasMore ? 'Next' : 'Later'}
          </button>
          <button
            onClick={onOpenTerrarium}
            className={`flex-1 py-3 rounded-xl ${isBonus ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'} text-white font-bold hover:opacity-90 transition-opacity`}
          >
            Open Terrarium
          </button>
        </div>
      </div>
    </div>
  );
}
