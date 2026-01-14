import React, { useState } from 'react';
import { TerrariumItem, PlacedItem } from '../types';
import { TERRARIUM_ITEMS } from '../constants';
import { getTerrariumAsset } from '../services/terrariumAssets';
import gardenBackground from '../assets/terrarium/garden-background.png';

interface TerrariumProps {
  unlockedItems: string[];
  placedItems: PlacedItem[];
  onPlaceItem: (placedItems: PlacedItem[]) => void;
  onClose: () => void;
  onAddMemory: () => void;
  totalMemories: number;
}

export function Terrarium({
  unlockedItems,
  placedItems,
  onPlaceItem,
  onClose,
  onAddMemory,
  totalMemories,
}: TerrariumProps) {
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TerrariumItem | null>(null);
  const [inventoryTab, setInventoryTab] = useState<'all' | 'plant' | 'decoration' | 'creature' | 'special'>('all');

  // Get unlocked TerrariumItem objects
  const unlockedItemObjects = TERRARIUM_ITEMS.filter((item) =>
    unlockedItems.includes(item.id)
  );

  // Filter inventory by category
  const filteredInventory =
    inventoryTab === 'all'
      ? unlockedItemObjects
      : unlockedItemObjects.filter((item) => item.category === inventoryTab);

  // Get items already placed (to show which ones are in use)
  const placedItemIds = new Set(placedItems.map((p) => p.itemId));

  // Handle placing an item on the terrarium grid
  const handleTerrariumClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !selectedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Only allow placement in valid area (inside the garden frame)
    if (y < 5 || y > 95 || x < 3 || x > 97) return;

    // Check if this item is already placed
    const existingIndex = placedItems.findIndex((p) => p.itemId === selectedItem.id);

    if (existingIndex >= 0) {
      // Move existing item
      const updated = [...placedItems];
      updated[existingIndex] = { ...updated[existingIndex], x, y };
      onPlaceItem(updated);
    } else {
      // Place new item
      onPlaceItem([
        ...placedItems,
        {
          itemId: selectedItem.id,
          x,
          y,
          layer: selectedItem.layer,
        },
      ]);
    }

    // Keep item selected for easy repositioning - only deselect if it was a new placement
    if (existingIndex < 0) {
      setSelectedItem(null);
    }
  };

  // Handle clicking on a placed item
  const handlePlacedItemClick = (e: React.MouseEvent, item: TerrariumItem) => {
    e.stopPropagation(); // Prevent bubbling to terrarium div
    if (editMode) {
      // Toggle selection
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      } else {
        setSelectedItem(item);
      }
    }
  };

  // Remove a placed item
  const handleRemoveItem = (itemId: string) => {
    onPlaceItem(placedItems.filter((p) => p.itemId !== itemId));
    setSelectedItem(null);
  };

  // Render placed items sorted by layer
  const renderPlacedItems = () => {
    const layers: ('back' | 'middle' | 'front')[] = ['back', 'middle', 'front'];
    return layers.map((layer) => (
      <div key={layer} className="absolute inset-0 pointer-events-none">
        {placedItems
          .filter((p) => p.layer === layer)
          .map((placed) => {
            const item = TERRARIUM_ITEMS.find((i) => i.id === placed.itemId);
            if (!item) return null;

            const isSelected = selectedItem?.id === item.id;

            return (
              <div
                key={placed.itemId}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                  editMode ? 'pointer-events-auto cursor-move' : ''
                } ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}`}
                style={{
                  left: `${placed.x}%`,
                  top: `${placed.y}%`,
                  zIndex: isSelected ? 50 : layer === 'back' ? 1 : layer === 'middle' ? 2 : 3,
                }}
                onClick={(e) => handlePlacedItemClick(e, item)}
                title={editMode ? `Click to select, then click elsewhere to move` : item.name}
              >
                <img
                  src={getTerrariumAsset(item)}
                  alt={item.name}
                  className={`w-10 h-10 sm:w-12 sm:h-12 ${isSelected ? 'animate-pulse drop-shadow-lg' : ''}`}
                  draggable={false}
                />
                {isSelected && editMode && (
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                    Tap to move
                  </div>
                )}
              </div>
            );
          })}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2">
      <div className="bg-gradient-to-b from-stone-100 to-green-50 rounded-2xl w-full max-w-lg shadow-2xl border-4 border-stone-300 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 bg-gradient-to-r from-stone-200 to-stone-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-stone-700">Memory Garden</h2>
            <button
              onClick={onClose}
              className="text-2xl text-gray-500 hover:text-gray-700"
            >
              x
            </button>
          </div>
          <p className="text-sm text-stone-500">
            {totalMemories} memories | {unlockedItems.length} items unlocked
          </p>
        </div>

        {/* Garden Display - Rectangular Layout */}
        <div
          className={`relative mx-3 mt-3 rounded-lg overflow-hidden border-4 border-amber-800 shadow-inner ${
            editMode && selectedItem ? 'cursor-crosshair' : editMode ? 'cursor-pointer' : ''
          }`}
          style={{
            aspectRatio: '4/3',
            backgroundImage: `url(${gardenBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={handleTerrariumClick}
        >
          {/* Placed items */}
          {renderPlacedItems()}

          {/* Edit mode indicator */}
          {editMode && (
            <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
              <div className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                {selectedItem
                  ? `Moving: ${selectedItem.name}`
                  : 'Tap item below or in terrarium'}
              </div>
              {selectedItem && placedItemIds.has(selectedItem.id) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveItem(selectedItem.id);
                  }}
                  className="bg-red-500 text-white text-xs px-2 py-1 rounded-full"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {placedItems.length === 0 && !editMode && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center bg-white/95 px-6 py-4 rounded-xl shadow-lg max-w-xs border border-stone-200">
                {unlockedItems.length === 0 ? (
                  <>
                    <span className="text-4xl block mb-2">🌸</span>
                    <p className="text-stone-700 font-bold">Your garden awaits!</p>
                    <p className="text-stone-500 text-sm mt-1">Add your first memory to unlock garden items.</p>
                  </>
                ) : (
                  <>
                    <span className="text-4xl block mb-2">🎋</span>
                    <p className="text-stone-700 font-bold">You have {unlockedItems.length} items!</p>
                    <p className="text-stone-500 text-sm mt-1">Tap "Edit" to design your garden.</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Placement hint overlay when item selected */}
          {editMode && selectedItem && !placedItemIds.has(selectedItem.id) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-stone-800/70 text-white px-4 py-2 rounded-xl text-sm animate-pulse">
                Tap anywhere to place {selectedItem.name}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 px-3 mt-3">
          <button
            onClick={() => {
              setEditMode(!editMode);
              setSelectedItem(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors ${
              editMode
                ? 'bg-stone-600 text-white'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            {editMode ? 'Done' : 'Edit Garden'}
          </button>
          <button
            onClick={onAddMemory}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold text-sm hover:from-pink-500 hover:to-rose-500 shadow-sm"
          >
            + Add Memory
          </button>
        </div>

        {/* Inventory Panel (shown in edit mode) */}
        {editMode && (
          <div className="flex-1 min-h-0 px-3 py-3 overflow-hidden flex flex-col">
            {/* Category Tabs */}
            <div className="flex gap-1 mb-2 text-xs overflow-x-auto pb-1">
              {(['all', 'plant', 'decoration', 'creature', 'special'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInventoryTab(tab)}
                  className={`px-3 py-1.5 rounded-full capitalize whitespace-nowrap transition-colors ${
                    inventoryTab === tab
                      ? 'bg-stone-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Item Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {filteredInventory.map((item) => {
                  const isPlaced = placedItemIds.has(item.id);
                  const isSelected = selectedItem?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(isSelected ? null : item)}
                      className={`p-2 rounded-lg border-2 flex flex-col items-center transition-all ${
                        isSelected
                          ? 'border-pink-400 bg-pink-50 scale-105 ring-2 ring-pink-200'
                          : isPlaced
                            ? 'border-green-400 bg-green-50'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                      title={isPlaced ? 'Click to move this item' : 'Click to place this item'}
                    >
                      <img
                        src={getTerrariumAsset(item)}
                        alt={item.name}
                        className={`w-8 h-8 ${isSelected ? 'animate-bounce' : ''}`}
                      />
                      <span className="text-[10px] text-stone-600 truncate w-full text-center mt-1">
                        {item.name}
                      </span>
                      {isPlaced && (
                        <span className="text-[8px] text-green-600">Placed</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredInventory.length === 0 && (
                <p className="text-center text-stone-500 text-sm py-4">
                  No items in this category yet. Add more memories to unlock!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats Panel (shown when not editing) */}
        {!editMode && (
          <div className="px-3 py-3">
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="bg-green-100 rounded-lg p-2">
                <div className="text-lg font-bold text-green-600">
                  {unlockedItemObjects.filter((i) => i.category === 'plant').length}
                </div>
                <div className="text-[10px] text-green-700">Plants</div>
              </div>
              <div className="bg-stone-100 rounded-lg p-2">
                <div className="text-lg font-bold text-stone-600">
                  {unlockedItemObjects.filter((i) => i.category === 'decoration').length}
                </div>
                <div className="text-[10px] text-stone-700">Decor</div>
              </div>
              <div className="bg-amber-100 rounded-lg p-2">
                <div className="text-lg font-bold text-amber-600">
                  {unlockedItemObjects.filter((i) => i.category === 'creature').length}
                </div>
                <div className="text-[10px] text-amber-700">Creatures</div>
              </div>
              <div className="bg-pink-100 rounded-lg p-2">
                <div className="text-lg font-bold text-pink-600">
                  {unlockedItemObjects.filter((i) => i.category === 'special').length}
                </div>
                <div className="text-[10px] text-pink-700">Special</div>
              </div>
            </div>

            {/* Next unlock preview */}
            {(() => {
              const nextItem = TERRARIUM_ITEMS.find(
                (item) => item.unlockedAt === totalMemories + 1
              );
              if (nextItem) {
                return (
                  <p className="text-center text-sm text-stone-600 mt-3">
                    Next: <strong>{nextItem.name}</strong> ({nextItem.isBonus ? 'Bonus!' : '1 more memory'})
                  </p>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
