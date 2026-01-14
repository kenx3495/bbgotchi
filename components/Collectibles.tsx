import React, { useState } from 'react';
import { ClaimedGift, PetState } from '../types';
import { BOND_GIFTS, getBondLevel, PET_EMOJIS, BondGift } from '../constants';

interface CollectiblesProps {
  claimedGifts: ClaimedGift[];
  pets: PetState[];
  onClose: () => void;
}

export const Collectibles: React.FC<CollectiblesProps> = ({
  claimedGifts,
  pets,
  onClose,
}) => {
  const [selectedPetId, setSelectedPetId] = useState<string>(pets[0]?.id || '');
  const [viewingGift, setViewingGift] = useState<{ gift: BondGift; pet: PetState; claimed: ClaimedGift } | null>(null);

  const selectedPet = pets.find(p => p.id === selectedPetId);

  const getGiftStatus = (gift: BondGift, petId: string) => {
    const claimed = claimedGifts.find(cg => cg.giftId === gift.id && cg.petId === petId);
    const pet = pets.find(p => p.id === petId);
    const bondLevel = pet ? getBondLevel(pet.bond).level : 0;
    const isUnlockable = bondLevel >= gift.bondLevel;

    return { claimed, isUnlockable };
  };

  const handleGiftClick = (gift: BondGift, pet: PetState) => {
    const { claimed } = getGiftStatus(gift, pet.id);
    if (claimed) {
      setViewingGift({ gift, pet, claimed });
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-100 via-pink-50 to-orange-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-pink-100 p-4 safe-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700"
          >
            <span className="text-2xl">←</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Collectibles</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Pet Selector */}
      <div className="bg-white/60 border-b border-pink-100 p-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide max-w-lg mx-auto">
          {pets.map(pet => {
            const claimedCount = claimedGifts.filter(cg => cg.petId === pet.id).length;
            return (
              <button
                key={pet.id}
                onClick={() => setSelectedPetId(pet.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  selectedPetId === pet.id
                    ? 'bg-pink-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-pink-300'
                }`}
              >
                <span className="text-lg">{PET_EMOJIS[pet.type] || '👶'}</span>
                <span className="font-bold text-sm">{pet.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  selectedPetId === pet.id ? 'bg-white/20' : 'bg-pink-100 text-pink-600'
                }`}>
                  {claimedCount}/{BOND_GIFTS.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gift Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto">
          {selectedPet && (
            <>
              {/* Current Bond Level */}
              <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-pink-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-2xl">
                    {getBondLevel(selectedPet.bond).emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{selectedPet.name}'s Bond</p>
                    <p className="text-sm text-pink-600">{getBondLevel(selectedPet.bond).name} (Lv.{getBondLevel(selectedPet.bond).level})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-pink-500">{selectedPet.bond}</p>
                    <p className="text-[10px] text-gray-400">/ 100</p>
                  </div>
                </div>
              </div>

              {/* Gifts Grid */}
              <div className="grid grid-cols-3 gap-3">
                {BOND_GIFTS.map(gift => {
                  const { claimed, isUnlockable } = getGiftStatus(gift, selectedPet.id);
                  const isLocked = !claimed;

                  return (
                    <button
                      key={gift.id}
                      onClick={() => handleGiftClick(gift, selectedPet)}
                      disabled={isLocked}
                      className={`aspect-square rounded-2xl overflow-hidden relative transition-all ${
                        claimed
                          ? 'bg-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
                          : isUnlockable
                          ? 'bg-pink-100 border-2 border-dashed border-pink-300'
                          : 'bg-gray-100 border-2 border-dashed border-gray-200'
                      }`}
                    >
                      {claimed ? (
                        <>
                          <img
                            src={`/assets/gifts/${selectedPet.id}/${gift.assets[selectedPet.id] || gift.defaultAsset}`}
                            alt={gift.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-pink-50 to-purple-50">
                            {gift.bondLevel <= 3 ? '🎨' :
                             gift.bondLevel <= 5 ? '🌸' :
                             gift.bondLevel <= 7 ? '💝' :
                             gift.bondLevel <= 9 ? '💌' : '👑'}
                          </div>
                          {/* Level badge */}
                          <div className="absolute top-1 right-1 w-5 h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {gift.bondLevel}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <span className={`text-3xl ${isUnlockable ? 'opacity-50' : 'opacity-20'}`}>
                            🔒
                          </span>
                          <span className={`text-[10px] mt-1 font-bold ${
                            isUnlockable ? 'text-pink-400' : 'text-gray-300'
                          }`}>
                            Lv.{gift.bondLevel}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-white rounded border border-gray-200" />
                  <span>Collected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-pink-100 rounded border border-dashed border-pink-300" />
                  <span>Ready!</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-100 rounded border border-dashed border-gray-200" />
                  <span>Locked</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gift Detail Modal */}
      {viewingGift && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingGift(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-sm w-full shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Art Display */}
            <div className="relative bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4">
              <div className="aspect-square max-h-72 mx-auto rounded-2xl overflow-hidden bg-white shadow-lg border-4 border-white">
                <img
                  src={`/assets/gifts/${viewingGift.pet.id}/${viewingGift.gift.assets[viewingGift.pet.id] || viewingGift.gift.defaultAsset}`}
                  alt={viewingGift.gift.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-pink-50 to-purple-50">${
                      viewingGift.gift.bondLevel <= 3 ? '🎨' :
                      viewingGift.gift.bondLevel <= 5 ? '🌸' :
                      viewingGift.gift.bondLevel <= 7 ? '💝' :
                      viewingGift.gift.bondLevel <= 9 ? '💌' : '👑'
                    }</div>`;
                  }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="text-center mb-4">
                <p className="text-xs text-pink-500 font-bold uppercase tracking-wide">
                  Bond Level {viewingGift.gift.bondLevel} Gift
                </p>
                <h2 className="text-xl font-bold text-gray-800 mt-1">{viewingGift.gift.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Received {new Date(viewingGift.claimed.claimedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Message */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-100">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">{PET_EMOJIS[viewingGift.pet.type] || '👶'}</span>
                  <span className="font-bold text-blue-700">{viewingGift.pet.name}:</span>
                </div>
                <p className="text-sm text-blue-600 italic text-center leading-relaxed">
                  "{viewingGift.gift.messages[viewingGift.pet.id] || viewingGift.gift.defaultMessage}"
                </p>
              </div>

              <button
                onClick={() => setViewingGift(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
