import { PetStage, PetState, GameState, ShopItem } from './types';

// EXP required for each level (1-10)
// Starts at 20, scales up gradually
export const EXP_PER_LEVEL: Record<number, number> = {
  1: 20,   // Level 1 → 2
  2: 25,   // Level 2 → 3
  3: 32,   // Level 3 → 4
  4: 40,   // Level 4 → 5 (Evolution to Teenager!)
  5: 50,   // Level 5 → 6
  6: 65,   // Level 6 → 7
  7: 80,   // Level 7 → 8
  8: 100,  // Level 8 → 9
  9: 125,  // Level 9 → 10 (Evolution to Adult!)
  10: 0,   // Max level
};

export const MAX_LEVEL = 10;

// Trophy definitions for evolutions
export const EVOLUTION_TROPHIES = {
  teenager: {
    name: 'Growing Up!',
    description: 'Evolved into a Teenager',
    icon: '🎓',
  },
  adult: {
    name: 'All Grown Up!',
    description: 'Reached maximum evolution',
    icon: '👑',
  },
};

export const INITIAL_PETS: PetState[] = [
  {
    id: 'sharkwow',
    name: "Sharkwow",
    type: 'Sharkwow',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 80,
    happiness: 80,
    energy: 100,
    birthday: Date.now(),
    personality: "A cheeky cat in a shark suit who loves watching brain rot videos and saying 'Shark Shark~ Tung Tung Tung'."
  },
  {
    id: 'squirtle',
    name: "Squirtle",
    type: 'Squirtle',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 85,
    happiness: 75,
    energy: 100,
    birthday: Date.now(),
    personality: "The 'favorite son' who thinks Dad is old and lame but loves him anyway. Based on Pokemon's Squirtle."
  },
  {
    id: 'stitch',
    name: "Stitch",
    type: 'Stitch',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 80,
    happiness: 95,
    energy: 100,
    birthday: Date.now(),
    personality: "A blue alien son who loves his 'Ohana' (family). Based on Disney's Stitch. Thinks Dad is cool and fun."
  },
  {
    id: 'duckson',
    name: "Duckson",
    type: 'Duckson',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 90,
    happiness: 90,
    energy: 100,
    birthday: Date.now(),
    personality: "A cute, chubby white duck who speaks Thai (Sawasdee Por) and hopes Dad has happiness every day."
  },
  {
    id: 'dickson',
    name: "Dickson",
    type: 'Dickson',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 70,
    happiness: 80,
    energy: 100,
    birthday: Date.now(),
    personality: "An adorable chubby brown otter who has weird presents for Dad and likes keeping secrets from Mom."
  },
  {
    id: 'sealy',
    name: "Sealy",
    type: 'Sealy',
    stage: PetStage.BABY,
    level: 1,
    exp: 0,
    maxExp: EXP_PER_LEVEL[1],
    hunger: 80,
    happiness: 85,
    energy: 100,
    birthday: Date.now(),
    personality: "A sweet Japanese-style white seal pup who hopes Dad is healthy and can be with them forever."
  }
];

export const INITIAL_GAME_STATE: GameState = {
  credits: 100,
  inventory: {
    food: 5,
    treats: 2,
    toys: 3
  },
  memories: [
    "Our first date at the coffee shop",
    "Walking in the park last summer",
    "That funny movie we saw on Tuesday"
  ],
  journal: [],
  trophies: [],
  unlockedJournalSlots: 5,
  activePetId: 'sharkwow',
  pets: INITIAL_PETS,
  answeredTrivia: [],
  highScores: {
    memoryMatch: 0
  }
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: '1', name: 'Organic Carrot', description: 'Healthy and filling (+20 Hunger)', cost: 10, type: 'food', value: 20 },
  { id: '2', name: 'Pink Cupcake', description: 'Super sweet! (+15 Hunger, +20 Happy)', cost: 15, type: 'treat', value: 20 },
  { id: '3', name: 'Squeaky Heart', description: 'Fun for hours (+30 Happy)', cost: 25, type: 'toy', value: 30 },
  { id: '4', name: 'Love Potion', description: 'Instant wisdom (+50 EXP)', cost: 50, type: 'exp', value: 50 },
  { id: '5', name: 'Golden Apple', description: 'Mastery snack (+200 EXP)', cost: 150, type: 'exp', value: 200 }
];

