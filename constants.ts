import { PetStage, PetState, GameState, ShopItem, TerrariumItem, NegativeStates } from './types';

// Default negative states for new pets
export const DEFAULT_NEGATIVE_STATES: NegativeStates = {
  poop: { active: false, count: 0, lastTriggeredAt: null },
  sick: { active: false, startedAt: null, medicineGivenAt: null, lowStatDuration: 0 },
  misbehaving: { active: false, startedAt: null, overplayCount: 0, lastPlayAt: null },
  tired: { active: false, startedAt: null },
};

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
    bond: 0,
    birthday: Date.now(),
    personality: "A cheeky cat in a shark suit who loves watching brain rot videos and saying 'Shark Shark~ Tung Tung Tung'.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
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
    bond: 0,
    birthday: Date.now(),
    personality: "The 'favorite son' who thinks Dad is old and lame but loves him anyway. Based on Pokemon's Squirtle.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
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
    bond: 0,
    birthday: Date.now(),
    personality: "A blue alien son who loves his 'Ohana' (family). Based on Disney's Stitch. Thinks Dad is cool and fun.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
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
    bond: 0,
    birthday: Date.now(),
    personality: "A cute, chubby white duck who speaks Thai (Sawasdee Por) and hopes Dad has happiness every day.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
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
    bond: 0,
    birthday: Date.now(),
    personality: "An adorable chubby brown otter who has weird presents for Dad and likes keeping secrets from Mom.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
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
    bond: 0,
    birthday: Date.now(),
    personality: "A sweet Japanese-style white seal pup who hopes Dad is healthy and can be with them forever.",
    negativeStates: { ...DEFAULT_NEGATIVE_STATES },
  }
];

export const INITIAL_GAME_STATE: GameState = {
  credits: 100,
  inventory: {
    food: 5,
    treats: 2,
    toys: 3,
    medicine: 2,
  },
  memories: [], // Now MemoryEntry[] - start fresh
  journal: [],
  trophies: [],
  unlockedJournalSlots: 5,
  activePetId: 'sharkwow',
  pets: INITIAL_PETS,
  answeredTrivia: [],
  highScores: {
    memoryMatch: 0,
    pong: 0,
    match3: 0
  },
  terrarium: {
    unlockedItems: [],
    placedItems: []
  },
  totalMemoryCount: 0,
  claimedGifts: []
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: '1', name: 'Organic Carrot', description: 'Healthy and filling (+20 Hunger)', cost: 10, type: 'food', value: 20 },
  { id: '2', name: 'Pink Cupcake', description: 'Super sweet! (+15 Hunger, +20 Happy)', cost: 15, type: 'treat', value: 20 },
  { id: '3', name: 'Squeaky Heart', description: 'Fun for hours (+30 Happy)', cost: 25, type: 'toy', value: 30 },
  { id: '4', name: 'Love Potion', description: 'Instant wisdom (+50 EXP)', cost: 50, type: 'exp', value: 50 },
  { id: '5', name: 'Golden Apple', description: 'Mastery snack (+200 EXP)', cost: 150, type: 'exp', value: 200 },
  { id: '6', name: 'Yummy Medicine', description: 'Cures sickness! Tastes like candy!', cost: 25, type: 'medicine', value: 1 },
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

// Pet AI difficulty profiles for Game Room
export const PET_AI_DIFFICULTY: Record<string, { pongSpeed: number; pongAccuracy: number; match3Hint: number }> = {
  Sharkwow: { pongSpeed: 0.7, pongAccuracy: 0.8, match3Hint: 0.6 },
  Squirtle: { pongSpeed: 0.8, pongAccuracy: 0.85, match3Hint: 0.7 },
  Stitch: { pongSpeed: 0.95, pongAccuracy: 0.95, match3Hint: 0.9 },  // Hardest
  Duckson: { pongSpeed: 0.5, pongAccuracy: 0.6, match3Hint: 0.4 },   // Easiest
  Dickson: { pongSpeed: 0.6, pongAccuracy: 0.7, match3Hint: 0.5 },
  Sealy: { pongSpeed: 0.65, pongAccuracy: 0.75, match3Hint: 0.55 },
  Custom: { pongSpeed: 0.7, pongAccuracy: 0.75, match3Hint: 0.6 },
};

// Game Room configuration
export const GAME_ROOM_CONFIG = {
  pong: {
    entryCost: 2,
    winReward: 25,
    bondGain: 5,
    pointsToWin: 5,
    ballSpeed: 4,
    paddleSpeed: 6,
  },
  match3: {
    entryCost: 1,
    timeLimit: 60,
    rewards: { bronze: 15, silver: 25, gold: 40 },
    scoreThresholds: { bronze: 500, silver: 1000, gold: 2000 },
    bondGain: 3,
    gridSize: 8,
    gemTypes: 6,
  },
};

