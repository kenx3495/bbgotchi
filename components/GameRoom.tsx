import React, { useState } from 'react';
import { PetState, PetType } from '../types';
import { PET_EMOJIS, GAME_ROOM_CONFIG, PET_AI_DIFFICULTY } from '../constants';
import { PongGame } from './games/PongGame';
import { Match3Game } from './games/Match3Game';

interface GameRoomProps {
  pets: PetState[];
  credits: number;
  onClose: () => void;
  onCreditChange: (amount: number) => void;
  onBondIncrease: (petId: string, amount: number) => void;
  onGameWin?: (petId: string, gameName: string, reward: number) => void;
}

type GameRoomView = 'select' | 'room' | 'pong' | 'match3';

export const GameRoom: React.FC<GameRoomProps> = ({
  pets,
  credits,
  onClose,
  onCreditChange,
  onBondIncrease,
  onGameWin,
}) => {
  const [view, setView] = useState<GameRoomView>('select');
  const [selectedPet, setSelectedPet] = useState<PetState | null>(null);

  const handleSelectPet = (pet: PetState) => {
    setSelectedPet(pet);
    setView('room');
  };

  const handleStartPong = () => {
    if (credits < GAME_ROOM_CONFIG.pong.entryCost) {
      alert('Not enough credits!');
      return;
    }
    onCreditChange(-GAME_ROOM_CONFIG.pong.entryCost);
    setView('pong');
  };

  const handleStartMatch3 = () => {
    if (credits < GAME_ROOM_CONFIG.match3.entryCost) {
      alert('Not enough credits!');
      return;
    }
    onCreditChange(-GAME_ROOM_CONFIG.match3.entryCost);
    setView('match3');
  };

  const handlePongEnd = (won: boolean) => {
    if (won && selectedPet) {
      onCreditChange(GAME_ROOM_CONFIG.pong.winReward);
      onBondIncrease(selectedPet.id, GAME_ROOM_CONFIG.pong.bondGain);
      onGameWin?.(selectedPet.id, 'Pong', GAME_ROOM_CONFIG.pong.winReward);
    }
  };

  const handleMatch3End = (score: number) => {
    if (!selectedPet) return;

    const config = GAME_ROOM_CONFIG.match3;
    let reward = 0;
    let tier = '';

    if (score >= config.scoreThresholds.gold) {
      reward = config.rewards.gold;
      tier = 'Gold';
    } else if (score >= config.scoreThresholds.silver) {
      reward = config.rewards.silver;
      tier = 'Silver';
    } else if (score >= config.scoreThresholds.bronze) {
      reward = config.rewards.bronze;
      tier = 'Bronze';
    }

    if (reward > 0) {
      onCreditChange(reward);
      onBondIncrease(selectedPet.id, config.bondGain);
      onGameWin?.(selectedPet.id, `Gem Match (${tier})`, reward);
    }
  };

  const getDifficultyLabel = (petType: PetType) => {
    const diff = PET_AI_DIFFICULTY[petType] || PET_AI_DIFFICULTY.Custom;
    const avg = (diff.pongSpeed + diff.pongAccuracy) / 2;
    if (avg >= 0.9) return { label: 'Hard', color: 'text-red-500' };
    if (avg >= 0.7) return { label: 'Medium', color: 'text-yellow-500' };
    return { label: 'Easy', color: 'text-green-500' };
  };

  // Pet Selection View
  if (view === 'select') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Choose a Kid to Play With</h2>
          <p className="text-sm text-gray-500">Each kid has different skill levels!</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {pets.map(pet => {
            const difficulty = getDifficultyLabel(pet.type);
            return (
              <button
                key={pet.id}
                onClick={() => handleSelectPet(pet)}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-pink-100 flex items-center justify-center text-3xl mb-2">
                  {PET_EMOJIS[pet.type] || '👶'}
                </div>
                <p className="font-bold text-gray-800">{pet.name}</p>
                <p className="text-xs text-gray-400">Level {pet.level}</p>
                <p className={`text-xs font-bold ${difficulty.color}`}>{difficulty.label}</p>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-pink-400">💕</span>
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-400 rounded-full transition-all"
                      style={{ width: `${pet.bond}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{pet.bond}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
        >
          ← Back to Games
        </button>
      </div>
    );
  }

  // Room View (Game Selection)
  if (view === 'room' && selectedPet) {
    return (
      <div className="space-y-4">
        {/* Room Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                {PET_EMOJIS[selectedPet.type] || '👶'}
              </div>
              <div>
                <p className="font-bold">{selectedPet.name}'s Game Room</p>
                <p className="text-xs text-white/70">Playing together!</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">Bond</p>
              <p className="font-bold">💕 {selectedPet.bond}</p>
            </div>
          </div>
        </div>

        {/* Credits Display */}
        <div className="flex justify-center">
          <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-2">
            <span className="text-xl">💎</span>
            <span className="font-bold text-gray-700">{credits}</span>
          </div>
        </div>

        {/* Game Selection */}
        <div className="space-y-3">
          <p className="text-center font-bold text-gray-600 text-sm">Choose a Game</p>

          {/* Pong */}
          <button
            onClick={handleStartPong}
            disabled={credits < GAME_ROOM_CONFIG.pong.entryCost}
            className={`w-full p-4 rounded-2xl border-2 transition-all ${
              credits >= GAME_ROOM_CONFIG.pong.entryCost
                ? 'bg-pink-50 border-pink-200 hover:border-pink-400 hover:bg-pink-100 active:scale-[0.98]'
                : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-200 rounded-xl flex items-center justify-center text-2xl">
                🏓
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-gray-800">Pong Battle</h3>
                <p className="text-xs text-gray-500">
                  First to {GAME_ROOM_CONFIG.pong.pointsToWin} wins! vs {selectedPet.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Entry</p>
                <p className="font-bold text-pink-600">{GAME_ROOM_CONFIG.pong.entryCost} 💎</p>
                <p className="text-xs text-green-500">Win: +{GAME_ROOM_CONFIG.pong.winReward} 💎</p>
              </div>
            </div>
          </button>

          {/* Match-3 */}
          <button
            onClick={handleStartMatch3}
            disabled={credits < GAME_ROOM_CONFIG.match3.entryCost}
            className={`w-full p-4 rounded-2xl border-2 transition-all ${
              credits >= GAME_ROOM_CONFIG.match3.entryCost
                ? 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100 active:scale-[0.98]'
                : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-200 rounded-xl flex items-center justify-center text-2xl">
                💎
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-gray-800">Gem Match</h3>
                <p className="text-xs text-gray-500">
                  {GAME_ROOM_CONFIG.match3.timeLimit}s to match gems!
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Entry</p>
                <p className="font-bold text-purple-600">{GAME_ROOM_CONFIG.match3.entryCost} 💎</p>
                <p className="text-xs text-green-500">
                  Win: {GAME_ROOM_CONFIG.match3.rewards.bronze}-{GAME_ROOM_CONFIG.match3.rewards.gold} 💎
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Bond Info */}
        <div className="bg-pink-50 p-3 rounded-xl border border-pink-100 text-center">
          <p className="text-xs text-pink-600">
            💕 Playing games increases your bond with {selectedPet.name}!
          </p>
        </div>

        <button
          onClick={() => setView('select')}
          className="w-full py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
        >
          ← Choose Different Kid
        </button>
      </div>
    );
  }

  // Pong Game View
  if (view === 'pong' && selectedPet) {
    return (
      <PongGame
        petType={selectedPet.type}
        petName={selectedPet.name}
        onGameEnd={handlePongEnd}
        onBack={() => setView('room')}
      />
    );
  }

  // Match-3 Game View
  if (view === 'match3' && selectedPet) {
    return (
      <Match3Game
        petName={selectedPet.name}
        onGameEnd={handleMatch3End}
        onBack={() => setView('room')}
      />
    );
  }

  return null;
};
