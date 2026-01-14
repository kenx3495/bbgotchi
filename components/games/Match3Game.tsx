import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GAME_ROOM_CONFIG } from '../../constants';

interface Match3GameProps {
  petName: string;
  onGameEnd: (score: number) => void;
  onBack: () => void;
}

const GEM_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9d65c9', '#ff9f45'];
const GEM_EMOJIS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠'];

type Gem = {
  type: number;
  id: number;
  falling: boolean;
  matched: boolean;
  popping: boolean; // New: for pop animation
};

type FloatingScore = {
  id: number;
  points: number;
  x: number;
  y: number;
};

export const Match3Game: React.FC<Match3GameProps> = ({ petName, onGameEnd, onBack }) => {
  const config = GAME_ROOM_CONFIG.match3;
  const gridSize = config.gridSize;

  const [grid, setGrid] = useState<Gem[][]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.timeLimit);
  const [selectedGem, setSelectedGem] = useState<{ row: number; col: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);

  // Use ref for stable gem ID counter
  const gemIdCounterRef = useRef(0);
  const floatingIdRef = useRef(0);
  // Track score in ref for timer callback
  const scoreRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const createGem = useCallback((type?: number): Gem => {
    return {
      type: type ?? Math.floor(Math.random() * config.gemTypes),
      id: gemIdCounterRef.current++,
      falling: false,
      matched: false,
      popping: false,
    };
  }, [config.gemTypes]);

  const initializeGrid = useCallback(() => {
    const newGrid: Gem[][] = [];
    for (let row = 0; row < gridSize; row++) {
      newGrid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        let gem = createGem();
        // Avoid creating initial matches
        while (
          (col >= 2 && newGrid[row][col - 1].type === gem.type && newGrid[row][col - 2].type === gem.type) ||
          (row >= 2 && newGrid[row - 1][col].type === gem.type && newGrid[row - 2][col].type === gem.type)
        ) {
          gem = createGem();
        }
        newGrid[row][col] = gem;
      }
    }
    return newGrid;
  }, [gridSize, createGem]);

  const findMatches = useCallback((currentGrid: Gem[][]): Set<string> => {
    const matches = new Set<string>();

    // Check horizontal matches
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize - 2; col++) {
        const type = currentGrid[row][col].type;
        if (
          type === currentGrid[row][col + 1].type &&
          type === currentGrid[row][col + 2].type
        ) {
          matches.add(`${row},${col}`);
          matches.add(`${row},${col + 1}`);
          matches.add(`${row},${col + 2}`);
          // Check for longer matches
          let i = col + 3;
          while (i < gridSize && currentGrid[row][i].type === type) {
            matches.add(`${row},${i}`);
            i++;
          }
        }
      }
    }

    // Check vertical matches
    for (let col = 0; col < gridSize; col++) {
      for (let row = 0; row < gridSize - 2; row++) {
        const type = currentGrid[row][col].type;
        if (
          type === currentGrid[row + 1][col].type &&
          type === currentGrid[row + 2][col].type
        ) {
          matches.add(`${row},${col}`);
          matches.add(`${row + 1},${col}`);
          matches.add(`${row + 2},${col}`);
          // Check for longer matches
          let i = row + 3;
          while (i < gridSize && currentGrid[i][col].type === type) {
            matches.add(`${i},${col}`);
            i++;
          }
        }
      }
    }

    return matches;
  }, [gridSize]);

  const removeMatchesAndFill = useCallback((currentGrid: Gem[][], matches: Set<string>): Gem[][] => {
    const newGrid = currentGrid.map(row => row.map(gem => ({ ...gem })));

    // Mark matched gems
    matches.forEach(pos => {
      const [row, col] = pos.split(',').map(Number);
      newGrid[row][col].matched = true;
    });

    // Drop gems and fill from top
    for (let col = 0; col < gridSize; col++) {
      let writeRow = gridSize - 1;
      for (let row = gridSize - 1; row >= 0; row--) {
        if (!newGrid[row][col].matched) {
          if (writeRow !== row) {
            newGrid[writeRow][col] = { ...newGrid[row][col], falling: true };
          }
          writeRow--;
        }
      }
      // Fill empty spaces from top
      for (let row = writeRow; row >= 0; row--) {
        newGrid[row][col] = createGem();
        newGrid[row][col].falling = true;
      }
    }

    return newGrid;
  }, [gridSize, createGem]);

  const addFloatingScore = useCallback((points: number, row: number, col: number) => {
    const cellSize = 36; // w-8 = 32px + gap
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;

    const newFloat: FloatingScore = {
      id: floatingIdRef.current++,
      points,
      x,
      y,
    };

    setFloatingScores(prev => [...prev, newFloat]);

    // Remove after animation
    setTimeout(() => {
      setFloatingScores(prev => prev.filter(f => f.id !== newFloat.id));
    }, 1000);
  }, []);

  const processMatchesOnGrid = useCallback(async (startGrid: Gem[][]) => {
    setIsAnimating(true);
    let currentGrid = startGrid.map(row => row.map(gem => ({ ...gem })));
    let currentCombo = 0;
    let totalPoints = 0;

    while (true) {
      const matches = findMatches(currentGrid);
      if (matches.size === 0) break;

      currentCombo++;
      const matchPoints = matches.size * 10 * currentCombo;
      totalPoints += matchPoints;
      setCombo(currentCombo);

      // Step 1: Mark matched gems as "popping" for glow/scale animation
      const matchArray = Array.from(matches);
      currentGrid = currentGrid.map((row, ri) =>
        row.map((gem, ci) => ({
          ...gem,
          popping: matches.has(`${ri},${ci}`),
        }))
      );
      setGrid(currentGrid.map(row => row.map(gem => ({ ...gem }))));

      // Calculate center of matched gems for floating score
      const positions = matchArray.map(pos => {
        const [r, c] = pos.split(',').map(Number);
        return { row: r, col: c };
      });
      const centerRow = Math.round(positions.reduce((sum, p) => sum + p.row, 0) / positions.length);
      const centerCol = Math.round(positions.reduce((sum, p) => sum + p.col, 0) / positions.length);
      addFloatingScore(matchPoints, centerRow, centerCol);

      // Wait for pop animation
      await new Promise(resolve => setTimeout(resolve, 400));

      // Step 2: Mark as matched (fade out)
      currentGrid = currentGrid.map((row, ri) =>
        row.map((gem, ci) => ({
          ...gem,
          matched: matches.has(`${ri},${ci}`),
          popping: false,
        }))
      );
      setGrid(currentGrid.map(row => row.map(gem => ({ ...gem }))));

      // Wait for fade
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 3: Remove and fill
      currentGrid = removeMatchesAndFill(currentGrid, matches);
      setGrid(currentGrid.map(row => row.map(gem => ({ ...gem }))));

      // Wait for drop animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Reset states
      currentGrid = currentGrid.map(row =>
        row.map(gem => ({ ...gem, falling: false, matched: false, popping: false }))
      );
    }

    setScore(prev => {
      const newScore = prev + totalPoints;
      scoreRef.current = newScore;
      return newScore;
    });
    setCombo(0);
    setIsAnimating(false);
  }, [findMatches, removeMatchesAndFill, addFloatingScore]);

  const swapGems = useCallback((row1: number, col1: number, row2: number, col2: number) => {
    const newGrid = grid.map(row => row.map(gem => ({ ...gem })));
    const temp = newGrid[row1][col1];
    newGrid[row1][col1] = newGrid[row2][col2];
    newGrid[row2][col2] = temp;
    return newGrid;
  }, [grid]);

  const handleGemClick = useCallback((row: number, col: number) => {
    if (isAnimating || gameOver || !gameStarted) return;

    if (!selectedGem) {
      setSelectedGem({ row, col });
      return;
    }

    const { row: selRow, col: selCol } = selectedGem;

    // Check if adjacent
    const isAdjacent =
      (Math.abs(row - selRow) === 1 && col === selCol) ||
      (Math.abs(col - selCol) === 1 && row === selRow);

    if (!isAdjacent) {
      setSelectedGem({ row, col });
      return;
    }

    // Swap gems
    const newGrid = swapGems(selRow, selCol, row, col);
    const matches = findMatches(newGrid);

    if (matches.size > 0) {
      setGrid(newGrid);
      setSelectedGem(null);
      // Pass the newGrid directly to avoid stale closure
      processMatchesOnGrid(newGrid);
    } else {
      // Invalid swap - swap back
      setSelectedGem(null);
    }
  }, [selectedGem, isAnimating, gameOver, gameStarted, swapGems, findMatches, processMatchesOnGrid]);

  // Initialize grid on mount
  useEffect(() => {
    if (grid.length === 0) {
      setGrid(initializeGrid());
    }
  }, [grid.length, initializeGrid]);

  const startGame = useCallback(() => {
    setGrid(initializeGrid());
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(config.timeLimit);
    setSelectedGem(null);
    setIsAnimating(false);
    setGameOver(false);
    setCombo(0);
    setGameStarted(true);
  }, [initializeGrid, config.timeLimit]);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          // Use ref to get latest score
          onGameEnd(scoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameOver, onGameEnd]);

  const getRewardTier = () => {
    if (score >= config.scoreThresholds.gold) return { tier: 'gold', reward: config.rewards.gold, emoji: '🥇' };
    if (score >= config.scoreThresholds.silver) return { tier: 'silver', reward: config.rewards.silver, emoji: '🥈' };
    if (score >= config.scoreThresholds.bronze) return { tier: 'bronze', reward: config.rewards.bronze, emoji: '🥉' };
    return { tier: 'none', reward: 0, emoji: '😢' };
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex justify-between w-full max-w-sm items-center">
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase">Score</p>
          <p className="text-2xl font-bold text-purple-500">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase">Time</p>
          <p className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
            {timeLeft}s
          </p>
        </div>
        {combo > 1 && (
          <div className="text-center">
            <p className="text-xs text-orange-400 uppercase">Combo</p>
            <p className="text-2xl font-bold text-orange-500">x{combo}</p>
          </div>
        )}
      </div>

      {/* Score thresholds */}
      <div className="flex gap-4 text-xs">
        <span className={score >= config.scoreThresholds.bronze ? 'text-amber-600 font-bold' : 'text-gray-400'}>
          🥉 {config.scoreThresholds.bronze}
        </span>
        <span className={score >= config.scoreThresholds.silver ? 'text-gray-500 font-bold' : 'text-gray-400'}>
          🥈 {config.scoreThresholds.silver}
        </span>
        <span className={score >= config.scoreThresholds.gold ? 'text-yellow-500 font-bold' : 'text-gray-400'}>
          🥇 {config.scoreThresholds.gold}
        </span>
      </div>

      {/* Grid */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-purple-900 p-2" style={{ minWidth: `${gridSize * 36 + 8}px`, minHeight: `${gridSize * 36 + 8}px` }}>
        <div
          ref={gridRef}
          className="grid gap-1 relative"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {grid.map((row, rowIndex) =>
            row.map((gem, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}-${gem.id}`}
                onClick={() => handleGemClick(rowIndex, colIndex)}
                disabled={isAnimating || gameOver}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-lg
                  transition-all
                  ${selectedGem?.row === rowIndex && selectedGem?.col === colIndex
                    ? 'ring-2 ring-white scale-110 z-10'
                    : 'hover:scale-105'
                  }
                  ${gem.falling ? 'gem-fall' : ''}
                  ${gem.popping ? 'gem-pop' : ''}
                  ${gem.matched ? 'gem-vanish' : ''}
                `}
                style={{
                  backgroundColor: GEM_COLORS[gem.type],
                  transitionDuration: gem.popping ? '400ms' : gem.matched ? '200ms' : '200ms',
                }}
              >
                {GEM_EMOJIS[gem.type]}
              </button>
            ))
          )}

          {/* Floating Scores */}
          {floatingScores.map(fs => (
            <div
              key={fs.id}
              className="floating-score absolute pointer-events-none font-black text-yellow-300 text-lg"
              style={{
                left: `${fs.x}px`,
                top: `${fs.y}px`,
                transform: 'translate(-50%, -50%)',
                textShadow: '0 0 10px rgba(255,200,0,0.8), 2px 2px 0 rgba(0,0,0,0.5)',
              }}
            >
              +{fs.points}
            </div>
          ))}
        </div>

        {/* Start overlay */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <p className="text-white text-lg font-bold">Match-3 with {petName}</p>
            <p className="text-gray-300 text-sm text-center px-4">
              Match 3+ gems before time runs out!
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all"
            >
              Start Game
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 rounded-2xl">
            <p className="text-4xl">{getRewardTier().emoji}</p>
            <p className="text-white text-xl font-bold">Time's Up!</p>
            <p className="text-gray-300">Final Score: {score}</p>
            {getRewardTier().reward > 0 && (
              <p className="text-yellow-400 font-bold">+{getRewardTier().reward} 💎</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={startGame}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all"
              >
                Play Again
              </button>
              <button
                onClick={onBack}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {gameStarted && !gameOver && (
        <p className="text-xs text-gray-400">Tap two adjacent gems to swap them</p>
      )}

      {/* Back button during game */}
      {!gameOver && (
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 text-sm font-bold"
        >
          ← Back to Game Room
        </button>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes gem-pop-anim {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); box-shadow: 0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,200,0,0.6); }
          100% { transform: scale(1.2); box-shadow: 0 0 15px rgba(255,255,255,0.6); }
        }
        @keyframes gem-vanish-anim {
          0% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes gem-fall-anim {
          0% { transform: translateY(-20px); opacity: 0.5; }
          60% { transform: translateY(5px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes float-up {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -150%) scale(1); opacity: 0; }
        }
        .gem-pop {
          animation: gem-pop-anim 400ms ease-out forwards;
          z-index: 10;
        }
        .gem-vanish {
          animation: gem-vanish-anim 200ms ease-in forwards;
        }
        .gem-fall {
          animation: gem-fall-anim 300ms ease-out forwards;
        }
        .floating-score {
          animation: float-up 1s ease-out forwards;
          z-index: 20;
        }
      `}</style>
    </div>
  );
};
