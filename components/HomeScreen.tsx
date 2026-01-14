import React, { useState } from 'react';
import { saveState, SaveSlotInfo } from '../services/saveState';
import homescreenBackground from '../assets/homescreen.png';

interface HomeScreenProps {
  onNewGame: (slotId: number) => void;
  onLoadGame: (slotId: number) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNewGame,
  onLoadGame,
}) => {
  const [view, setView] = useState<'main' | 'new' | 'load'>('main');
  const [slots, setSlots] = useState<SaveSlotInfo[]>(() => saveState.getAllSlots());

  const refreshSlots = () => {
    setSlots(saveState.getAllSlots());
  };

  const handleDeleteSlot = (slotId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this save?')) {
      saveState.deleteSlot(slotId);
      refreshSlots();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasAnySave = slots.some(s => !s.isEmpty);

  return (
    <div
      className="relative w-full h-screen flex flex-col items-center justify-center"
      style={{
        backgroundImage: `url(${homescreenBackground})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#fdf2f8',
      }}
    >
      {/* Title */}
      <div className="mb-12">
        <h1 className="text-6xl font-brand text-pink-500 drop-shadow-sm" style={{ fontFamily: "'Fredoka One', cursive" }}>
          bbgotchi
        </h1>
        <p className="text-center text-pink-300 font-bold text-sm uppercase tracking-widest mt-2">
          Our Little World
        </p>
      </div>

      {/* Main Menu */}
      {view === 'main' && (
        <div className="flex gap-4">
          <button
            onClick={() => setView('new')}
            className="px-8 py-3 bg-[#ffecd2] hover:bg-[#ffd9b3] active:scale-95 text-[#8b6914] font-bold rounded-full shadow-lg border-2 border-[#e8c896] transition-all flex items-center gap-2"
          >
            <span>⭐</span>
            <span>NEW GAME</span>
          </button>

          <button
            onClick={() => { refreshSlots(); setView('load'); }}
            disabled={!hasAnySave}
            className={`px-8 py-3 rounded-full shadow-lg border-2 transition-all flex items-center gap-2 font-bold ${
              hasAnySave
                ? 'bg-[#d4f0ff] hover:bg-[#b3e4ff] active:scale-95 text-[#1a6b8a] border-[#96d4e8] cursor-pointer'
                : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-60'
            }`}
          >
            <span>📂</span>
            <span>LOAD GAME</span>
          </button>
        </div>
      )}

      {/* Slot Selection for New Game */}
      {view === 'new' && (
        <div className="w-full max-w-md px-4">
          <h2 className="text-center text-lg font-bold text-gray-700 mb-4">Select a Save Slot</h2>
          <div className="space-y-3">
            {slots.map((slot) => (
              <button
                key={slot.slotId}
                onClick={() => onNewGame(slot.slotId)}
                className="w-full p-4 bg-white rounded-2xl shadow-md border-2 border-pink-100 hover:border-pink-300 hover:bg-pink-50 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{slot.isEmpty ? '📁' : '💾'}</span>
                    <div>
                      <p className="font-bold text-gray-800">Slot {slot.slotId}</p>
                      {slot.isEmpty ? (
                        <p className="text-sm text-gray-400">Empty</p>
                      ) : (
                        <p className="text-sm text-orange-500">Will overwrite existing save</p>
                      )}
                    </div>
                  </div>
                  {!slot.isEmpty && (
                    <div className="text-right text-xs text-gray-400">
                      <p>{slot.petName} • Lv.{slot.petLevel}</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setView('main')}
            className="w-full mt-4 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Slot Selection for Load Game */}
      {view === 'load' && (
        <div className="w-full max-w-md px-4">
          <h2 className="text-center text-lg font-bold text-gray-700 mb-4">Choose a Save File</h2>
          <div className="space-y-3">
            {slots.map((slot) => (
              <div
                key={slot.slotId}
                className={`relative w-full p-4 bg-white rounded-2xl shadow-md border-2 transition-all ${
                  slot.isEmpty
                    ? 'border-gray-100 opacity-50'
                    : 'border-blue-100 hover:border-blue-300 hover:bg-blue-50 cursor-pointer active:scale-[0.98]'
                }`}
                onClick={() => !slot.isEmpty && onLoadGame(slot.slotId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{slot.isEmpty ? '📁' : '💾'}</span>
                    <div>
                      <p className="font-bold text-gray-800">Slot {slot.slotId}</p>
                      {slot.isEmpty ? (
                        <p className="text-sm text-gray-400">Empty</p>
                      ) : (
                        <p className="text-sm text-gray-500">{formatDate(slot.timestamp!)}</p>
                      )}
                    </div>
                  </div>
                  {!slot.isEmpty && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-gray-700">{slot.petName}</p>
                        <p className="text-xs text-blue-500">Level {slot.petLevel}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSlot(slot.slotId, e)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete save"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setView('main')}
            className="w-full mt-4 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
};