export const PET_EMOJIS: Record<string, string> = {
  Sharkwow: '🦈🐱',
  Squirtle: '🐢',
  Stitch: '👽',
  Duckson: '🦆',
  Dickson: '🦦',
  Sealy: '🦭',
  Custom: '✨'
};

// Trivia reward per correct answer
export const TRIVIA_REWARD = 5;

// Trivia questions for earning credits
export const TRIVIA_QUESTIONS = [
  {
    id: '1',
    question: "What's the best way to show someone you care?",
    options: ["Ignore them", "Spend quality time together", "Forget their birthday", "Never listen"],
    correctIndex: 1
  },
  {
    id: '2',
    question: "What do happy families do together?",
    options: ["Fight constantly", "Never talk", "Share meals and stories", "Avoid each other"],
    correctIndex: 2
  },
  {
    id: '3',
    question: "What's a great way to make someone smile?",
    options: ["Give a genuine compliment", "Criticize everything", "Ignore their feelings", "Be mean"],
    correctIndex: 0
  },
  {
    id: '4',
    question: "How do you build trust in a relationship?",
    options: ["Break promises", "Keep secrets", "Be honest and reliable", "Never communicate"],
    correctIndex: 2
  },
  {
    id: '5',
    question: "What makes a good listener?",
    options: ["Interrupting constantly", "Looking at your phone", "Giving full attention", "Changing the subject"],
    correctIndex: 2
  },
  {
    id: '6',
    question: "What's important to say to loved ones?",
    options: ["I love you", "I don't care", "Go away", "Whatever"],
    correctIndex: 0
  },
  {
    id: '7',
    question: "What should you do after an argument?",
    options: ["Hold a grudge forever", "Talk it out and apologize", "Never speak again", "Blame the other person"],
    correctIndex: 1
  },
  {
    id: '8',
    question: "What's a sign of a healthy relationship?",
    options: ["Constant jealousy", "Mutual respect", "One-sided effort", "Keeping score"],
    correctIndex: 1
  },
  {
    id: '9',
    question: "How can you support someone having a bad day?",
    options: ["Tell them to get over it", "Listen and be there for them", "Make fun of them", "Ignore their feelings"],
    correctIndex: 1
  },
  {
    id: '10',
    question: "What makes memories special?",
    options: ["Forgetting them quickly", "Sharing them with loved ones", "Keeping them secret", "Having them alone"],
    correctIndex: 1
  },
  {
    id: '11',
    question: "What's a good bedtime habit for families?",
    options: ["Arguing before sleep", "Reading stories together", "Ignoring each other", "Screen time all night"],
    correctIndex: 1
  },
  {
    id: '12',
    question: "How do you celebrate small wins?",
    options: ["Don't acknowledge them", "Share excitement together", "Criticize the effort", "Ignore accomplishments"],
    correctIndex: 1
  },
  {
    id: '13',
    question: "What helps kids feel safe?",
    options: ["Unpredictable rules", "Consistent love and routine", "Constant yelling", "Being left alone"],
    correctIndex: 1
  },
  {
    id: '14',
    question: "What's a fun family activity?",
    options: ["Everyone on separate devices", "Playing games together", "Ignoring each other", "Working all day"],
    correctIndex: 1
  },
  {
    id: '15',
    question: "What makes a house feel like home?",
    options: ["Expensive furniture", "Love and laughter", "Silence and distance", "Strict rules"],
    correctIndex: 1
  }
];

// Memory Match game settings
export const MEMORY_MATCH_CONFIG = {
  easy: { grid: 4, pairs: 8, reward: 20, label: 'Easy', lives: 6 },
  medium: { grid: 6, pairs: 18, reward: 30, label: 'Medium', lives: 8 },
  hard: { grid: 8, pairs: 32, reward: 50, label: 'Hard', lives: 10 }
};

export const MEMORY_MATCH_ENTRY_COST = 1;
export const MEMORY_MATCH_LIVES = 3;
export const MEMORY_MATCH_CONTINUE_COST = 1;
export const MEMORY_MATCH_MAX_CONTINUES = 3;