// Memory Garden Items - Japanese Bonsai Garden Theme
// Regular items unlock 1 per memory, bonus items unlock every 5th memory
export const TERRARIUM_ITEMS: TerrariumItem[] = [
  // Memory 1-5: Garden Beginnings
  { id: 'stepping-stone', name: 'Stepping Stone', asset: 'stepping-stone.png', category: 'decoration', layer: 'front', unlockedAt: 1 },
  { id: 'moss-patch', name: 'Moss Patch', asset: 'moss-patch.png', category: 'plant', layer: 'back', unlockedAt: 2 },
  { id: 'small-rock', name: 'Garden Rock', asset: 'small-rock.png', category: 'decoration', layer: 'front', unlockedAt: 3 },
  { id: 'bamboo-shoot', name: 'Bamboo Shoot', asset: 'bamboo-shoot.png', category: 'plant', layer: 'middle', unlockedAt: 4 },
  { id: 'fern', name: 'Fern', asset: 'fern.png', category: 'plant', layer: 'front', unlockedAt: 5 },
  { id: 'koi-orange', name: 'Orange Koi', asset: 'koi-orange.png', category: 'creature', layer: 'front', unlockedAt: 5, isBonus: true },

  // Memory 6-10: Zen Elements
  { id: 'zen-sand', name: 'Zen Sand', asset: 'zen-sand.png', category: 'decoration', layer: 'back', unlockedAt: 6 },
  { id: 'small-bonsai', name: 'Small Bonsai', asset: 'small-bonsai.png', category: 'plant', layer: 'middle', unlockedAt: 7 },
  { id: 'stone-lantern', name: 'Stone Lantern', asset: 'stone-lantern.png', category: 'decoration', layer: 'middle', unlockedAt: 8 },
  { id: 'azalea', name: 'Azalea Bush', asset: 'azalea.png', category: 'plant', layer: 'front', unlockedAt: 9 },
  { id: 'bamboo-fence', name: 'Bamboo Fence', asset: 'bamboo-fence.png', category: 'decoration', layer: 'back', unlockedAt: 10 },
  { id: 'dragonfly', name: 'Dragonfly', asset: 'dragonfly.png', category: 'creature', layer: 'front', unlockedAt: 10, isBonus: true },

  // Memory 11-15: Water Features
  { id: 'lotus-pad', name: 'Lotus Pad', asset: 'lotus-pad.png', category: 'plant', layer: 'front', unlockedAt: 11 },
  { id: 'wooden-bridge', name: 'Wooden Bridge', asset: 'wooden-bridge.png', category: 'decoration', layer: 'middle', unlockedAt: 12 },
  { id: 'lotus-flower', name: 'Lotus Flower', asset: 'lotus-flower.png', category: 'plant', layer: 'front', unlockedAt: 13 },
  { id: 'water-basin', name: 'Tsukubai Basin', asset: 'water-basin.png', category: 'decoration', layer: 'middle', unlockedAt: 14 },
  { id: 'iris', name: 'Japanese Iris', asset: 'iris.png', category: 'plant', layer: 'front', unlockedAt: 15 },
  { id: 'koi-white', name: 'White Koi', asset: 'koi-white.png', category: 'creature', layer: 'front', unlockedAt: 15, isBonus: true },

  // Memory 16-20: Sakura Season
  { id: 'cherry-branch', name: 'Cherry Branch', asset: 'cherry-branch.png', category: 'plant', layer: 'middle', unlockedAt: 16 },
  { id: 'paper-lantern', name: 'Paper Lantern', asset: 'paper-lantern.png', category: 'decoration', layer: 'back', unlockedAt: 17 },
  { id: 'sakura-tree', name: 'Sakura Tree', asset: 'sakura-tree.png', category: 'plant', layer: 'back', unlockedAt: 18 },
  { id: 'stone-path', name: 'Stone Path', asset: 'stone-path.png', category: 'decoration', layer: 'front', unlockedAt: 19 },
  { id: 'wisteria', name: 'Wisteria', asset: 'wisteria.png', category: 'plant', layer: 'middle', unlockedAt: 20 },
  { id: 'butterfly', name: 'Butterfly', asset: 'butterfly.png', category: 'creature', layer: 'front', unlockedAt: 20, isBonus: true },

  // Memory 21-25: Temple Garden
  { id: 'pine-tree', name: 'Pine Tree', asset: 'pine-tree.png', category: 'plant', layer: 'back', unlockedAt: 21 },
  { id: 'torii-gate', name: 'Torii Gate', asset: 'torii-gate.png', category: 'decoration', layer: 'middle', unlockedAt: 22 },
  { id: 'maple-tree', name: 'Maple Tree', asset: 'maple-tree.png', category: 'plant', layer: 'back', unlockedAt: 23 },
  { id: 'shrine-bell', name: 'Shrine Bell', asset: 'shrine-bell.png', category: 'decoration', layer: 'middle', unlockedAt: 24 },
  { id: 'camellia', name: 'Camellia', asset: 'camellia.png', category: 'plant', layer: 'front', unlockedAt: 25 },
  { id: 'crane', name: 'Crane Bird', asset: 'crane.png', category: 'creature', layer: 'middle', unlockedAt: 25, isBonus: true },

  // Memory 26-30: Autumn Garden
  { id: 'red-maple', name: 'Red Maple Leaves', asset: 'red-maple.png', category: 'plant', layer: 'front', unlockedAt: 26 },
  { id: 'pagoda', name: 'Mini Pagoda', asset: 'pagoda.png', category: 'decoration', layer: 'middle', unlockedAt: 27 },
  { id: 'chrysanthemum', name: 'Chrysanthemum', asset: 'chrysanthemum.png', category: 'plant', layer: 'front', unlockedAt: 28 },
  { id: 'rake-pattern', name: 'Zen Rake Pattern', asset: 'rake-pattern.png', category: 'decoration', layer: 'back', unlockedAt: 29 },
  { id: 'ginkgo', name: 'Ginkgo Tree', asset: 'ginkgo.png', category: 'plant', layer: 'back', unlockedAt: 30 },
  { id: 'frog', name: 'Garden Frog', asset: 'frog.png', category: 'creature', layer: 'front', unlockedAt: 30, isBonus: true },

  // Memory 31-35: Night Garden
  { id: 'moon-grass', name: 'Moon Grass', asset: 'moon-grass.png', category: 'plant', layer: 'front', unlockedAt: 31 },
  { id: 'hanging-lantern', name: 'Hanging Lantern', asset: 'hanging-lantern.png', category: 'decoration', layer: 'back', unlockedAt: 32 },
  { id: 'night-jasmine', name: 'Night Jasmine', asset: 'night-jasmine.png', category: 'plant', layer: 'middle', unlockedAt: 33 },
  { id: 'moon-window', name: 'Moon Window', asset: 'moon-window.png', category: 'decoration', layer: 'back', unlockedAt: 34 },
  { id: 'orchid', name: 'Orchid', asset: 'orchid.png', category: 'plant', layer: 'front', unlockedAt: 35 },
  { id: 'fireflies', name: 'Fireflies', asset: 'fireflies.png', category: 'special', layer: 'front', unlockedAt: 35, isBonus: true },

  // Memory 36-40: Tea Garden
  { id: 'tea-bush', name: 'Tea Bush', asset: 'tea-bush.png', category: 'plant', layer: 'front', unlockedAt: 36 },
  { id: 'stone-bench', name: 'Stone Bench', asset: 'stone-bench.png', category: 'decoration', layer: 'middle', unlockedAt: 37 },
  { id: 'bamboo-grove', name: 'Bamboo Grove', asset: 'bamboo-grove.png', category: 'plant', layer: 'back', unlockedAt: 38 },
  { id: 'tea-house', name: 'Tea House', asset: 'tea-house.png', category: 'decoration', layer: 'back', unlockedAt: 39 },
  { id: 'plum-blossom', name: 'Plum Blossom', asset: 'plum-blossom.png', category: 'plant', layer: 'middle', unlockedAt: 40 },
  { id: 'turtle', name: 'Garden Turtle', asset: 'turtle.png', category: 'creature', layer: 'front', unlockedAt: 40, isBonus: true },

  // Memory 41-45: Spirit Garden
  { id: 'spirit-tree', name: 'Spirit Tree', asset: 'spirit-tree.png', category: 'plant', layer: 'back', unlockedAt: 41 },
  { id: 'shimenawa', name: 'Sacred Rope', asset: 'shimenawa.png', category: 'decoration', layer: 'middle', unlockedAt: 42 },
  { id: 'sacred-bamboo', name: 'Nandina', asset: 'sacred-bamboo.png', category: 'plant', layer: 'front', unlockedAt: 43 },
  { id: 'daruma', name: 'Daruma Doll', asset: 'daruma.png', category: 'special', layer: 'front', unlockedAt: 44 },
  { id: 'weeping-willow', name: 'Weeping Willow', asset: 'weeping-willow.png', category: 'plant', layer: 'back', unlockedAt: 45 },
  { id: 'goldfish', name: 'Goldfish', asset: 'goldfish.png', category: 'creature', layer: 'front', unlockedAt: 45, isBonus: true },

  // Memory 46-50: Master's Garden
  { id: 'ancient-bonsai', name: 'Ancient Bonsai', asset: 'ancient-bonsai.png', category: 'plant', layer: 'middle', unlockedAt: 46 },
  { id: 'golden-lantern', name: 'Golden Lantern', asset: 'golden-lantern.png', category: 'decoration', layer: 'middle', unlockedAt: 47 },
  { id: 'peony', name: 'Peony', asset: 'peony.png', category: 'plant', layer: 'front', unlockedAt: 48 },
  { id: 'koi-pond', name: 'Koi Pond', asset: 'koi-pond.png', category: 'decoration', layer: 'back', unlockedAt: 49 },
  { id: 'eternal-sakura', name: 'Eternal Sakura', asset: 'eternal-sakura.png', category: 'plant', layer: 'back', unlockedAt: 50 },
  { id: 'maneki-neko', name: 'Lucky Cat', asset: 'maneki-neko.png', category: 'special', layer: 'front', unlockedAt: 50, isBonus: true },
];

