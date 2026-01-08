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
  birthday: number;
  customImageUrl?: string;
  personality: string;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  levelAtEntry: number;
  prompt: string;
  note: string;
  milestoneType: 'level' | 'trivia' | 'general' | 'evolution';
  petId: string;
}

export interface GameState {
  credits: number;
  inventory: {
    food: number;
    treats: number;
    toys: number;
  };
  memories: string[];
  journal: JournalEntry[];
  trophies: Trophy[];
  unlockedJournalSlots: number;
  activePetId: string;
  pets: PetState[];
  answeredTrivia: string[]; // IDs of answered trivia questions
  highScores: {
    memoryMatch: number;
  };
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
  type: 'food' | 'treat' | 'toy' | 'exp';
  value: number;
}
