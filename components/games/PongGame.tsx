import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GAME_ROOM_CONFIG, PET_AI_DIFFICULTY } from '../../constants';
import { PetType } from '../../types';

interface PongGameProps {
  petType: PetType;
  petName: string;
  onGameEnd: (won: boolean) => void;
  onBack: () => void;
}

export const PongGame: React.FC<PongGameProps> = ({ petType, petName, onGameEnd, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const config = GAME_ROOM_CONFIG.pong;
  const aiDifficulty = PET_AI_DIFFICULTY[petType] || PET_AI_DIFFICULTY.Custom;

  // Game state refs (to avoid stale closures in animation loop)
  const gameStateRef = useRef({
    ballX: 0,
    ballY: 0,
    ballVelX: 0,
    ballVelY: 0,
    playerY: 0,
    aiY: 0,
    playerScore: 0,
    aiScore: 0,
  });

  const playerTargetY = useRef(0);

  const resetBall = useCallback((direction: 1 | -1 = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    gameStateRef.current.ballX = canvas.width / 2;
    gameStateRef.current.ballY = canvas.height / 2;
    gameStateRef.current.ballVelX = config.ballSpeed * direction;
    gameStateRef.current.ballVelY = (Math.random() - 0.5) * config.ballSpeed;
  }, [config.ballSpeed]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize positions
    gameStateRef.current.playerY = canvas.height / 2 - 40;
    gameStateRef.current.aiY = canvas.height / 2 - 40;
    gameStateRef.current.playerScore = 0;
    gameStateRef.current.aiScore = 0;
    playerTargetY.current = canvas.height / 2 - 40;

    setPlayerScore(0);
    setAiScore(0);
    setGameOver(false);
    setWinner(null);
    resetBall(1);
    setGameStarted(true);
  }, [resetBall]);

  // Handle mouse/touch movement
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMove = (clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const y = clientY - rect.top;
      playerTargetY.current = Math.max(0, Math.min(canvas.height - 80, y - 40));
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animationId: number;

    const paddleWidth = 12;
    const paddleHeight = 80;
    const ballSize = 12;

    const gameLoop = () => {
      const state = gameStateRef.current;

      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw center line
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Smooth player paddle movement
      const playerDiff = playerTargetY.current - state.playerY;
      state.playerY += playerDiff * 0.15;

      // AI paddle movement with difficulty-based reaction
      const aiTargetY = state.ballY - paddleHeight / 2;
      const aiSpeed = config.paddleSpeed * aiDifficulty.pongSpeed;

      // Add some "imperfection" based on accuracy
      const aiError = (1 - aiDifficulty.pongAccuracy) * 50 * (Math.random() - 0.5);

      if (state.ballVelX > 0) { // Only track when ball is coming towards AI
        const diff = (aiTargetY + aiError) - state.aiY;
        state.aiY += Math.sign(diff) * Math.min(Math.abs(diff), aiSpeed);
      }

      // Keep AI paddle in bounds
      state.aiY = Math.max(0, Math.min(canvas.height - paddleHeight, state.aiY));

      // Update ball position
      state.ballX += state.ballVelX;
      state.ballY += state.ballVelY;

      // Ball collision with top/bottom
      if (state.ballY <= 0 || state.ballY >= canvas.height - ballSize) {
        state.ballVelY = -state.ballVelY;
        state.ballY = Math.max(0, Math.min(canvas.height - ballSize, state.ballY));
      }

      // Ball collision with player paddle
      if (
        state.ballX <= paddleWidth + 20 &&
        state.ballY + ballSize >= state.playerY &&
        state.ballY <= state.playerY + paddleHeight
      ) {
        state.ballVelX = Math.abs(state.ballVelX) * 1.05; // Speed up slightly
        const hitPos = (state.ballY - state.playerY) / paddleHeight - 0.5;
        state.ballVelY = hitPos * 8;
        state.ballX = paddleWidth + 21;
      }

      // Ball collision with AI paddle
      if (
        state.ballX >= canvas.width - paddleWidth - 20 - ballSize &&
        state.ballY + ballSize >= state.aiY &&
        state.ballY <= state.aiY + paddleHeight
      ) {
        state.ballVelX = -Math.abs(state.ballVelX) * 1.05;
        const hitPos = (state.ballY - state.aiY) / paddleHeight - 0.5;
        state.ballVelY = hitPos * 8;
        state.ballX = canvas.width - paddleWidth - 21 - ballSize;
      }

      // Scoring
      if (state.ballX < 0) {
        state.aiScore++;
        setAiScore(state.aiScore);
        if (state.aiScore >= config.pointsToWin) {
          setGameOver(true);
          setWinner('ai');
          onGameEnd(false);
          return;
        }
        resetBall(-1);
      } else if (state.ballX > canvas.width) {
        state.playerScore++;
        setPlayerScore(state.playerScore);
        if (state.playerScore >= config.pointsToWin) {
          setGameOver(true);
          setWinner('player');
          onGameEnd(true);
          return;
        }
        resetBall(1);
      }

      // Draw paddles
      ctx.fillStyle = '#ff6b9d'; // Player paddle - pink
      ctx.fillRect(20, state.playerY, paddleWidth, paddleHeight);

      ctx.fillStyle = '#6bfff0'; // AI paddle - cyan
      ctx.fillRect(canvas.width - 20 - paddleWidth, state.aiY, paddleWidth, paddleHeight);

      // Draw ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(state.ballX + ballSize / 2, state.ballY + ballSize / 2, ballSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw scores
      ctx.font = 'bold 48px "Fredoka One", sans-serif';
      ctx.fillStyle = '#ffffff33';
      ctx.textAlign = 'center';
      ctx.fillText(String(state.playerScore), canvas.width / 4, 60);
      ctx.fillText(String(state.aiScore), (canvas.width / 4) * 3, 60);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameStarted, gameOver, aiDifficulty, config, resetBall, onGameEnd]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex justify-between w-full max-w-md items-center">
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase">You</p>
          <p className="text-2xl font-bold text-pink-500">{playerScore}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-600">First to {config.pointsToWin}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase">{petName}</p>
          <p className="text-2xl font-bold text-cyan-500">{aiScore}</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="bg-[#1a1a2e] touch-none"
        />

        {/* Start overlay */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
            <p className="text-white text-lg font-bold">Pong vs {petName}</p>
            <p className="text-gray-300 text-sm">Move your paddle with mouse/touch</p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all"
            >
              Start Game
            </button>
          </div>
        )}

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
            <p className="text-4xl">{winner === 'player' ? '🎉' : '😢'}</p>
            <p className="text-white text-xl font-bold">
              {winner === 'player' ? 'You Won!' : `${petName} Won!`}
            </p>
            <p className="text-gray-300">
              {playerScore} - {aiScore}
            </p>
            <div className="flex gap-3">
              <button
                onClick={startGame}
                className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full shadow-lg active:scale-95 transition-all"
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
        <p className="text-xs text-gray-400">Move mouse/finger to control your paddle</p>
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
    </div>
  );
};