// Feature unlock milestones
export const FEATURE_UNLOCKS = {
  gallery: 25,    // Photo gallery unlocks at 25 memories
  throwback: 50,  // Throwback feature unlocks at 50 memories
};

// Bond Level System
// 10 levels, every 10 bond points = 1 level
export const BOND_LEVELS = [
  { level: 1, minBond: 0, name: 'Kid', emoji: '👶', color: 'gray' },
  { level: 2, minBond: 10, name: 'Friendly Kid', emoji: '🙂', color: 'gray' },
  { level: 3, minBond: 20, name: 'Sweet Kid', emoji: '😊', color: 'blue' },
  { level: 4, minBond: 30, name: 'Loving Kid', emoji: '🥰', color: 'blue' },
  { level: 5, minBond: 40, name: 'Devoted Kid', emoji: '💙', color: 'green' },
  { level: 6, minBond: 50, name: 'Adoring Kid', emoji: '💚', color: 'green' },
  { level: 7, minBond: 60, name: 'Precious Kid', emoji: '💜', color: 'purple' },
  { level: 8, minBond: 70, name: 'Treasured Kid', emoji: '💖', color: 'purple' },
  { level: 9, minBond: 80, name: 'Cherished Kid', emoji: '💕', color: 'pink' },
  { level: 10, minBond: 90, name: 'Favourite Kid', emoji: '👑', color: 'pink' },
];

