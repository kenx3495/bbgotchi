export enum PetStage {
  BABY = 'Baby',
  TEENAGER = 'Teenager',
  ADULT = 'Adult'
}

export type PetType = 'Sharkwow' | 'Squirtle' | 'Duckson' | 'Dickson' | 'Sealy' | 'Stitch' | 'Custom';

export interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: number; // timestamp
  petId: string;
  petName: string;
}

// Negative state tracking for Tamagotchi-style mechanics
export interface NegativeStates {
  poop: {
    active: boolean;
    count: number;           // Number of poops (can stack up to 3)
    lastTriggeredAt: number | null;
  };
  sick: {
    active: boolean;
    startedAt: number | null;
    medicineGivenAt: number | null;
    lowStatDuration: number; // Seconds stats have been below threshold
  };
  misbehaving: {
    active: boolean;
    startedAt: number | null;
    overplayCount: number;   // Recent play count for tracking
    lastPlayAt: number | null;
  };
  tired: {
    active: boolean;
    startedAt: number | null;
  };
}

export interface PetState {
  id: string;
  name: string;
  type: PetType;
  stage: PetStage;
  level: number;
  exp: number;
  maxExp: number;
  hunger: number; // 0-100
  happiness: number; // 0-100
  energy: number; // 0-100
  bond: number; // 0-100, increases by playing games together
  birthday: number;
  customImageUrl?: string;
  personality: string;
  negativeStates: NegativeStates; // Tamagotchi-style negative states
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  levelAtEntry: number;
  prompt: string;
  note: string;
  milestoneType: 'level' | 'trivia' | 'general' | 'evolution' | 'neglect' | 'feed' | 'play' | 'pet' | 'game_win';
  petId: string;
}

// Memory Terrarium types
export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  photoUrl?: string; // base64 data URL
  timestamp: number;
  memoryNumber: number; // sequential count
}

export interface TerrariumItem {
  id: string;
  name: string;
  asset: string; // filename in assets/terrarium/
  category: 'plant' | 'decoration' | 'creature' | 'special';
  layer: 'back' | 'middle' | 'front';
  unlockedAt: number; // memory count when unlocked
  isBonus?: boolean; // true for every 5th memory bonus items
}

export interface PlacedItem {
  itemId: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  layer: 'back' | 'middle' | 'front';
}

// Claimed gift from a pet
export interface ClaimedGift {
  giftId: string;
  petId: string;
  claimedAt: number;
}

export interface GameState {
  credits: number;
  inventory: {
    food: number;
    treats: number;
    toys: number;
    medicine: number; // For curing sickness
  };
  memories: MemoryEntry[]; // Changed from string[] to MemoryEntry[]
  journal: JournalEntry[];
  trophies: Trophy[];
  unlockedJournalSlots: number;
  activePetId: string;
  pets: PetState[];
  answeredTrivia: string[]; // IDs of answered trivia questions
  highScores: {
    memoryMatch: number;
    pong: number;
    match3: number;
  };
  // Memory Terrarium
  terrarium: {
    unlockedItems: string[]; // item IDs that have been unlocked
    placedItems: PlacedItem[]; // items placed in the terrarium
  };
  totalMemoryCount: number; // total memories ever created (for unlock progression)
  // Bond system
  claimedGifts: ClaimedGift[]; // gifts claimed from pets
}

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'food' | 'treat' | 'toy' | 'exp' | 'medicine';
  value: number;
}
