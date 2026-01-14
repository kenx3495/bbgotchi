import { GameState } from '../types';
import { INITIAL_GAME_STATE, DEFAULT_NEGATIVE_STATES } from '../constants';

const SAVE_KEY_PREFIX = 'bbgotchi_save_';
const SAVE_VERSION = 4; // Bumped for negative states system
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

      // Migrate old saves by merging with defaults
      const migratedState: GameState = {
        ...INITIAL_GAME_STATE,
        ...saveData.gameState,
        // Ensure terrarium exists with proper structure
        terrarium: {
          unlockedItems: saveData.gameState.terrarium?.unlockedItems ?? [],
          placedItems: saveData.gameState.terrarium?.placedItems ?? [],
        },
        // Ensure memories is an array (migrate from old string[] format if needed)
        memories: Array.isArray(saveData.gameState.memories)
          ? saveData.gameState.memories.map((m: any, idx: number) =>
              typeof m === 'string'
                ? { id: `legacy-${idx}`, title: m.substring(0, 50), content: m, timestamp: Date.now(), memoryNumber: idx + 1 }
                : m
            )
          : [],
        totalMemoryCount: saveData.gameState.totalMemoryCount ?? saveData.gameState.memories?.length ?? 0,
        // Ensure highScores has all fields
        highScores: {
          memoryMatch: saveData.gameState.highScores?.memoryMatch ?? 0,
          pong: saveData.gameState.highScores?.pong ?? 0,
          match3: saveData.gameState.highScores?.match3 ?? 0,
        },
        // Ensure inventory has medicine
        inventory: {
          ...INITIAL_GAME_STATE.inventory,
          ...saveData.gameState.inventory,
          medicine: saveData.gameState.inventory?.medicine ?? 2,
        },
        // Ensure pets have bond property and negativeStates
        pets: saveData.gameState.pets.map(p => ({
          ...p,
          bond: p.bond ?? 0,
          negativeStates: p.negativeStates ?? { ...DEFAULT_NEGATIVE_STATES },
        })),
        // Ensure claimedGifts exists
        claimedGifts: saveData.gameState.claimedGifts ?? [],
      };

      if (saveData.version !== SAVE_VERSION) {
        console.log('Migrated save from version', saveData.version, 'to', SAVE_VERSION);
        // Auto-save the migrated version
        this.save(migratedState, slotId);
      }

      return migratedState;
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