// Bond gains from different interactions
export const BOND_GAINS = {
  pet: 2,       // Petting/cuddles
  play: 3,      // Playing with toys
  pongWin: 5,   // Winning Pong
  match3: 3,    // Completing Match-3
};

// ============================================
// NEGATIVE STATE SYSTEM (Tamagotchi mechanics)
// ============================================

export const NEGATIVE_STATE_CONFIG = {
  poop: {
    hungerThreshold: 80,      // Feeding above this triggers poop
    maxPoopCount: 3,          // Max poops before severe penalty
    happinessPenaltyPerTick: 0.2, // Happiness drain per tick per poop
    cleanExpReward: 3,
  },
  sick: {
    statThreshold: 15,        // Hunger OR happiness below this
    durationToTrigger: 120,   // Seconds of low stats before sick (2 min)
    recoveryTime: 60,         // Seconds after medicine to recover
    decayMultiplier: 2,       // All stats decay 2x when sick
    medicineExpReward: 5,
  },
  misbehaving: {
    happinessThreshold: 90,   // Playing above this triggers misbehaving
    maxPlaysInWindow: 5,      // Max plays allowed in time window
    playWindowSeconds: 60,    // Time window for play tracking
    scoldHappinessCost: 15,   // Happiness lost from scolding
    scoldExpReward: 5,
    scoldBondGain: 1,         // Small bond gain for discipline
  },
  tired: {
    energyThreshold: 20,      // Below this triggers tired
    recoveryThreshold: 40,    // Above this clears tired
    energyRecoveryBoost: 0.1, // Bonus energy recovery when resting
    restExpReward: 2,
    restEnergyBoost: 10,      // Immediate energy from rest action
  },
};

