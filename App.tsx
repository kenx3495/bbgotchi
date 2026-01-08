
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PetState, GameState, PetStage, PetType, ShopItem, JournalEntry, Trophy } from './types';
import { INITIAL_GAME_STATE, SHOP_ITEMS, PET_EMOJIS, EXP_PER_LEVEL, MAX_LEVEL, EVOLUTION_TROPHIES, TRIVIA_QUESTIONS, TRIVIA_REWARD, MEMORY_MATCH_CONFIG, MEMORY_MATCH_ENTRY_COST, MEMORY_MATCH_CONTINUE_COST, MEMORY_MATCH_MAX_CONTINUES } from './constants';
import { PetView } from './components/PetView';
import { StatusBar } from './components/StatusBar';
import { Modal } from './components/Modals';
import { HomeScreen } from './components/HomeScreen';
import { saveState } from './services/saveState';

const App: React.FC = () => {
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [game, setGame] = useState<GameState>(INITIAL_GAME_STATE);
  const [isPetting, setIsPetting] = useState(false);
  const [isEating, setIsEating] = useState(false);
  const [activeModal, setActiveModal] = useState<'shop' | 'journal' | 'journal_entry' | 'settings' | 'kids' | 'trophies' | 'evolution' | 'games' | 'trivia' | 'memory_match' | null>(null);
  const [petMsg, setPetMsg] = useState("Hi Mom and Dad! ❤️");
  const [newMemory, setNewMemory] = useState("");

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

  // Tick logic: Deplete stats over time for all pets
  useEffect(() => {
    const timer = setInterval(() => {
      setGame(prev => ({
        ...prev,
        pets: prev.pets.map(p => ({
          ...p,
          hunger: Math.max(0, p.hunger - 0.1),
          happiness: Math.max(0, p.happiness - 0.15),
          energy: Math.max(0, p.energy - 0.05)
        }))
      }));
    }, 10000);
    return () => clearInterval(timer);
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
  }, [pet.exp, pet.maxExp, pet.level]);

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
    switch (type) {
      case 'feed':
        if (game.inventory.food > 0) {
          setIsEating(true);
          setTimeout(() => setIsEating(false), 2000);
          updateActivePet(prev => ({ ...prev, hunger: Math.min(100, prev.hunger + 25), exp: prev.exp + 5 }));
          setGame(prev => ({ ...prev, inventory: { ...prev.inventory, food: prev.inventory.food - 1 } }));
        }
        break;
      case 'pet':
        setIsPetting(true);
        setTimeout(() => setIsPetting(false), 2000);
        updateActivePet(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 10), exp: prev.exp + 2 }));
        break;
      case 'play':
        if (game.inventory.toys > 0) {
          updateActivePet(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 30), energy: Math.max(0, prev.energy - 10), exp: prev.exp + 10 }));
          setGame(prev => ({ ...prev, inventory: { ...prev.inventory, toys: prev.inventory.toys - 1 } }));
        }
        break;
    }
  }, [game.inventory, game.activePetId]);

  const addMemory = () => {
    if (!newMemory.trim()) return;
    setGame(prev => ({
      ...prev,
      memories: [newMemory, ...prev.memories]
    }));
    setNewMemory("");
  };

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
              disabled={game.inventory.toys === 0}
              className={`snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 rounded-2xl transition-all ${game.inventory.toys > 0 ? 'text-indigo-500 hover:bg-indigo-50' : 'text-gray-300 opacity-50'}`}
            >
              <span className="text-xl">🎯</span>
              <span className="text-[9px] font-bold uppercase">{game.inventory.toys}</span>
            </button>

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
            <button onClick={() => setActiveModal('journal')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all">
              <span className="text-xl">📖</span>
              <span className="text-[9px] font-bold uppercase">Journal</span>
            </button>
            <button onClick={() => setActiveModal('kids')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-2xl transition-all">
              <span className="text-xl">👨‍👩‍👧‍👦</span>
              <span className="text-[9px] font-bold uppercase">Kids</span>
            </button>
            <button onClick={() => setActiveModal('settings')} className="snap-center shrink-0 px-4 py-2 flex flex-col items-center gap-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all">
              <span className="text-xl">⚙️</span>
              <span className="text-[9px] font-bold uppercase">Settings</span>
            </button>
          </div>
        </nav>
      </main>

      {/* KIDS SELECTION MODAL */}
      <Modal isOpen={activeModal === 'kids'} onClose={() => setActiveModal(null)} title="Our Kids">
        <div className="grid grid-cols-2 gap-4">
          {game.pets.map(p => (
            <button 
              key={p.id}
              onClick={() => { setGame(prev => ({ ...prev, activePetId: p.id })); setActiveModal(null); }}
              className={`flex flex-col items-center p-4 rounded-3xl border-2 transition-all ${game.activePetId === p.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-100 hover:bg-gray-50'}`}
            >
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white border border-gray-100 mb-2 flex items-center justify-center">
                <span className="text-2xl">{PET_EMOJIS[p.type] || '👶'}</span>
              </div>
              <span className="font-bold text-gray-800">{p.name}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase">Lvl {p.level}</span>
            </button>
          ))}
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
                <div className="text-4xl">{item.type === 'food' ? '🍗' : item.type === 'treat' ? '🍰' : item.type === 'toy' ? '🧸' : '🧪'}</div>
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
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Add a new life detail</label>
              <textarea value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="E.g. We both love eating tacos on rainy Sundays..."
                className="w-full p-6 rounded-[2rem] border border-blue-100 focus:ring-4 focus:ring-blue-100 outline-none min-h-[140px] text-gray-700 shadow-inner bg-gray-50 font-medium" />
              <button onClick={addMemory} className="w-full bg-blue-600 text-white py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-transform">
                Save Memory ❤️
              </button>
            </div>
            <div className="space-y-3 mt-8">
              <h4 className="font-black text-gray-400 text-[10px] uppercase tracking-widest pl-2">Timeline of Us</h4>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {game.memories.map((mem, i) => (
                  <div key={i} className="bg-white p-4 rounded-3xl text-sm text-gray-700 border border-blue-50 shadow-sm font-bold leading-relaxed">
                    ✨ {mem}
                  </div>
                ))}
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
          <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
            <h4 className="font-black text-red-600 text-[10px] uppercase mb-2">Reset Game</h4>
            <p className="text-xs text-red-400 font-bold mb-4">This will clear all progress and memories for this save slot.</p>
            <button onClick={() => { if (activeSlot) saveState.deleteSlot(activeSlot); setGame(INITIAL_GAME_STATE); setActiveModal(null); }} className="w-full bg-red-500 text-white py-3 rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-100 active:scale-95 transition-transform">Reset Progress</button>
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

          <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Stats</p>
            <p className="text-sm text-gray-600">Best Memory Reward: <span className="font-bold">{game.highScores.memoryMatch} 💎</span></p>
            <p className="text-sm text-gray-600">Trivia Answered: <span className="font-bold">{game.answeredTrivia.length}/{TRIVIA_QUESTIONS.length}</span></p>
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
      `}</style>
    </div>
  );
};

export default App;
