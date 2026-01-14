
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PetState, GameState, PetStage, PetType, ShopItem, JournalEntry, Trophy, MemoryEntry, TerrariumItem, PlacedItem, ClaimedGift } from './types';
import { BondGift } from './constants';
import { INITIAL_GAME_STATE, SHOP_ITEMS, PET_EMOJIS, EXP_PER_LEVEL, MAX_LEVEL, EVOLUTION_TROPHIES, TRIVIA_QUESTIONS, TRIVIA_REWARD, MEMORY_MATCH_CONFIG, MEMORY_MATCH_ENTRY_COST, MEMORY_MATCH_CONTINUE_COST, MEMORY_MATCH_MAX_CONTINUES, TERRARIUM_ITEMS, FEATURE_UNLOCKS, getBondLevel, getNextBondThreshold, BOND_GAINS, BOND_GIFTS, NEGATIVE_STATE_CONFIG, NEGATIVE_STATE_MESSAGES, DEFAULT_NEGATIVE_STATES } from './constants';
import { PetView } from './components/PetView';
import { StatusBar } from './components/StatusBar';
import { Modal } from './components/Modals';
import { HomeScreen } from './components/HomeScreen';
import { GameRoom } from './components/GameRoom';
import { MemoryForm } from './components/MemoryForm';
import { Terrarium } from './components/Terrarium';
import { UnlockModal } from './components/UnlockModal';
import { Gallery } from './components/Gallery';
import { Collectibles } from './components/Collectibles';
import { saveState } from './services/saveState';