export const NEGATIVE_STATE_MESSAGES = {
  poop: {
    trigger: [
      "Oops! I made a mess... 💩",
      "Uh oh... I need cleaning! 💩",
      "Too much food, too fast... 💩",
    ],
    clean: [
      "Ahh, all clean now! Thanks! ✨",
      "That's better! I feel fresh! 🧼",
      "Squeaky clean! Love you! 💕",
    ],
    warning: [
      "It's getting stinky in here... 💩",
      "Please clean up my mess? 🥺",
    ],
  },
  sick: {
    trigger: [
      "I don't feel so good... 🤒",
      "My tummy hurts... 😢",
      "I feel weak... need care... 💊",
    ],
    medicine: [
      "Medicine time? I'll be brave... 💊",
      "This tastes yucky but okay... 🤢",
    ],
    recovering: [
      "Starting to feel better... 😌",
      "The medicine is helping... 💪",
    ],
    recovered: [
      "I'm all better now! Thank you! 🎉",
      "Feeling healthy again! 💪✨",
    ],
  },
  misbehaving: {
    trigger: [
      "Hehe! I'm being naughty! 😈",
      "Can't stop won't stop! 🤪",
      "Too much energy! CHAOS! 💥",
    ],
    scold: [
      "I'm sorry... I'll behave now... 😢",
      "Okay okay, I'll calm down... 😔",
      "You're right... I was being silly... 🥺",
    ],
    blocked: [
      "I need to calm down first... 😤",
      "Too hyper to focus! 🤪",
    ],
  },
  tired: {
    trigger: [
      "So sleepy... 😴",
      "Can barely keep eyes open... 💤",
      "Need... rest... zzz... 😪",
    ],
    resting: [
      "Zzz... resting... zzz... 💤",
      "Just a quick nap... 😴",
    ],
    recovered: [
      "I'm awake! Feeling refreshed! ⚡",
      "All rested up! Let's play! 🎮",
    ],
    blocked: [
      "Too tired to play... 😴",
      "Need rest first... zzz... 💤",
    ],
  },
};

// Gifts unlocked at each bond level
// User can customize assets - place in /assets/gifts/
export interface BondGift {
  id: string;
  name: string;
  description: string;
  messages: Record<string, string>;  // petId -> personalized message
  defaultMessage: string;            // fallback message
  assets: Record<string, string>;    // petId -> asset filename
  defaultAsset: string;              // fallback asset filename
  bondLevel: number;                 // level required to receive
  reward?: {
    type: 'credits' | 'food' | 'toys' | 'exp';
    amount: number;
  };
}

