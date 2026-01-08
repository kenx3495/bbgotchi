import { GameState } from '../types';

const SAVE_KEY_PREFIX = 'bbgotchi_save_';
const SAVE_VERSION = 1;
const MAX_SLOTS = 3;

export interface SaveData {
  version: number;
  timestamp: number;
  gameState: GameState;
  slotId: number;
}

export interface SaveSlotInfo {
  slotId: number;
  isEmpty: boolean;
  timestamp?: number;
  petName?: string;
  petLevel?: number;
}

export const saveState = {
  save(gameState: GameState, slotId: number): void {
    if (slotId < 1 || slotId > MAX_SLOTS) {
      console.error('Invalid slot ID');
      return;
    }

    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      gameState,
      slotId,
    };
    try {
      localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(saveData));
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  },

  load(slotId: number): GameState | null {
    try {
      const data = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
      if (!data) return null;

      const saveData: SaveData = JSON.parse(data);

      if (saveData.version !== SAVE_VERSION) {
        console.warn('Save version mismatch, may need migration');
      }

      return saveData.gameState;
    } catch (error) {
      console.error('Failed to load game state:', error);
      return null;
    }
  },

  getSlotInfo(slotId: number): SaveSlotInfo {
    try {
      const data = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
      if (!data) {
        return { slotId, isEmpty: true };
      }

      const saveData: SaveData = JSON.parse(data);
      const activePet = saveData.gameState.pets.find(
        p => p.id === saveData.gameState.activePetId
      ) || saveData.gameState.pets[0];

      return {
        slotId,
        isEmpty: false,
        timestamp: saveData.timestamp,
        petName: activePet?.name,
        petLevel: activePet?.level,
      };
    } catch {
      return { slotId, isEmpty: true };
    }
  },

  getAllSlots(): SaveSlotInfo[] {
    return Array.from({ length: MAX_SLOTS }, (_, i) => this.getSlotInfo(i + 1));
  },

  hasAnySave(): boolean {
    return this.getAllSlots().some(slot => !slot.isEmpty);
  },

  deleteSlot(slotId: number): void {
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${slotId}`);
  },

  deleteAllSaves(): void {
    for (let i = 1; i <= MAX_SLOTS; i++) {
      localStorage.removeItem(`${SAVE_KEY_PREFIX}${i}`);
    }
  },
};