const App: React.FC = () => {
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [game, setGame] = useState<GameState>(INITIAL_GAME_STATE);
  const [isPetting, setIsPetting] = useState(false);
  const [isEating, setIsEating] = useState(false);
  const [activeModal, setActiveModal] = useState<'shop' | 'journal' | 'journal_entry' | 'settings' | 'kids' | 'trophies' | 'evolution' | 'games' | 'trivia' | 'memory_match' | 'game_room' | 'terrarium' | 'memory_form' | 'gallery' | 'collectibles' | null>(null);
  const [petMsg, setPetMsg] = useState("Hi Mom and Dad! ❤️");
  const [newMemory, setNewMemory] = useState("");

  // Terrarium unlock state
  const [pendingUnlocks, setPendingUnlocks] = useState<TerrariumItem[]>([]);

  // Bond gift state
  const [pendingGift, setPendingGift] = useState<{ gift: BondGift; pet: PetState } | null>(null);

  const [activeJournalTab, setActiveJournalTab] = useState<'entries' | 'our_story'>('entries');
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [journalNote, setJournalNote] = useState("");
  const [isSavingJournal, setIsSavingJournal] = useState(false);

  // Evolution celebration state
  const [newTrophy, setNewTrophy] = useState<Trophy | null>(null);

  // Trivia state
  const [currentTrivia, setCurrentTrivia] = useState<typeof TRIVIA_QUESTIONS[0] | null>(null);
  const [triviaResult, setTriviaResult] = useState<'correct' | 'wrong' | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Memory match game state
  const [memoryCards, setMemoryCards] = useState<{id: number; imageId: number; flipped: boolean; matched: boolean}[]>([]);
  const [memoryFlipped, setMemoryFlipped] = useState<number[]>([]);
  const [memoryMoves, setMemoryMoves] = useState(0);
  const [memoryMatches, setMemoryMatches] = useState(0);
  const [memoryLives, setMemoryLives] = useState(6);
  const [memoryDifficulty, setMemoryDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [memoryGameOver, setMemoryGameOver] = useState(false);
  const [memoryGameWon, setMemoryGameWon] = useState(false);
  const [memoryContinuesUsed, setMemoryContinuesUsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track when we last logged neglect to avoid spam (one per pet per session)
  const [neglectLoggedFor, setNeglectLoggedFor] = useState<Set<string>>(new Set());

  // Helper to create automatic journal entries
  const createAutoJournalEntry = useCallback((
    petState: PetState,
    milestoneType: 'neglect' | 'feed' | 'play' | 'pet' | 'game_win' | 'level',
    customNote?: string
  ) => {
    const prompts: Record<string, string[]> = {
      neglect: [
        `${petState.name} felt a bit lonely today...`,
        `${petState.name} was wondering where you were...`,
        `${petState.name} missed some quality time today.`,
      ],
      feed: [
        `${petState.name} enjoyed a yummy meal!`,
        `Feeding time with ${petState.name}!`,
        `${petState.name}'s tummy is happy now!`,
      ],
      play: [
        `Playtime fun with ${petState.name}!`,
        `${petState.name} had a blast playing!`,
        `${petState.name} loved the toy time!`,
      ],
      pet: [
        `${petState.name} got some love and cuddles!`,
        `Quality bonding time with ${petState.name}!`,
        `${petState.name} felt so loved today!`,
      ],
      game_win: [
        `${petState.name} won a game together!`,
        `Victory with ${petState.name}!`,
        `${petState.name} is a gaming champion!`,
      ],
      level: [
        `${petState.name} leveled up to ${petState.level + 1}!`,
        `${petState.name} is getting stronger!`,
        `${petState.name} reached a new milestone!`,
      ],
    };

    const notes: Record<string, string[]> = {
      neglect: [
        `Hunger: ${Math.round(petState.hunger)}%, Happiness: ${Math.round(petState.happiness)}%`,
        `Stats were running low. Remember to check in!`,
        `A gentle reminder to spend time together.`,
      ],
      feed: [
        `Fed and feeling great! +25 hunger restored.`,
        `A well-fed kid is a happy kid!`,
        `Nom nom nom! Delicious!`,
      ],
      play: [
        `Played with toys! +30 happiness, +10 EXP!`,
        `Fun times equal happy memories!`,
        `Energy well spent on play!`,
      ],
      pet: [
        `Gentle pets and cuddles! +10 happiness.`,
        `Nothing beats a good snuggle session.`,
        `Love shared is love multiplied!`,
      ],
      game_win: [
        customNote || `Won a game in the Game Room!`,
        `Teamwork makes the dream work!`,
        `Another win in the books!`,
      ],
      level: [
        `Reached level ${petState.level + 1}! Keep growing!`,
        `Experience gained through love and care.`,
        `One step closer to greatness!`,
      ],
    };

    const promptList = prompts[milestoneType] || prompts.pet;
    const noteList = notes[milestoneType] || notes.pet;

    const newEntry: JournalEntry = {
      id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      levelAtEntry: petState.level,
      prompt: promptList[Math.floor(Math.random() * promptList.length)],
      note: customNote || noteList[Math.floor(Math.random() * noteList.length)],
      milestoneType,
      petId: petState.id,
    };

    setGame(prev => ({
      ...prev,
      journal: [newEntry, ...prev.journal]
    }));
  }, []);

  // Home screen handlers
  const handleNewGame = (slotId: number) => {
    setGame(INITIAL_GAME_STATE);
    setActiveSlot(slotId);
    setShowHomeScreen(false);
  };

  const handleLoadGame = (slotId: number) => {
    const savedGame = saveState.load(slotId);
    if (savedGame) {
      setGame(savedGame);
      setActiveSlot(slotId);
      setShowHomeScreen(false);
    }
  };

  // Auto-save whenever game state changes (debounced)
  useEffect(() => {
    if (showHomeScreen || activeSlot === null) return; // Don't save while on home screen or no slot selected

    const saveTimeout = setTimeout(() => {
      saveState.save(game, activeSlot);
    }, 1000); // Debounce saves by 1 second

    return () => clearTimeout(saveTimeout);
  }, [game, showHomeScreen, activeSlot]);

  // Helper to get active pet
  const pet = game.pets.find(p => p.id === game.activePetId) || game.pets[0];

  const updateActivePet = (updater: (prev: PetState) => PetState) => {
    setGame(prev => ({
      ...prev,
      pets: prev.pets.map(p => p.id === prev.activePetId ? updater(p) : p)
    }));
  };

  const handleBondIncrease = (petId: string, amount: number) => {
    setGame(prev => ({
      ...prev,
      pets: prev.pets.map(p =>
        p.id === petId ? { ...p, bond: Math.min(100, p.bond + amount) } : p
      )
    }));
  };

  // Tick logic: Deplete stats over time for all pets (with negative state effects)
  useEffect(() => {
    const timer = setInterval(() => {
      setGame(prev => ({
        ...prev,
        pets: prev.pets.map(p => {
          const states = p.negativeStates || DEFAULT_NEGATIVE_STATES;

          // Calculate decay multiplier (doubled if sick)
          const decayMult = states.sick?.active ? NEGATIVE_STATE_CONFIG.sick.decayMultiplier : 1;

          // Calculate poop happiness penalty
          const poopPenalty = states.poop?.active
            ? (states.poop.count || 1) * NEGATIVE_STATE_CONFIG.poop.happinessPenaltyPerTick
            : 0;

          // Calculate energy with tired recovery boost (0.021/tick base decay for 30/day)
          const energyBoost = states.tired?.active ? NEGATIVE_STATE_CONFIG.tired.energyRecoveryBoost : 0;
          const newEnergy = Math.max(0, Math.min(100, p.energy - (0.021 * decayMult) + energyBoost));

          // Check tired state trigger/recovery
          let newTiredState = states.tired || { active: false, startedAt: null };
          if (newEnergy < NEGATIVE_STATE_CONFIG.tired.energyThreshold && !states.tired?.active) {
            newTiredState = { active: true, startedAt: Date.now() };
          } else if (newEnergy >= NEGATIVE_STATE_CONFIG.tired.recoveryThreshold && states.tired?.active) {
            newTiredState = { active: false, startedAt: null };
          }

          // Daily goal-based decay rates (for 60s tick interval):
          // Hunger: 75/day (3 feeds × 25) = 0.052/tick
          // Happiness: 80/day (8 pets × 10) = 0.056/tick
          // Energy: 30/day (recovered by feeding) = 0.021/tick
          return {
            ...p,
            hunger: Math.max(0, p.hunger - (0.052 * decayMult)),
            happiness: Math.max(0, p.happiness - (0.056 * decayMult) - poopPenalty),
            energy: newEnergy,
            negativeStates: {
              ...states,
              tired: newTiredState,
            },
          };
        })
      }));
    }, 60000); // 60-second tick for daily goal-based decay (1440 ticks/day)
    return () => clearInterval(timer);
  }, []);

  // Neglect detection - log when a pet's stats drop too low
  useEffect(() => {
    const NEGLECT_THRESHOLD = 20;

    game.pets.forEach(p => {
      const isNeglected = p.hunger < NEGLECT_THRESHOLD || p.happiness < NEGLECT_THRESHOLD;
      const alreadyLogged = neglectLoggedFor.has(p.id);

      if (isNeglected && !alreadyLogged) {
        createAutoJournalEntry(p, 'neglect');
        setNeglectLoggedFor(prev => new Set([...prev, p.id]));
        if (p.id === game.activePetId) {
          setPetMsg(`I'm feeling a bit neglected... 😢`);
        }
      }

      // Reset neglect flag when stats recover above 50%
      if (!isNeglected && p.hunger > 50 && p.happiness > 50 && alreadyLogged) {
        setNeglectLoggedFor(prev => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        });
      }
    });
  }, [game.pets, game.activePetId, neglectLoggedFor, createAutoJournalEntry]);

  // Sick state detection and recovery
  useEffect(() => {
    const interval = setInterval(() => {
      setGame(prev => ({
        ...prev,
        pets: prev.pets.map(p => {
          const states = p.negativeStates || DEFAULT_NEGATIVE_STATES;
          const isLowStats = p.hunger < NEGATIVE_STATE_CONFIG.sick.statThreshold ||
                             p.happiness < NEGATIVE_STATE_CONFIG.sick.statThreshold;

          // If already sick and medicine given, check for recovery
          if (states.sick?.active && states.sick?.medicineGivenAt) {
            const timeSinceMedicine = (Date.now() - states.sick.medicineGivenAt) / 1000;
            if (timeSinceMedicine >= NEGATIVE_STATE_CONFIG.sick.recoveryTime) {
              // Recovered!
              if (p.id === prev.activePetId) {
                const msgs = NEGATIVE_STATE_MESSAGES.sick.recovered;
                setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
              }
              return {
                ...p,
                negativeStates: {
                  ...states,
                  sick: { active: false, startedAt: null, medicineGivenAt: null, lowStatDuration: 0 },
                },
              };
            }
            return p; // Still recovering, no changes
          }

          // If not sick, track low stat duration
          if (!states.sick?.active) {
            if (isLowStats) {
              const newDuration = (states.sick?.lowStatDuration || 0) + 1;
              if (newDuration >= NEGATIVE_STATE_CONFIG.sick.durationToTrigger) {
                // Trigger sickness!
                if (p.id === prev.activePetId) {
                  const msgs = NEGATIVE_STATE_MESSAGES.sick.trigger;
                  setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
                }
                return {
                  ...p,
                  negativeStates: {
                    ...states,
                    sick: { active: true, startedAt: Date.now(), medicineGivenAt: null, lowStatDuration: 0 },
                  },
                };
              } else {
                // Just increment duration
                return {
                  ...p,
                  negativeStates: {
                    ...states,
                    sick: { ...states.sick, lowStatDuration: newDuration },
                  },
                };
              }
            } else if ((states.sick?.lowStatDuration || 0) > 0) {
              // Reset duration if stats are okay
              return {
                ...p,
                negativeStates: {
                  ...states,
                  sick: { ...states.sick, lowStatDuration: 0 },
                },
              };
            }
          }

          return p;
        })
      }));
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Level Up Logic
  useEffect(() => {
    // Don't level up if already at max
    if (pet.level >= MAX_LEVEL) return;

    if (pet.exp >= pet.maxExp) {
      const nextLevel = pet.level + 1;
      let nextStage = pet.stage;
      let evolving = false;

      // Evolution at level 5 (Teenager) and level 10 (Adult)
      if (nextLevel === 5) {
        nextStage = PetStage.TEENAGER;
        evolving = true;
      }
      if (nextLevel === 10) {
        nextStage = PetStage.ADULT;
        evolving = true;
      }

      // Calculate next maxExp (0 if at max level)
      const nextMaxExp = nextLevel >= MAX_LEVEL ? pet.maxExp : EXP_PER_LEVEL[nextLevel];

      updateActivePet(prev => ({
        ...prev,
        level: nextLevel,
        exp: nextLevel >= MAX_LEVEL ? 0 : prev.exp - prev.maxExp,
        maxExp: nextMaxExp,
        stage: nextStage
      }));

      // Log level-up to journal
      const levelUpEntry: JournalEntry = {
        id: `level-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        levelAtEntry: nextLevel,
        prompt: evolving
          ? `${pet.name} evolved into a ${nextStage}! 🎊`
          : `${pet.name} reached level ${nextLevel}! 🌟`,
        note: evolving
          ? `A major milestone! ${pet.name} has grown from ${pet.stage} to ${nextStage}. So proud!`
          : `Through love and care, ${pet.name} gained enough experience to reach level ${nextLevel}!`,
        milestoneType: evolving ? 'evolution' : 'level',
        petId: pet.id,
      };

      setGame(prev => ({
        ...prev,
        journal: [levelUpEntry, ...prev.journal]
      }));

      // Award trophy on evolution
      if (evolving) {
        const trophyType = nextLevel === 5 ? 'teenager' : 'adult';
        const trophyDef = EVOLUTION_TROPHIES[trophyType];

        const trophy: Trophy = {
          id: `${pet.id}-${trophyType}-${Date.now()}`,
          name: `${pet.name}: ${trophyDef.name}`,
          description: trophyDef.description,
          icon: trophyDef.icon,
          unlockedAt: Date.now(),
          petId: pet.id,
          petName: pet.name,
        };

        setGame(prev => ({
          ...prev,
          trophies: [...prev.trophies, trophy]
        }));

        setNewTrophy(trophy);
        setActiveModal('evolution');
        setPetMsg(`WOW! I evolved into a ${nextStage}! 🎉`);
      } else {
        setPetMsg(`Yay! I leveled up to level ${nextLevel}! 🌟`);
      }
    }
  }, [pet.exp, pet.maxExp, pet.level, pet.id, pet.name, pet.stage]);

  const triggerJournalEntry = (milestone: string) => {
    setCurrentPrompt(`${pet.name} just ${milestone}! What would you like to remember about this moment?`);
    setActiveModal('journal_entry');
  };

  const saveJournalEntry = () => {
    if (!journalNote.trim()) return;
    setIsSavingJournal(true);
    
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      levelAtEntry: pet.level,
      prompt: currentPrompt,
      note: journalNote,
      milestoneType: 'level',
      petId: pet.id
    };

    setGame(prev => ({
      ...prev,
      journal: [newEntry, ...prev.journal]
    }));
    
    setJournalNote("");
    setIsSavingJournal(false);
    setActiveModal('journal');
    setActiveJournalTab('entries');
  };

  const handleAction = useCallback((type: 'feed' | 'pet' | 'play') => {
    const states = pet.negativeStates || DEFAULT_NEGATIVE_STATES;

    switch (type) {
      case 'feed':
        if (game.inventory.food > 0) {
          // Check if overfeeding (hunger > threshold)
          const willTriggerPoop = pet.hunger > NEGATIVE_STATE_CONFIG.poop.hungerThreshold;

          setIsEating(true);
          setTimeout(() => setIsEating(false), 2000);

          updateActivePet(prev => {
            const prevStates = prev.negativeStates || DEFAULT_NEGATIVE_STATES;
            let newState: PetState = {
              ...prev,
              hunger: Math.min(100, prev.hunger + 25),
              energy: Math.min(100, prev.energy + 10), // Feeding restores energy
              exp: prev.exp + 5,
            };

            if (willTriggerPoop) {
              const newPoopCount = Math.min(
                (prevStates.poop?.count || 0) + 1,
                NEGATIVE_STATE_CONFIG.poop.maxPoopCount
              );
              newState = {
                ...newState,
                negativeStates: {
                  ...prevStates,
                  poop: {
                    active: true,
                    count: newPoopCount,
                    lastTriggeredAt: Date.now(),
                  },
                },
              };
            }
            return newState;
          });

          if (willTriggerPoop) {
            const msgs = NEGATIVE_STATE_MESSAGES.poop.trigger;
            setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
          }

          setGame(prev => ({ ...prev, inventory: { ...prev.inventory, food: prev.inventory.food - 1 } }));
          createAutoJournalEntry(pet, 'feed');
        }
        break;

      case 'pet':
        setIsPetting(true);
        setTimeout(() => setIsPetting(false), 2000);
        updateActivePet(prev => ({
          ...prev,
          happiness: Math.min(100, prev.happiness + 10),
          exp: prev.exp + 2,
          bond: Math.min(100, prev.bond + BOND_GAINS.pet) // +2 bond for petting
        }));
        createAutoJournalEntry(pet, 'pet');
        break;

      case 'play':
        // Block if tired
        if (states.tired?.active) {
          const msgs = NEGATIVE_STATE_MESSAGES.tired.blocked;
          setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
          return;
        }
        // Block if misbehaving
        if (states.misbehaving?.active) {
          const msgs = NEGATIVE_STATE_MESSAGES.misbehaving.blocked;
          setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
          return;
        }

        if (game.inventory.toys > 0) {
          const now = Date.now();
          const lastPlay = states.misbehaving?.lastPlayAt;
          const isInWindow = lastPlay && (now - lastPlay) < NEGATIVE_STATE_CONFIG.misbehaving.playWindowSeconds * 1000;
          const recentPlays = isInWindow ? (states.misbehaving?.overplayCount || 0) : 0;

          // Check misbehaving triggers
          const wouldOverplay = recentPlays >= NEGATIVE_STATE_CONFIG.misbehaving.maxPlaysInWindow;
          const tooHappy = pet.happiness > NEGATIVE_STATE_CONFIG.misbehaving.happinessThreshold;
          const willMisbehave = wouldOverplay || tooHappy;

          updateActivePet(prev => {
            const prevStates = prev.negativeStates || DEFAULT_NEGATIVE_STATES;
            let newState: PetState = {
              ...prev,
              happiness: Math.min(100, prev.happiness + 30),
              energy: Math.max(0, prev.energy - 15), // Playing games costs more energy
              exp: prev.exp + 10,
              bond: Math.min(100, prev.bond + BOND_GAINS.play),
              negativeStates: {
                ...prevStates,
                misbehaving: {
                  ...prevStates.misbehaving,
                  overplayCount: isInWindow ? (prevStates.misbehaving?.overplayCount || 0) + 1 : 1,
                  lastPlayAt: now,
                  active: willMisbehave ? true : prevStates.misbehaving?.active || false,
                  startedAt: willMisbehave ? now : prevStates.misbehaving?.startedAt || null,
                },
              },
            };
            return newState;
          });

          if (willMisbehave) {
            const msgs = NEGATIVE_STATE_MESSAGES.misbehaving.trigger;
            setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
          }

          setGame(prev => ({ ...prev, inventory: { ...prev.inventory, toys: prev.inventory.toys - 1 } }));
          createAutoJournalEntry(pet, 'play');
        }
        break;
    }
  }, [game.inventory, game.activePetId, pet, createAutoJournalEntry]);

  // Resolution handlers for negative states
  const handleClean = useCallback(() => {
    const states = pet.negativeStates || DEFAULT_NEGATIVE_STATES;
    if (!states.poop?.active) return;

    updateActivePet(prev => ({
      ...prev,
      exp: prev.exp + NEGATIVE_STATE_CONFIG.poop.cleanExpReward,
      negativeStates: {
        ...(prev.negativeStates || DEFAULT_NEGATIVE_STATES),
        poop: { active: false, count: 0, lastTriggeredAt: null },
      },
    }));

    const msgs = NEGATIVE_STATE_MESSAGES.poop.clean;
    setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [pet]);

  const handleGiveMedicine = useCallback(() => {
    const states = pet.negativeStates || DEFAULT_NEGATIVE_STATES;
    if (!states.sick?.active || game.inventory.medicine <= 0) return;
    if (states.sick?.medicineGivenAt) return; // Already given medicine

    updateActivePet(prev => ({
      ...prev,
      exp: prev.exp + NEGATIVE_STATE_CONFIG.sick.medicineExpReward,
      negativeStates: {
        ...(prev.negativeStates || DEFAULT_NEGATIVE_STATES),
        sick: {
          ...(prev.negativeStates?.sick || {}),
          active: true,
          medicineGivenAt: Date.now(),
        },
      },
    }));

    setGame(prev => ({
      ...prev,
      inventory: { ...prev.inventory, medicine: prev.inventory.medicine - 1 },
    }));

    const msgs = NEGATIVE_STATE_MESSAGES.sick.medicine;
    setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [pet, game.inventory.medicine]);

  const handleScold = useCallback(() => {
    const states = pet.negativeStates || DEFAULT_NEGATIVE_STATES;
    if (!states.misbehaving?.active) return;

    updateActivePet(prev => ({
      ...prev,
      happiness: Math.max(0, prev.happiness - NEGATIVE_STATE_CONFIG.misbehaving.scoldHappinessCost),
      exp: prev.exp + NEGATIVE_STATE_CONFIG.misbehaving.scoldExpReward,
      bond: Math.min(100, prev.bond + NEGATIVE_STATE_CONFIG.misbehaving.scoldBondGain),
      negativeStates: {
        ...(prev.negativeStates || DEFAULT_NEGATIVE_STATES),
        misbehaving: { active: false, startedAt: null, overplayCount: 0, lastPlayAt: null },
      },
    }));

    const msgs = NEGATIVE_STATE_MESSAGES.misbehaving.scold;
    setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [pet]);

  const handleRest = useCallback(() => {
    const states = pet.negativeStates || DEFAULT_NEGATIVE_STATES;
    if (!states.tired?.active) return;

    updateActivePet(prev => ({
      ...prev,
      energy: Math.min(100, prev.energy + NEGATIVE_STATE_CONFIG.tired.restEnergyBoost),
      exp: prev.exp + NEGATIVE_STATE_CONFIG.tired.restExpReward,
    }));

    const msgs = NEGATIVE_STATE_MESSAGES.tired.resting;
    setPetMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [pet]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    // Legacy memory support - convert string to MemoryEntry
    const newEntry: MemoryEntry = {
      id: Date.now().toString(),
      title: newMemory.trim().substring(0, 50),
      content: newMemory.trim(),
      timestamp: Date.now(),
      memoryNumber: game.totalMemoryCount + 1,
    };
    handleSaveMemory(newEntry);
    setNewMemory("");
  };

  // Terrarium memory handlers
  const handleSaveMemory = (memoryData: Omit<MemoryEntry, 'id' | 'memoryNumber'>) => {
    const newMemoryCount = game.totalMemoryCount + 1;

    const newEntry: MemoryEntry = {
      ...memoryData,
      id: Date.now().toString(),
      memoryNumber: newMemoryCount,
    };

    // Find items to unlock at this memory count
    const newUnlocks = TERRARIUM_ITEMS.filter(
      (item) =>
        item.unlockedAt === newMemoryCount &&
        !game.terrarium.unlockedItems.includes(item.id)
    );

    setGame((prev) => ({
      ...prev,
      memories: [newEntry, ...prev.memories],
      totalMemoryCount: newMemoryCount,
      terrarium: {
        ...prev.terrarium,
        unlockedItems: [
          ...prev.terrarium.unlockedItems,
          ...newUnlocks.map((item) => item.id),
        ],
      },
    }));

    // Show unlock modal if there are new items
    if (newUnlocks.length > 0) {
      setPendingUnlocks(newUnlocks);
      setActiveModal(null); // Close memory form first
      // Small delay to let the form close before showing unlock
      setTimeout(() => {
        setPetMsg(`Wow! Memory #${newMemoryCount}! I got something new! 🎁`);
      }, 100);
    } else {
      setActiveModal(null);
      setPetMsg(`Memory #${newMemoryCount} saved! 💕`);
    }
  };

  const handlePlaceItems = (placedItems: PlacedItem[]) => {
    setGame((prev) => ({
      ...prev,
      terrarium: {
        ...prev.terrarium,
        placedItems,
      },
    }));
  };

  const handleUnlockModalClose = () => {
    setPendingUnlocks([]);
  };

  const handleOpenTerrariumFromUnlock = () => {
    setPendingUnlocks([]);
    setActiveModal('terrarium');
  };

  // Check for unclaimed gifts when bond changes
  const checkForNewGifts = useCallback((petState: PetState) => {
    const bondLevel = getBondLevel(petState.bond);
    const availableGifts = BOND_GIFTS.filter(
      g => g.bondLevel <= bondLevel.level &&
           !game.claimedGifts.some(cg => cg.giftId === g.id && cg.petId === petState.id)
    );

    if (availableGifts.length > 0 && !pendingGift) {
      // Show the first unclaimed gift
      setPendingGift({ gift: availableGifts[0], pet: petState });
    }
  }, [game.claimedGifts, pendingGift]);

  // Claim a gift
  const claimGift = useCallback((gift: BondGift, petId: string) => {
    // Add to claimed gifts
    const newClaim: ClaimedGift = {
      giftId: gift.id,
      petId,
      claimedAt: Date.now(),
    };

    // Apply reward
    setGame(prev => {
      let newState = {
        ...prev,
        claimedGifts: [...prev.claimedGifts, newClaim],
      };

      if (gift.reward) {
        switch (gift.reward.type) {
          case 'credits':
            newState.credits += gift.reward.amount;
            break;
          case 'food':
            newState.inventory = { ...newState.inventory, food: newState.inventory.food + gift.reward.amount };
            break;
          case 'toys':
            newState.inventory = { ...newState.inventory, toys: newState.inventory.toys + gift.reward.amount };
            break;
          case 'exp':
            newState.pets = newState.pets.map(p =>
              p.id === petId ? { ...p, exp: p.exp + gift.reward!.amount } : p
            );
            break;
        }
      }

      return newState;
    });

    setPendingGift(null);

    // Check for more gifts
    const pet = game.pets.find(p => p.id === petId);
    if (pet) {
      setTimeout(() => checkForNewGifts(pet), 500);
    }
  }, [game.pets, checkForNewGifts]);

  // Check for gifts when active pet's bond changes
  useEffect(() => {
    if (pet && pet.bond > 0) {
      checkForNewGifts(pet);
    }
  }, [pet?.bond, pet?.id, checkForNewGifts]);

  // Check if gallery is unlocked
  const isGalleryUnlocked = game.totalMemoryCount >= FEATURE_UNLOCKS.gallery;

  const buyItem = (item: ShopItem) => {
    if (game.credits >= item.cost) {
      setGame(prev => ({
        ...prev,
        credits: prev.credits - item.cost,
        inventory: {
          ...prev.inventory,
          food: item.type === 'food' ? prev.inventory.food + 1 : prev.inventory.food,
          treats: item.type === 'treat' ? prev.inventory.treats + 1 : prev.inventory.treats,
          toys: item.type === 'toy' ? prev.inventory.toys + 1 : prev.inventory.toys,
          medicine: item.type === 'medicine' ? prev.inventory.medicine + 1 : prev.inventory.medicine,
        }
      }));
      if (item.type === 'exp') updateActivePet(prev => ({ ...prev, exp: prev.exp + item.value }));
    } else alert("Not enough credits!");
  };

  // Trivia functions
  const startTrivia = () => {
    const unanswered = TRIVIA_QUESTIONS.filter(q => !game.answeredTrivia.includes(q.id));
    if (unanswered.length === 0) {
      // Reset if all answered
      setGame(prev => ({ ...prev, answeredTrivia: [] }));
      const randomQ = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
      setCurrentTrivia(randomQ);
    } else {
      const randomQ = unanswered[Math.floor(Math.random() * unanswered.length)];
      setCurrentTrivia(randomQ);
    }
    setTriviaResult(null);
    setSelectedAnswer(null);
    setActiveModal('trivia');
  };

  const answerTrivia = (answerIndex: number) => {
    if (!currentTrivia || selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);

    if (answerIndex === currentTrivia.correctIndex) {
      setTriviaResult('correct');
      setGame(prev => ({
        ...prev,
        credits: prev.credits + TRIVIA_REWARD,
        answeredTrivia: [...prev.answeredTrivia, currentTrivia.id]
      }));
    } else {
      setTriviaResult('wrong');
      setGame(prev => ({
        ...prev,
        answeredTrivia: [...prev.answeredTrivia, currentTrivia.id]
      }));
    }
  };

  // Memory Match - image file names (add images to /assets/memory-match/)
  // Name your files: 1.png, 2.png, 3.png, ...
  const MEMORY_IMAGES = Array.from({ length: 61 }, (_, i) => i + 1);

  const openMemorySelect = () => {
    setMemoryDifficulty(null);
    setActiveModal('memory_match');
  };

  const startMemoryGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (game.credits < MEMORY_MATCH_ENTRY_COST) {
      alert("Not enough credits to play!");
      return;
    }

    // Deduct entry cost
    setGame(prev => ({ ...prev, credits: prev.credits - MEMORY_MATCH_ENTRY_COST }));

    const config = MEMORY_MATCH_CONFIG[difficulty];
    const numPairs = config.pairs;

    // Select random images for the pairs needed
    const shuffledImages = [...MEMORY_IMAGES].sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, numPairs);

    // Create pairs and shuffle
    const pairs = [...selectedImages, ...selectedImages];
    const shuffled = pairs.sort(() => Math.random() - 0.5).map((imageId, idx) => ({
      id: idx,
      imageId,
      flipped: false,
      matched: false
    }));

    setMemoryCards(shuffled);
    setMemoryFlipped([]);
    setMemoryMoves(0);
    setMemoryMatches(0);
    setMemoryLives(config.lives);
    setMemoryDifficulty(difficulty);
    setMemoryGameOver(false);
    setMemoryGameWon(false);
    setMemoryContinuesUsed(0);
  };

  const buyMemoryContinue = () => {
    if (game.credits < MEMORY_MATCH_CONTINUE_COST || memoryContinuesUsed >= MEMORY_MATCH_MAX_CONTINUES) return;

    setGame(prev => ({ ...prev, credits: prev.credits - MEMORY_MATCH_CONTINUE_COST }));
    setMemoryLives(1);
    setMemoryGameOver(false);
    setMemoryContinuesUsed(prev => prev + 1);
  };

  const flipCard = (cardId: number) => {
    if (memoryFlipped.length === 2 || memoryGameOver || memoryGameWon || !memoryDifficulty) return;
    const card = memoryCards.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;

    const newCards = memoryCards.map(c =>
      c.id === cardId ? { ...c, flipped: true } : c
    );
    setMemoryCards(newCards);
    const newFlipped = [...memoryFlipped, cardId];
    setMemoryFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMemoryMoves(prev => prev + 1);
      const [first, second] = newFlipped;
      const firstCard = newCards.find(c => c.id === first);
      const secondCard = newCards.find(c => c.id === second);

      if (firstCard?.imageId === secondCard?.imageId) {
        // Match found
        setTimeout(() => {
          setMemoryCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, matched: true } : c
          ));
          setMemoryFlipped([]);
          setMemoryMatches(prev => {
            const newMatches = prev + 1;
            const config = MEMORY_MATCH_CONFIG[memoryDifficulty];
            if (newMatches === config.pairs) {
              setMemoryGameWon(true);
              // Award credits based on difficulty
              setGame(g => ({
                ...g,
                credits: g.credits + config.reward,
                highScores: {
                  ...g.highScores,
                  memoryMatch: Math.max(g.highScores.memoryMatch, config.reward)
                }
              }));
            }
            return newMatches;
          });
        }, 500);
      } else {
        // No match - lose a life
        setTimeout(() => {
          setMemoryCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, flipped: false } : c
          ));
          setMemoryFlipped([]);
          setMemoryLives(prev => {
            const newLives = prev - 1;
            if (newLives === 0) {
              setMemoryGameOver(true);
            }
            return newLives;
          });
        }, 1000);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateActivePet(prev => ({ ...prev, customImageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Simple pet messages based on mood
  useEffect(() => {
    const messages = {
      happy: ["I love you! ❤️", "Best day ever! 🌟", "You're the best! 💕"],
      hungry: ["I'm getting hungry... 🍽️", "Feed me please? 🥺", "Snack time? 🍪"],
      normal: ["Hi Mom and Dad! 👋", "Let's play! 🎮", "I'm so happy to see you! 💖"]
    };
    const mood = pet.happiness > 70 ? 'happy' : pet.hunger < 30 ? 'hungry' : 'normal';
    const options = messages[mood];
    setPetMsg(options[Math.floor(Math.random() * options.length)]);
  }, [pet.id, pet.stage]);

  // Show home screen if not in game
  if (showHomeScreen) {
    return (
      <HomeScreen
        onNewGame={handleNewGame}
        onLoadGame={handleLoadGame}
      />
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center bg-gradient-to-b from-blue-50 to-white overflow-hidden p-4">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

      {/* Header */}
      <header className="w-full max-w-lg flex justify-between items-center py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHomeScreen(true)}
            className="p-2 bg-white/80 backdrop-blur rounded-xl shadow-sm border border-blue-100 hover:bg-blue-50 active:scale-95 transition-all"
            title="Return to Home"
          >
            <span className="text-lg">🏠</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-brand text-blue-600 drop-shadow-sm">BBGotchi</h1>
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Our Little World</p>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-2">
          <span className="text-xl">💎</span>
          <span className="font-bold text-gray-700">{game.credits}</span>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-lg flex flex-col items-center justify-center relative">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="mb-8 relative">
            <div className="bg-white p-4 rounded-3xl shadow-xl border border-blue-50 text-gray-700 font-medium text-center max-w-xs animate-bounce-slow">
              {petMsg}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-blue-50 rotate-45" />
            </div>
          </div>

          <PetView
            type={pet.type}
            stage={pet.stage}
            isPetting={isPetting}
            isEating={isEating}
            customImageUrl={pet.customImageUrl}
            negativeStates={pet.negativeStates}
          />
          
          <div className="mt-12 text-center">
            <h2 className="text-4xl font-brand text-gray-800 drop-shadow-sm">{pet.name}</h2>
            <div className="flex items-center justify-center gap-3 text-blue-500 font-black mt-2 bg-blue-50 px-4 py-1 rounded-full border border-blue-100">
              <span>LEVEL {pet.level}</span>
              <span className="text-blue-200">|</span>
              <span className="uppercase">{pet.stage}</span>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="w-full grid grid-cols-2 gap-x-4 p-5 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-lg mb-24">
          <StatusBar label="Hunger" value={pet.hunger} color="bg-orange-400" icon="🍖" />
          <StatusBar label="Happy" value={pet.happiness} color="bg-pink-400" icon="🍭" />
          <div className="col-span-2">
             <StatusBar label="EXP" value={(pet.exp / pet.maxExp) * 100} color="bg-indigo-500" icon="⭐" />
          </div>
          {/* Bond Meter */}
          <div className="col-span-2 mt-2">
            {(() => {
              const bondValue = pet.bond ?? 0;
              const bondLevelInfo = getBondLevel(bondValue);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bondLevelInfo.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-pink-600">{bondLevelInfo.name}</span>
                      <span className="text-[10px] text-gray-400">Lv.{bondLevelInfo.level} • {bondValue}/100</span>
                    </div>
                    <div className="h-2 bg-pink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-400 to-red-400 rounded-full transition-all duration-500"
                        style={{ width: `${bondValue}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Navigation Bar - Scrollable */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] rounded-full p-2 border border-white/50">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-1">
            {/* Actions */}
            <button
              onClick={() => handleAction('feed')}
              disabled={game.inventory.food === 0}
              className={`snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 rounded-2xl transition-all ${game.inventory.food > 0 ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-300 opacity-50'}`}
            >
              <span className="text-xl">🍙</span>
              <span className="text-[9px] font-bold uppercase">{game.inventory.food}</span>
            </button>
            <button
              onClick={() => handleAction('pet')}
              className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-pink-500 hover:bg-pink-50 rounded-2xl transition-all"
            >
              <span className="text-xl">👋</span>
              <span className="text-[9px] font-bold uppercase">Pet</span>
            </button>
            <button
              onClick={() => handleAction('play')}
              disabled={game.inventory.toys === 0 || pet.negativeStates?.tired?.active || pet.negativeStates?.misbehaving?.active}
              className={`snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 rounded-2xl transition-all ${
                game.inventory.toys > 0 && !pet.negativeStates?.tired?.active && !pet.negativeStates?.misbehaving?.active
                  ? 'text-indigo-500 hover:bg-indigo-50'
                  : 'text-gray-300 opacity-50'
              }`}
            >
              <span className="text-xl">🎯</span>
              <span className="text-[9px] font-bold uppercase">{game.inventory.toys}</span>
            </button>

            {/* Negative State Action Buttons - Only show when relevant */}
            {pet.negativeStates?.poop?.active && (
              <button
                onClick={handleClean}
                className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-amber-500 hover:bg-amber-50 rounded-2xl transition-all animate-pulse"
              >
                <span className="text-xl">🧹</span>
                <span className="text-[9px] font-bold uppercase">Clean</span>
              </button>
            )}

            {pet.negativeStates?.sick?.active && !pet.negativeStates?.sick?.medicineGivenAt && (
              <button
                onClick={handleGiveMedicine}
                disabled={game.inventory.medicine === 0}
                className={`snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 rounded-2xl transition-all ${
                  game.inventory.medicine > 0
                    ? 'text-red-500 hover:bg-red-50 animate-pulse'
                    : 'text-gray-300 opacity-50'
                }`}
              >
                <span className="text-xl">💊</span>
                <span className="text-[9px] font-bold uppercase">{game.inventory.medicine}</span>
              </button>
            )}

            {pet.negativeStates?.misbehaving?.active && (
              <button
                onClick={handleScold}
                className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-purple-500 hover:bg-purple-50 rounded-2xl transition-all animate-pulse"
              >
                <span className="text-xl">😤</span>
                <span className="text-[9px] font-bold uppercase">Scold</span>
              </button>
            )}

            {pet.negativeStates?.tired?.active && (
              <button
                onClick={handleRest}
                className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
              >
                <span className="text-xl">😴</span>
                <span className="text-[9px] font-bold uppercase">Rest</span>
              </button>
            )}

            {/* Divider */}
            <div className="shrink-0 w-px bg-gray-200 my-1"></div>

            {/* Menu Items */}
            <button onClick={() => setActiveModal('shop')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
              <span className="text-xl">🛒</span>
              <span className="text-[9px] font-bold uppercase">Shop</span>
            </button>
            <button onClick={() => setActiveModal('games')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all">
              <span className="text-xl">🎮</span>
              <span className="text-[9px] font-bold uppercase">Games</span>
            </button>
            <button onClick={() => setActiveModal('trophies')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-2xl transition-all relative">
              <span className="text-xl">🏆</span>
              <span className="text-[9px] font-bold uppercase">Trophies</span>
              {game.trophies.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">{game.trophies.length}</span>
              )}
            </button>
            <button onClick={() => setActiveModal('collectibles')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all relative">
              <span className="text-xl">🎁</span>
              <span className="text-[9px] font-bold uppercase">Gifts</span>
              {game.claimedGifts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-400 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">{game.claimedGifts.length}</span>
              )}
            </button>
            <button onClick={() => setActiveModal('terrarium')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all relative">
              <span className="text-xl">🌸</span>
              <span className="text-[9px] font-bold uppercase">Garden</span>
              {game.totalMemoryCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-400 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">{game.terrarium.unlockedItems.length}</span>
              )}
            </button>
            <button onClick={() => setActiveModal('journal')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all">
              <span className="text-xl">📖</span>
              <span className="text-[9px] font-bold uppercase">Journal</span>
            </button>
            <button onClick={() => setActiveModal('kids')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-2xl transition-all">
              <span className="text-xl">👨‍👩‍👧‍👦</span>
              <span className="text-[9px] font-bold uppercase">Kids</span>
            </button>
            {isGalleryUnlocked && (
              <button onClick={() => setActiveModal('gallery')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-2xl transition-all relative">
                <span className="text-xl">📷</span>
                <span className="text-[9px] font-bold uppercase">Gallery</span>
                {game.memories.filter(m => m.photoUrl).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-400 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">{game.memories.filter(m => m.photoUrl).length}</span>
                )}
              </button>
            )}
            <button onClick={() => setActiveModal('settings')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all">
              <span className="text-xl">⚙️</span>
              <span className="text-[9px] font-bold uppercase">Settings</span>
            </button>
          </div>
        </nav>
      </main>

      {/* KIDS SELECTION MODAL */}
      <Modal isOpen={activeModal === 'kids'} onClose={() => setActiveModal(null)} title="Our Kids">
        <div className="space-y-3">
          {game.pets.map(p => {
            const bondValue = p.bond ?? 0;
            const bondLevel = getBondLevel(bondValue);
            const nextThreshold = getNextBondThreshold(bondValue);
            const pendingGifts = BOND_GIFTS.filter(
              g => g.bondLevel <= bondLevel.level && !game.claimedGifts.some(cg => cg.giftId === g.id && cg.petId === p.id)
            );

            return (
              <button
                key={p.id}
                onClick={() => { setGame(prev => ({ ...prev, activePetId: p.id })); setActiveModal(null); }}
                className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left ${game.activePetId === p.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-gray-100 flex items-center justify-center">
                    <span className="text-3xl">{PET_EMOJIS[p.type] || '👶'}</span>
                  </div>
                  {pendingGifts.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold animate-pulse">
                      🎁
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{p.name}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase bg-gray-100 px-2 py-0.5 rounded-full">Lvl {p.level}</span>
                  </div>

                  {/* EXP Bar */}
                  <div className="mt-2">
                    <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all"
                        style={{ width: `${(p.exp / p.maxExp) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.exp}/{p.maxExp} EXP</p>
                  </div>

                  {/* Bond Level Badge */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700 border border-pink-200">
                      <span>{bondLevel?.emoji || '👶'}</span>
                      <span>{bondLevel?.name || 'Kid'}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">Bond: {bondValue}</span>
                  </div>
                </div>

                {/* Active indicator */}
                {game.activePetId === p.id && (
                  <div className="text-blue-500 text-xs font-bold">ACTIVE</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Gift hint */}
        <div className="mt-4 p-3 bg-pink-50 rounded-2xl border border-pink-100 text-center">
          <p className="text-xs text-pink-600">
            💕 Spend time with your kids to increase your bond! Higher bond = more gifts!
          </p>
        </div>
      </Modal>

      {/* SHOP MODAL */}
      <Modal isOpen={activeModal === 'shop'} onClose={() => setActiveModal(null)} title="The Love Shop">
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-3xl mb-4 border border-blue-100">
            <span className="font-bold text-blue-600">Your Credits</span>
            <span className="text-2xl font-black">💎 {game.credits}</span>
          </div>
          {SHOP_ITEMS.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-[2rem] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{item.type === 'food' ? '🍗' : item.type === 'treat' ? '🍰' : item.type === 'toy' ? '🧸' : item.type === 'medicine' ? '💊' : '🧪'}</div>
                <div>
                  <h3 className="font-bold text-gray-800">{item.name}</h3>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </div>
              <button onClick={() => buyItem(item)} className="bg-blue-600 text-white px-5 py-2 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-1 shadow-md active:scale-95">
                <span>{item.cost}</span>
                <span>💎</span>
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* TROPHIES MODAL */}
      <Modal isOpen={activeModal === 'trophies'} onClose={() => setActiveModal(null)} title="Trophy Case">
        {game.trophies.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-6xl block mb-6">🏆</span>
            <p className="text-gray-400 font-bold">No trophies yet!</p>
            <p className="text-xs text-gray-300 mt-2">Raise your kids to level 5 and 10 to unlock evolution trophies.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {game.trophies.map(trophy => (
              <div key={trophy.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-3xl">
                <span className="text-4xl">{trophy.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{trophy.name}</h3>
                  <p className="text-xs text-gray-500">{trophy.description}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(trophy.unlockedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* EVOLUTION CELEBRATION MODAL */}
      <Modal isOpen={activeModal === 'evolution'} onClose={() => { setActiveModal(null); setNewTrophy(null); }} title="Evolution!">
        {newTrophy && (
          <div className="text-center py-8 space-y-6">
            <div className="text-8xl animate-bounce">{newTrophy.icon}</div>
            <div>
              <h3 className="text-2xl font-brand text-gray-800">{newTrophy.name}</h3>
              <p className="text-gray-500 mt-2">{newTrophy.description}</p>
            </div>
            <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-3xl border border-yellow-200">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-widest">Trophy Unlocked!</p>
            </div>
            <button
              onClick={() => { setActiveModal(null); setNewTrophy(null); }}
              className="w-full bg-blue-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              Awesome! 🎉
            </button>
          </div>
        )}
      </Modal>

      {/* JOURNAL MODAL */}
      <Modal isOpen={activeModal === 'journal'} onClose={() => setActiveModal(null)} title="Memory Journal">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-[2rem] mb-6">
          <button onClick={() => setActiveJournalTab('entries')}
            className={`flex-1 py-3 rounded-[1.8rem] font-bold text-xs uppercase tracking-wider transition-all ${activeJournalTab === 'entries' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
            Kid Journal
          </button>
          <button onClick={() => setActiveJournalTab('our_story')}
            className={`flex-1 py-3 rounded-[1.8rem] font-bold text-xs uppercase tracking-wider transition-all ${activeJournalTab === 'our_story' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>
            Our Story
          </button>
        </div>

        {activeJournalTab === 'entries' ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {game.journal.filter(e => e.petId === game.activePetId).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                <span className="text-5xl block mb-4">📖</span>
                <p className="text-gray-400 font-bold px-8 leading-relaxed">No memories logged for {pet.name} yet. Keep raising them to unlock journal prompts!</p>
              </div>
            ) : (
              game.journal.filter(e => e.petId === game.activePetId).map(entry => (
                <div key={entry.id} className="p-6 rounded-[2rem] bg-white border border-blue-50 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">LVL {entry.levelAtEntry} Milestone</span>
                    <span className="text-[10px] text-gray-300 font-bold">{new Date(entry.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs italic text-blue-300 mb-3 font-medium">Q: {entry.prompt}</p>
                  <p className="text-gray-700 font-bold text-md leading-relaxed">"{entry.note}"</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Quick memory note</label>
              <textarea value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="E.g. We both love eating tacos on rainy Sundays..."
                className="w-full p-6 rounded-[2rem] border border-blue-100 focus:ring-4 focus:ring-blue-100 outline-none min-h-[100px] text-gray-700 shadow-inner bg-gray-50 font-medium" />
              <button onClick={addMemory} className="w-full bg-blue-600 text-white py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-transform">
                Save Quick Note ✨
              </button>
            </div>

            {/* Memory Garden Promo */}
            <div className="bg-gradient-to-r from-stone-50 to-green-50 p-4 rounded-3xl border border-stone-200">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌸</span>
                <div className="flex-1">
                  <h4 className="font-bold text-stone-700">Memory Garden</h4>
                  <p className="text-xs text-stone-500">Add memories to grow your Japanese garden! {game.totalMemoryCount} memories, {game.terrarium.unlockedItems.length} items unlocked.</p>
                </div>
                <button
                  onClick={() => setActiveModal('terrarium')}
                  className="px-4 py-2 bg-stone-600 text-white rounded-2xl text-sm font-bold hover:bg-stone-700 transition-colors"
                >
                  Open
                </button>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest pl-2">Timeline of Us ({game.memories.length} memories)</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {game.memories.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">No memories yet. Start capturing moments!</p>
                ) : (
                  game.memories.map((mem) => (
                    <div key={mem.id} className="bg-white p-4 rounded-3xl text-sm text-gray-700 border border-blue-50 shadow-sm leading-relaxed flex gap-3">
                      {mem.photoUrl && (
                        <img src={mem.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{mem.title}</p>
                        {mem.content && <p className="text-xs text-gray-500 line-clamp-2">{mem.content}</p>}
                        <p className="text-[10px] text-gray-300 mt-1">Memory #{mem.memoryNumber}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} title="Settings">
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Active Kid's Name</label>
            <input type="text" value={pet.name} onChange={(e) => updateActivePet(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-5 rounded-3xl border border-blue-100 focus:ring-4 focus:ring-blue-100 outline-none text-gray-800 bg-gray-50 font-black text-xl" />
          </div>
          <div className="space-y-4">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Customize Portrait</label>
             <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-50 text-blue-600 py-5 rounded-3xl font-black uppercase tracking-widest border-2 border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-3">
               <span>📸 Upload Photo</span>
             </button>
             <p className="text-[10px] text-center text-gray-400 font-medium italic">Upload a custom image for your kid!</p>
          </div>
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
            <h4 className="font-black text-blue-600 text-[10px] uppercase mb-2">Game Stats</h4>
            <div className="text-xs text-blue-500 space-y-1">
              <p>Level: {pet.level} / {MAX_LEVEL}</p>
              <p>Stage: {pet.stage}</p>
              <p>Trophies: {game.trophies.length}</p>
            </div>
          </div>
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
            <h4 className="font-black text-blue-600 text-[10px] uppercase mb-2">Return to Home</h4>
            <p className="text-xs text-blue-400 font-bold mb-4">Go back to the home screen. Progress is auto-saved.</p>
            <button onClick={() => { setActiveModal(null); setShowHomeScreen(true); }} className="w-full bg-blue-500 text-white py-3 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100 active:scale-95 transition-transform">Back to Home</button>
          </div>
          {/* Debug Info */}
          <div className="bg-yellow-50 p-6 rounded-[2rem] border border-yellow-100">
            <h4 className="font-black text-yellow-600 text-[10px] uppercase mb-2">Debug Info</h4>
            <div className="text-xs text-yellow-700 space-y-1 font-mono">
              {game.pets.map(p => (
                <p key={p.id}>{p.name}: bond={String(p.bond)} (type: {typeof p.bond})</p>
              ))}
            </div>
            <button
              onClick={() => {
                console.log('Current game state:', game);
                console.log('Pets:', game.pets);
                alert('Check browser console for full debug info');
              }}
              className="w-full mt-3 bg-yellow-500 text-white py-2 rounded-xl font-bold text-xs active:scale-95 transition-transform"
            >
              Log to Console
            </button>
          </div>

          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
            <h4 className="font-black text-red-600 text-[10px] uppercase mb-2">Reset Game</h4>
            <p className="text-xs text-red-400 font-bold mb-4">This will clear all progress and memories for this save slot.</p>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all progress? This cannot be undone!')) {
                  if (activeSlot) saveState.deleteSlot(activeSlot);
                  setGame(INITIAL_GAME_STATE);
                  setActiveModal(null);
                }
              }}
              className="w-full bg-red-500 text-white py-3 rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-100 active:scale-95 transition-transform"
            >
              Reset Progress
            </button>
          </div>

          <div className="bg-gray-800 p-6 rounded-[2rem] border border-gray-700">
            <h4 className="font-black text-gray-300 text-[10px] uppercase mb-2">Nuclear Option</h4>
            <p className="text-xs text-gray-400 font-bold mb-4">Clear ALL localStorage data (all save slots).</p>
            <button
              onClick={() => {
                if (window.confirm('This will delete ALL save data across ALL slots. Are you absolutely sure?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="w-full bg-gray-600 text-white py-3 rounded-2xl font-black uppercase text-xs active:scale-95 transition-transform"
            >
              Clear All Data & Reload
            </button>
          </div>
        </div>
      </Modal>

      {/* NEW JOURNAL ENTRY MODAL */}
      <Modal isOpen={activeModal === 'journal_entry'} onClose={() => setActiveModal(null)} title="Level-up Milestone!">
        <div className="space-y-8">
          <div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 text-center shadow-inner">
            <span className="text-6xl block mb-6">🖋️</span>
            <h3 className="text-2xl font-brand text-blue-900 leading-tight mb-4">{currentPrompt}</h3>
          </div>
          <div className="space-y-4">
            <textarea value={journalNote} onChange={(e) => setJournalNote(e.target.value)} placeholder="Pour your heart out..."
              className="w-full p-6 rounded-[2.5rem] border border-blue-100 focus:ring-4 focus:ring-blue-100 outline-none min-h-[160px] text-gray-700 shadow-inner bg-white font-medium" />
            <button onClick={saveJournalEntry} disabled={!journalNote.trim() || isSavingJournal}
              className={`w-full py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${journalNote.trim() ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
              {isSavingJournal ? 'Recording...' : 'Lock Memory ✨'}
            </button>
            <button onClick={() => setActiveModal(null)} className="w-full text-center text-xs font-black text-gray-400 uppercase hover:text-blue-500 transition-colors tracking-widest">
              Maybe later
            </button>
          </div>
        </div>
      </Modal>

      {/* GAMES MENU MODAL */}
      <Modal isOpen={activeModal === 'games'} onClose={() => setActiveModal(null)} title="Earn Diamonds!">
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-3xl border border-green-100 mb-6">
            <p className="text-sm text-green-700 font-bold text-center">Play games to earn 💎 diamonds!</p>
          </div>

          <button
            onClick={startTrivia}
            className="w-full flex items-center gap-4 p-5 bg-white border-2 border-purple-100 rounded-3xl hover:bg-purple-50 transition-all active:scale-95"
          >
            <span className="text-4xl">🧠</span>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-gray-800">Family Trivia</h3>
              <p className="text-xs text-gray-500">Answer questions to earn {TRIVIA_REWARD} 💎 each</p>
            </div>
            <span className="text-2xl">→</span>
          </button>

          <button
            onClick={openMemorySelect}
            className="w-full flex items-center gap-4 p-5 bg-white border-2 border-blue-100 rounded-3xl hover:bg-blue-50 transition-all active:scale-95"
          >
            <span className="text-4xl">🃏</span>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-gray-800">Memory Match</h3>
              <p className="text-xs text-gray-500">Entry: {MEMORY_MATCH_ENTRY_COST} 💎 | Earn 20-50 💎</p>
            </div>
            <span className="text-2xl">→</span>
          </button>

          <button
            onClick={() => setActiveModal('game_room')}
            className="w-full flex items-center gap-4 p-5 bg-white border-2 border-pink-100 rounded-3xl hover:bg-pink-50 transition-all active:scale-95"
          >
            <span className="text-4xl">🎮</span>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-gray-800">Game Room</h3>
              <p className="text-xs text-gray-500">Play Pong & Match-3 with your kids!</p>
            </div>
            <span className="text-2xl">→</span>
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Stats</p>
            <p className="text-sm text-gray-600">Best Memory Reward: <span className="font-bold">{game.highScores.memoryMatch} 💎</span></p>
            <p className="text-sm text-gray-600">Trivia Answered: <span className="font-bold">{game.answeredTrivia.length}/{TRIVIA_QUESTIONS.length}</span></p>
            <p className="text-sm text-gray-600">Best Pong Score: <span className="font-bold">{game.highScores.pong} 💎</span></p>
            <p className="text-sm text-gray-600">Best Match-3 Score: <span className="font-bold">{game.highScores.match3} 💎</span></p>
          </div>
        </div>
      </Modal>

      {/* TRIVIA MODAL */}
      <Modal isOpen={activeModal === 'trivia'} onClose={() => setActiveModal(null)} title="Family Trivia">
        {currentTrivia && (
          <div className="space-y-6">
            <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 text-center">
              <p className="text-lg font-bold text-gray-800 leading-relaxed">{currentTrivia.question}</p>
              <p className="text-xs text-purple-400 mt-2 font-bold">Worth {TRIVIA_REWARD} 💎</p>
            </div>

            <div className="space-y-3">
              {currentTrivia.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => answerTrivia(idx)}
                  disabled={selectedAnswer !== null}
                  className={`w-full p-4 rounded-2xl text-left font-bold transition-all ${
                    selectedAnswer === null
                      ? 'bg-white border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 active:scale-95'
                      : selectedAnswer === idx
                        ? idx === currentTrivia.correctIndex
                          ? 'bg-green-100 border-2 border-green-400 text-green-800'
                          : 'bg-red-100 border-2 border-red-400 text-red-800'
                        : idx === currentTrivia.correctIndex
                          ? 'bg-green-100 border-2 border-green-400 text-green-800'
                          : 'bg-gray-50 border-2 border-gray-100 text-gray-400'
                  }`}
                >
                  <span className="mr-3 text-gray-400">{String.fromCharCode(65 + idx)}.</span>
                  {option}
                </button>
              ))}
            </div>

            {triviaResult && (
              <div className={`p-6 rounded-3xl text-center ${triviaResult === 'correct' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <span className="text-5xl block mb-3">{triviaResult === 'correct' ? '🎉' : '😢'}</span>
                <p className={`font-bold text-lg ${triviaResult === 'correct' ? 'text-green-700' : 'text-red-700'}`}>
                  {triviaResult === 'correct' ? `Correct! +${TRIVIA_REWARD} 💎` : 'Not quite right...'}
                </p>
              </div>
            )}

            {triviaResult && (
              <div className="flex gap-3">
                <button
                  onClick={startTrivia}
                  className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                  Next Question
                </button>
                <button
                  onClick={() => setActiveModal('games')}
                  className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MEMORY MATCH MODAL */}
      <Modal isOpen={activeModal === 'memory_match'} onClose={() => setActiveModal(null)} title="Memory Match">
        <div className="space-y-4">
          {/* Difficulty Selection */}
          {!memoryDifficulty && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 text-center">
                <p className="text-sm text-blue-700 font-bold">Entry Cost: {MEMORY_MATCH_ENTRY_COST} 💎 | You have: {game.credits} 💎</p>
                <p className="text-xs text-blue-500 mt-1">Lives vary by difficulty (6-10)</p>
              </div>

              <p className="text-center font-bold text-gray-600">Select Difficulty</p>

              <button
                onClick={() => startMemoryGame('easy')}
                disabled={game.credits < MEMORY_MATCH_ENTRY_COST}
                className={`w-full p-5 rounded-3xl border-2 transition-all active:scale-95 ${game.credits >= MEMORY_MATCH_ENTRY_COST ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-100 border-gray-200 opacity-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="font-bold text-green-800">Easy</h3>
                    <p className="text-xs text-green-600">4×4 Grid ({MEMORY_MATCH_CONFIG.easy.pairs} pairs) • {MEMORY_MATCH_CONFIG.easy.lives} lives</p>
                  </div>
                  <span className="font-black text-green-700">+{MEMORY_MATCH_CONFIG.easy.reward} 💎</span>
                </div>
              </button>

              <button
                onClick={() => startMemoryGame('medium')}
                disabled={game.credits < MEMORY_MATCH_ENTRY_COST || MEMORY_IMAGES.length < MEMORY_MATCH_CONFIG.medium.pairs}
                className={`w-full p-5 rounded-3xl border-2 transition-all active:scale-95 ${game.credits >= MEMORY_MATCH_ENTRY_COST && MEMORY_IMAGES.length >= MEMORY_MATCH_CONFIG.medium.pairs ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' : 'bg-gray-100 border-gray-200 opacity-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="font-bold text-yellow-800">Medium</h3>
                    <p className="text-xs text-yellow-600">6×6 Grid ({MEMORY_MATCH_CONFIG.medium.pairs} pairs) • {MEMORY_MATCH_CONFIG.medium.lives} lives</p>
                    {MEMORY_IMAGES.length < MEMORY_MATCH_CONFIG.medium.pairs && (
                      <p className="text-[10px] text-red-500">Need {MEMORY_MATCH_CONFIG.medium.pairs - MEMORY_IMAGES.length} more images</p>
                    )}
                  </div>
                  <span className="font-black text-yellow-700">+{MEMORY_MATCH_CONFIG.medium.reward} 💎</span>
                </div>
              </button>

              <button
                onClick={() => startMemoryGame('hard')}
                disabled={game.credits < MEMORY_MATCH_ENTRY_COST || MEMORY_IMAGES.length < MEMORY_MATCH_CONFIG.hard.pairs}
                className={`w-full p-5 rounded-3xl border-2 transition-all active:scale-95 ${game.credits >= MEMORY_MATCH_ENTRY_COST && MEMORY_IMAGES.length >= MEMORY_MATCH_CONFIG.hard.pairs ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-gray-100 border-gray-200 opacity-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="font-bold text-red-800">Hard</h3>
                    <p className="text-xs text-red-600">8×8 Grid ({MEMORY_MATCH_CONFIG.hard.pairs} pairs) • {MEMORY_MATCH_CONFIG.hard.lives} lives</p>
                    {MEMORY_IMAGES.length < MEMORY_MATCH_CONFIG.hard.pairs && (
                      <p className="text-[10px] text-red-500">Need {MEMORY_MATCH_CONFIG.hard.pairs - MEMORY_IMAGES.length} more images</p>
                    )}
                  </div>
                  <span className="font-black text-red-700">+{MEMORY_MATCH_CONFIG.hard.reward} 💎</span>
                </div>
              </button>

              <button
                onClick={() => setActiveModal('games')}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Back
              </button>
            </div>
          )}

          {/* Game in Progress */}
          {memoryDifficulty && !memoryGameOver && !memoryGameWon && (
            <>
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-2xl border border-blue-100">
                <span className="text-sm font-bold text-blue-600">{MEMORY_MATCH_CONFIG[memoryDifficulty].label}</span>
                <span className="text-sm font-bold text-blue-600">
                  Lives: {Array(memoryLives).fill('❤️').join('')}{Array(MEMORY_MATCH_CONFIG[memoryDifficulty].lives - memoryLives).fill('🖤').join('')}
                </span>
                <span className="text-sm font-bold text-blue-600">{memoryMatches}/{MEMORY_MATCH_CONFIG[memoryDifficulty].pairs}</span>
              </div>

              <div
                className="grid gap-1 max-h-[50vh] overflow-y-auto p-1"
                style={{ gridTemplateColumns: `repeat(${MEMORY_MATCH_CONFIG[memoryDifficulty].grid}, 1fr)` }}
              >
                {memoryCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => flipCard(card.id)}
                    className={`aspect-square rounded-lg flex items-center justify-center transition-all duration-300 overflow-hidden ${
                      card.matched
                        ? 'bg-green-100 border-2 border-green-400'
                        : card.flipped
                          ? 'bg-white border-2 border-blue-300 shadow-md'
                          : 'bg-gradient-to-br from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 active:scale-95'
                    }`}
                  >
                    {(card.flipped || card.matched) ? (
                      <img
                        src={`/assets/memory-match/${card.imageId}.png`}
                        alt={`Card ${card.imageId}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className={MEMORY_MATCH_CONFIG[memoryDifficulty].grid >= 8 ? 'text-lg' : 'text-2xl'}>?</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setMemoryDifficulty(null)}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Quit Game
              </button>
            </>
          )}

          {/* Game Over - Lost */}
          {memoryGameOver && memoryDifficulty && (
            <div className="text-center space-y-4">
              <div className="bg-red-50 p-6 rounded-3xl border border-red-200">
                <span className="text-5xl block mb-3">💔</span>
                <p className="font-bold text-xl text-red-800 mb-2">Out of Lives!</p>
                <p className="text-sm text-red-600">Matched {memoryMatches}/{MEMORY_MATCH_CONFIG[memoryDifficulty].pairs} pairs</p>
              </div>

              {/* Continue Option */}
              {memoryContinuesUsed < MEMORY_MATCH_MAX_CONTINUES && (
                <div className="bg-yellow-50 p-4 rounded-3xl border border-yellow-200">
                  <p className="text-sm font-bold text-yellow-800 mb-3">Want to continue?</p>
                  <button
                    onClick={buyMemoryContinue}
                    disabled={game.credits < MEMORY_MATCH_CONTINUE_COST}
                    className={`w-full py-3 rounded-2xl font-bold transition-all active:scale-95 ${
                      game.credits >= MEMORY_MATCH_CONTINUE_COST
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Buy 1 Life for {MEMORY_MATCH_CONTINUE_COST} 💎
                  </button>
                  <p className="text-[10px] text-yellow-600 mt-2">
                    Continues used: {memoryContinuesUsed}/{MEMORY_MATCH_MAX_CONTINUES} | You have: {game.credits} 💎
                  </p>
                </div>
              )}

              {memoryContinuesUsed >= MEMORY_MATCH_MAX_CONTINUES && (
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-200">
                  <p className="text-sm text-gray-500">No more continues available</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setMemoryDifficulty(null)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                  New Game
                </button>
                <button
                  onClick={() => setActiveModal('games')}
                  className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Game Won */}
          {memoryGameWon && memoryDifficulty && (
            <div className="text-center space-y-4">
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-3xl border border-yellow-200">
                <span className="text-5xl block mb-3">🎊</span>
                <p className="font-bold text-xl text-gray-800 mb-2">You Won!</p>
                <p className="text-sm text-gray-600">Completed {MEMORY_MATCH_CONFIG[memoryDifficulty].label} with {memoryLives} {memoryLives === 1 ? 'life' : 'lives'} remaining</p>
                <p className="text-lg font-black text-yellow-600 mt-2">+{MEMORY_MATCH_CONFIG[memoryDifficulty].reward} 💎</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setMemoryDifficulty(null)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
                >
                  Play Again
                </button>
                <button
                  onClick={() => setActiveModal('games')}
                  className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* GAME ROOM MODAL */}
      <Modal isOpen={activeModal === 'game_room'} onClose={() => setActiveModal(null)} title="Game Room">
        <GameRoom
          pets={game.pets}
          credits={game.credits}
          onClose={() => setActiveModal('games')}
          onCreditChange={(amount) => setGame(prev => ({ ...prev, credits: prev.credits + amount }))}
          onBondIncrease={handleBondIncrease}
          onGameWin={(petId, gameName, reward) => {
            const winningPet = game.pets.find(p => p.id === petId);
            if (winningPet) {
              createAutoJournalEntry(winningPet, 'game_win', `Won ${gameName} with ${winningPet.name}! Earned ${reward} 💎`);
            }
          }}
        />
      </Modal>

      {/* TERRARIUM VIEW */}
      {activeModal === 'terrarium' && (
        <Terrarium
          unlockedItems={game.terrarium.unlockedItems}
          placedItems={game.terrarium.placedItems}
          onPlaceItem={handlePlaceItems}
          onClose={() => setActiveModal(null)}
          onAddMemory={() => setActiveModal('memory_form')}
          totalMemories={game.totalMemoryCount}
        />
      )}

      {/* MEMORY FORM */}
      {activeModal === 'memory_form' && (
        <MemoryForm
          onSave={handleSaveMemory}
          onClose={() => setActiveModal('terrarium')}
          memoryCount={game.totalMemoryCount}
        />
      )}

      {/* UNLOCK MODAL */}
      {pendingUnlocks.length > 0 && (
        <UnlockModal
          items={pendingUnlocks}
          onClose={handleUnlockModalClose}
          onOpenTerrarium={handleOpenTerrariumFromUnlock}
        />
      )}

      {/* GALLERY VIEW */}
      {activeModal === 'gallery' && (
        <Gallery
          memories={game.memories}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* COLLECTIBLES VIEW */}
      {activeModal === 'collectibles' && (
        <Collectibles
          claimedGifts={game.claimedGifts}
          pets={game.pets}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* BOND GIFT MODAL */}
      {pendingGift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] max-w-sm w-full shadow-2xl animate-bounce-in overflow-hidden">
            {/* Art Asset Display - Full Width */}
            <div className="relative bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4">
              <div className="aspect-square max-h-64 mx-auto rounded-2xl overflow-hidden bg-white shadow-lg border-4 border-white">
                <img
                  src={`/assets/gifts/${pendingGift.pet.id}/${pendingGift.gift.assets[pendingGift.pet.id] || pendingGift.gift.defaultAsset}`}
                  alt={pendingGift.gift.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to emoji if image not found
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-pink-50 to-purple-50">${
                      pendingGift.gift.bondLevel <= 3 ? '🎨' :
                      pendingGift.gift.bondLevel <= 5 ? '🌸' :
                      pendingGift.gift.bondLevel <= 7 ? '💝' :
                      pendingGift.gift.bondLevel <= 9 ? '💌' : '👑'
                    }</div>`;
                  }}
                />
              </div>
              {/* Sparkle decorations */}
              <div className="absolute top-2 left-4 text-2xl animate-pulse">✨</div>
              <div className="absolute top-8 right-6 text-xl animate-pulse delay-100">💫</div>
              <div className="absolute bottom-4 left-8 text-lg animate-pulse delay-200">⭐</div>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Header */}
              <div className="text-center mb-4">
                <p className="text-xs text-pink-500 font-bold uppercase tracking-wide">Bond Level {pendingGift.gift.bondLevel} Reached!</p>
                <h2 className="text-xl font-bold text-gray-800 mt-1">A Gift from {pendingGift.pet.name}!</h2>
                <p className="text-sm text-gray-500">{pendingGift.gift.name}</p>
              </div>

              {/* Pet Message */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-100">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">{PET_EMOJIS[pendingGift.pet.type] || '👶'}</span>
                  <span className="font-bold text-blue-700">{pendingGift.pet.name}:</span>
                </div>
                <p className="text-sm text-blue-600 italic text-center leading-relaxed">
                  "{pendingGift.gift.messages[pendingGift.pet.id] || pendingGift.gift.defaultMessage}"
                </p>
              </div>

              {/* Reward */}
              {pendingGift.gift.reward && (
                <div className="flex items-center justify-center gap-2 mb-4 py-2 bg-yellow-50 rounded-xl border border-yellow-200">
                  <span className="text-sm text-yellow-700 font-bold">Reward:</span>
                  <span className="text-lg font-bold text-yellow-600">
                    +{pendingGift.gift.reward.amount} {
                      pendingGift.gift.reward.type === 'credits' ? '💎' :
                      pendingGift.gift.reward.type === 'food' ? '🍙' :
                      pendingGift.gift.reward.type === 'toys' ? '🎯' : '⭐'
                    }
                  </span>
                </div>
              )}

              {/* Claim Button */}
              <button
                onClick={() => claimGift(pendingGift.gift, pendingGift.pet.id)}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-pink-200 active:scale-95 transition-transform"
              >
                Accept Gift 💕
              </button>

              <p className="text-center text-[10px] text-gray-400 mt-3">Added to your Collectibles!</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