export const BOND_GIFTS: BondGift[] = [
  // Level 2 - Friendly Kid
  {
    id: 'gift-drawing',
    name: 'Hand-drawn Picture',
    description: 'A crayon drawing just for you!',
    messages: {
      'sharkwow': "SHARK SHARK! I drew us doing the Tung Tung Tung dance together! 🦈 It's giving brain rot but make it ART! Do you like it?? 🎨",
      'squirtle': "Ugh, I guess I drew this for you... It's not like I WANTED to or anything! ...Do you think it's cool? I worked really hard on it. 🎨",
      'stitch': "OHANA! I made this picture of our whole family! See, that's you, and me, and everyone! Ohana means family, and family means I draw you LOTS! 💙",
      'duckson': "Sawasdee Por! 🙏 I drew this picture hoping it brings you happiness! I put extra sunshine in it because you deserve bright days! ☀️",
      'dickson': "Psst! I drew this in SECRET! Don't tell Mom, but I hid a secret message in the picture... can you find it? Hehe! 🤫",
      'sealy': "I drew this picture very carefully for you! I hope it makes your heart feel warm. Please take care of yourself, okay? 🌸",
    },
    defaultMessage: "I drew this picture of us together! Do you like it? I used all my favorite colors because you make me happy! 🖍️",
    assets: {
      'sharkwow': 'sharkwow_drawing.png',
      'squirtle': 'squirtle_drawing.png',
      'stitch': 'stitch_drawing.png',
      'duckson': 'duckson_drawing.png',
      'dickson': 'dickson_drawing.png',
      'sealy': 'sealy_drawing.png',
    },
    defaultAsset: 'drawing.png',
    bondLevel: 2,
    reward: { type: 'credits', amount: 10 }
  },
  // Level 3 - Sweet Kid
  {
    id: 'gift-flower',
    name: 'Picked Flower',
    description: 'A flower picked especially for you!',
    messages: {
      'sharkwow': "Found this flower while looking for more brain rot content! It's like... aesthetic or whatever! Shark Shark~ Take it! 🌺",
      'squirtle': "Here's a dumb flower I found. ...What? I thought of you when I saw it, okay?! Don't make it weird, old man! 🌸",
      'stitch': "PRETTY FLOWER FOR PRETTY FAMILY! I picked the BEST one because you're the BEST! Ohana forever! 🌺💙",
      'duckson': "Sawasdee Por! This flower reminded me of you - bringing beauty wherever you go! May it bring you joy today! 🌷🙏",
      'dickson': "I found this flower in a SECRET spot! Don't ask where... okay fine it was behind the couch. But it's still pretty right?! 🌻",
      'sealy': "I picked this flower very gently so it stays beautiful for you. Every petal is like a wish for your good health! 🌸",
    },
    defaultMessage: "I found this pretty flower and thought of you! It reminded me of how you always make everything brighter. I hope it makes you smile! 🌸",
    assets: {
      'sharkwow': 'sharkwow_flower.png',
      'squirtle': 'squirtle_flower.png',
      'stitch': 'stitch_flower.png',
      'duckson': 'duckson_flower.png',
      'dickson': 'dickson_flower.png',
      'sealy': 'sealy_flower.png',
    },
    defaultAsset: 'flower.png',
    bondLevel: 3,
    reward: { type: 'credits', amount: 15 }
  },
  // Level 4 - Loving Kid
  {
    id: 'gift-bracelet',
    name: 'Friendship Bracelet',
    description: 'A handmade bracelet with love!',
    messages: {
      'sharkwow': "Made you a bracelet! It says 'SHARK FAM' on it! Now everyone will know you're part of the Tung Tung Tung crew! 🦈✨",
      'squirtle': "I made this bracelet... It took FOREVER and I poked myself like 100 times. You better wear it every day! ...Please? 💫",
      'stitch': "MATCHING BRACELETS! Now we're OFFICIALLY ohana! When you wear it, you'll always remember - nobody gets left behind! 💙",
      'duckson': "Sawasdee Por! I made this bracelet with prayers for your happiness woven into every thread! Wear it and feel loved! 🙏💕",
      'dickson': "This bracelet has a SECRET compartment! Don't tell Mom but I hid a tiny note inside... it says 'Dad is the best!' Shhhh! 🤫",
      'sealy': "I made each knot carefully, thinking of your health and happiness. Please wear it so I can always be close to you! 💕",
    },
    defaultMessage: "I made this bracelet all by myself! Every knot I tied, I thought about how much I love spending time with you. Now we match! 💫",
    assets: {
      'sharkwow': 'sharkwow_bracelet.png',
      'squirtle': 'squirtle_bracelet.png',
      'stitch': 'stitch_bracelet.png',
      'duckson': 'duckson_bracelet.png',
      'dickson': 'dickson_bracelet.png',
      'sealy': 'sealy_bracelet.png',
    },
    defaultAsset: 'bracelet.png',
    bondLevel: 4,
    reward: { type: 'credits', amount: 20 }
  },
  // Level 5 - Devoted Kid
  {
    id: 'gift-snack',
    name: 'Shared Snack',
    description: 'Saved their favorite snack for you!',
    messages: {
      'sharkwow': "I saved my snackies for you! Usually I eat everything while watching videos but... you're more important than brain rot! (Don't tell anyone I said that!) 🍪",
      'squirtle': "FINE. I saved you some snacks. Don't get emotional about it! I just... wasn't that hungry. That's all! *looks away* 🍪",
      'stitch': "OHANA SHARE EVERYTHING! These are MY favorite snacks but I saved them for YOU because sharing is what families DO! 💙🍪",
      'duckson': "Sawasdee Por! Please enjoy these snacks! Eating together brings happiness, and I want you to be happy always! 🙏🍪",
      'dickson': "I hid these snacks in my SECRET snack spot! Don't ask how long they've been there... they're still good! Probably! Want some?? 🤫🍪",
      'sealy': "I saved these snacks for you! Please eat well and stay healthy! I worry about you, you know? 🍪💕",
    },
    defaultMessage: "I saved my favorite snack just for you! I know sharing is caring, and I care about you SO much. Let's eat together! 🍪",
    assets: {
      'sharkwow': 'sharkwow_snack.png',
      'squirtle': 'squirtle_snack.png',
      'stitch': 'stitch_snack.png',
      'duckson': 'duckson_snack.png',
      'dickson': 'dickson_snack.png',
      'sealy': 'sealy_snack.png',
    },
    defaultAsset: 'snack.png',
    bondLevel: 5,
    reward: { type: 'food', amount: 3 }
  },
  // Level 6 - Adoring Kid
  {
    id: 'gift-photo',
    name: 'Special Photo',
    description: 'A photo of your adventures together!',
    messages: {
      'sharkwow': "OMG look at this photo! We look SO fire! This is giving main character energy! Shark Shark~ We're iconic! 📸🦈",
      'squirtle': "Found this old photo of us... I guess we don't look THAT bad together. You're still old though. But like... cool old? Maybe? 📸",
      'stitch': "BEST PHOTO EVER! Look at us being the BEST OHANA! I look at it every day and it makes my heart go BOOM BOOM! 💙📸",
      'duckson': "Sawasdee Por! This photo captures such a happy moment! I framed it with extra love so you can feel the joy always! 🙏📸",
      'dickson': "This is from that SECRET adventure we had! Remember? Don't tell Mom about the part where we... you know! Our secret! 🤫📸",
      'sealy': "I keep this photo close to my heart. Every time I see it, I pray that we can make more memories together. Stay healthy! 📸💕",
    },
    defaultMessage: "Look at this photo of us! This is my favorite memory. I put it in a special frame so you can look at it whenever you miss me. I love you! 📸",
    assets: {
      'sharkwow': 'sharkwow_photo.png',
      'squirtle': 'squirtle_photo.png',
      'stitch': 'stitch_photo.png',
      'duckson': 'duckson_photo.png',
      'dickson': 'dickson_photo.png',
      'sealy': 'sealy_photo.png',
    },
    defaultAsset: 'photo.png',
    bondLevel: 6,
    reward: { type: 'credits', amount: 30 }
  },
  // Level 7 - Precious Kid
  {
    id: 'gift-toy',
    name: 'Favorite Toy',
    description: 'Sharing their most treasured toy!',
    messages: {
      'sharkwow': "This is my favorite toy shark... his name is Tung Tung Jr. I'm giving him to you because... because you're my favorite human! SHARK SHARK! 🦈🧸",
      'squirtle': "This is... my favorite toy. I've had it forever and I never let ANYONE touch it. But... you can have it. Because you're... you know. Special. Or whatever! 🧸",
      'stitch': "This is my MOST PRECIOUS toy! But ohana shares EVERYTHING! You having it means you're REALLY part of the family now! OHANA! 💙🧸",
      'duckson': "Sawasdee Por! This toy has brought me so much happiness. I want to share that happiness with you! May it bless your days! 🙏🧸",
      'dickson': "This is my SECRET favorite toy! I hide it where Mom can't find it! But I trust YOU with my secrets... take good care of it! 🤫🧸",
      'sealy': "This toy comforts me when I'm scared. Now I want it to comfort you too. Please know I'm always thinking of your wellbeing! 🧸💕",
    },
    defaultMessage: "This is my most favorite toy in the whole world... and I want you to have it. Because YOU are my most favorite person in the whole world! 🧸",
    assets: {
      'sharkwow': 'sharkwow_toy.png',
      'squirtle': 'squirtle_toy.png',
      'stitch': 'stitch_toy.png',
      'duckson': 'duckson_toy.png',
      'dickson': 'dickson_toy.png',
      'sealy': 'sealy_toy.png',
    },
    defaultAsset: 'toy.png',
    bondLevel: 7,
    reward: { type: 'toys', amount: 2 }
  },
  // Level 8 - Treasured Kid
  {
    id: 'gift-letter',
    name: 'Love Letter',
    description: 'A heartfelt letter expressing their love!',
    messages: {
      'sharkwow': "Dear Mom and Dad, you're literally the GOAT! No cap! Even when you don't understand my brain rot, you still love me! That's lowkey iconic! SHARK SHARK FOREVER! 🦈💌",
      'squirtle': "Dear Dad... I know I say you're old and lame but... you're actually the coolest dad ever. Don't let it go to your head! I love you. There, I said it! 💌",
      'stitch': "DEAR OHANA! You are my FAVORITE HUMANS IN THE WHOLE UNIVERSE! Thank you for never leaving me behind! I LOVE YOU THIS MUCH! *opens arms super wide* 💙💌",
      'duckson': "Sawasdee Por! Dear beloved parents, every day I pray for your happiness. You have given me so much love. My heart is full of gratitude! 🙏💌",
      'dickson': "Dear Dad, this letter has ALL my secrets! Just kidding... or am I? 🤫 But seriously, you're the best at keeping secrets WITH me! Love you! 💌",
      'sealy': "Dear Mom and Dad, please always take care of yourselves. I wish I could stay with you forever. Thank you for everything. I love you so much! 💌💕",
    },
    defaultMessage: "Dear Mom and Dad, I wrote this letter to tell you that you are the best parents ever! Thank you for always being there for me. I love you to the moon and back! 💌",
    assets: {
      'sharkwow': 'sharkwow_letter.png',
      'squirtle': 'squirtle_letter.png',
      'stitch': 'stitch_letter.png',
      'duckson': 'duckson_letter.png',
      'dickson': 'dickson_letter.png',
      'sealy': 'sealy_letter.png',
    },
    defaultAsset: 'letter.png',
    bondLevel: 8,
    reward: { type: 'credits', amount: 50 }
  },
  // Level 9 - Cherished Kid
  {
    id: 'gift-locket',
    name: 'Heart Locket',
    description: 'A locket with your picture inside!',
    messages: {
      'sharkwow': "This locket has our photo inside! Now you carry the SHARK FAM wherever you go! We're literally inseparable now! Tung Tung Tung! 🦈💖",
      'squirtle': "I put our picture in this locket... Now you'll always have me close. Even when I'm being annoying. Because that's what family does, right? 💖",
      'stitch': "OHANA LOCKET! Your picture is inside MY heart, so now YOUR picture is inside THIS heart! We're connected FOREVER! 💙💖",
      'duckson': "Sawasdee Por! This locket holds my love for you! Wear it close to your heart, and know that my prayers are always with you! 🙏💖",
      'dickson': "This locket has a SECRET second compartment! Our photo is in one side, and in the other... it's a secret! (It says 'Best Dad Ever'!) 🤫💖",
      'sealy': "I put our photo in this locket so I can always be close to your heart. Please stay healthy... I want us to be together for a long, long time! 💖💕",
    },
    defaultMessage: "I put our picture in this heart locket. Now I can keep you close to my heart forever, just like you keep me close to yours. You mean everything to me! 💖",
    assets: {
      'sharkwow': 'sharkwow_locket.png',
      'squirtle': 'squirtle_locket.png',
      'stitch': 'stitch_locket.png',
      'duckson': 'duckson_locket.png',
      'dickson': 'dickson_locket.png',
      'sealy': 'sealy_locket.png',
    },
    defaultAsset: 'locket.png',
    bondLevel: 9,
    reward: { type: 'exp', amount: 100 }
  },
  // Level 10 - Favourite Kid
  {
    id: 'gift-treasure',
    name: 'Secret Treasure',
    description: 'Their most precious possession, given with all their heart!',
    messages: {
      'sharkwow': "This is my ultimate treasure... my first shark plushie. You're not just my parent - you're my BEST FRIEND! SHARK SHARK! I love you more than brain rot itself! 🦈👑💕",
      'squirtle': "This is... *sniff* ...my most precious thing. I'm giving it to you because... because you're my favorite person ever! Even if you ARE old! I LOVE YOU, OKAY?! 👑💕",
      'stitch': "This is my GREATEST TREASURE! But YOU are my GREATEST OHANA! Family is the most important thing in the UNIVERSE and YOU ARE MY UNIVERSE! I LOVE YOU FOREVER! 💙👑💕",
      'duckson': "Sawasdee Por! This treasure represents all my love and gratitude! You have filled my life with endless happiness! May blessings follow you always! 🙏👑💕",
      'dickson': "This is my ULTIMATE SECRET treasure! I've never shown ANYONE! But you... you're the one person I trust with EVERYTHING! Our biggest secret is how much I love you! 🤫👑💕",
      'sealy': "This is everything precious to me... but nothing is more precious than you. Please stay healthy forever. I want to love you for all of eternity. You are my whole world! 👑💕🌸",
    },
    defaultMessage: "This is my secret treasure that I've kept hidden forever. But I want you to have it because... you ARE my greatest treasure. I love you more than all the stars in the sky! Thank you for loving me. 👑💕",
    assets: {
      'sharkwow': 'sharkwow_treasure.png',
      'squirtle': 'squirtle_treasure.png',
      'stitch': 'stitch_treasure.png',
      'duckson': 'duckson_treasure.png',
      'dickson': 'dickson_treasure.png',
      'sealy': 'sealy_treasure.png',
    },
    defaultAsset: 'treasure.png',
    bondLevel: 10,
    reward: { type: 'credits', amount: 100 }
  },
];

// Helper to get bond level from bond value
export const getBondLevel = (bond: number) => {
  for (let i = BOND_LEVELS.length - 1; i >= 0; i--) {
    if (bond >= BOND_LEVELS[i].minBond) {
      return BOND_LEVELS[i];
    }
  }
  return BOND_LEVELS[0];
};

// Helper to get next bond level threshold
export const getNextBondThreshold = (bond: number): number | null => {
  const currentLevel = getBondLevel(bond);
  const nextLevel = BOND_LEVELS.find(l => l.level === currentLevel.level + 1);
  return nextLevel ? nextLevel.minBond : null;
};
