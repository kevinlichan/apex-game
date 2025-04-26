'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * A lightweight Flappy-Bird-style mini-game rendered on an HTML5 canvas.
 * Controls: Click anywhere on the canvas or press the space-bar to flap.
 */
export default function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  // Game constants
  const width = 400;
  const height = 600;
  const birdRadius = 12;
  const gravity = 0.35;
  const flapStrength = -6;
  const pipeWidth = 50;
  const gapHeight = 140;
  const pipeSpeed = 1.5;

  // Mutable refs to hold game-state between renders without triggering re-renders
  const birdY = useRef(height / 2);
  const velocity = useRef(0);
  const pipes = useRef<{ x: number; gapY: number; scored: boolean }[]>([]);
  const animationRef = useRef<number | null>(null);
  const frameCounter = useRef(0);

  // Load bird image (SVG)
  const birdImgRef = useRef<HTMLImageElement | null>(null);

  // Background image
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/bird.svg';
    birdImgRef.current = img;
  }, []);

  useEffect(() => {
    const bg = new Image();
    bg.src = '/background.png'; // ensure the image is placed in public/background.png
    bgImgRef.current = bg;
  }, []);

  // Reset game to initial state
  const resetGame = () => {
    birdY.current = height / 2;
    velocity.current = 0;
    pipes.current = [];
    setScore(0);
    setGameOver(false);
    frameCounter.current = 0;
  };

  const flap = () => {
    if (!started) {
      setStarted(true);
    }
    if (gameOver) {
      // Restart
      resetGame();
      setStarted(true);
      return;
    }
    velocity.current = flapStrength;
  };

  // Register event listeners once
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', handleKey);
    const canvas = canvasRef.current;
    canvas?.addEventListener('mousedown', flap);
    return () => {
      window.removeEventListener('keydown', handleKey);
      canvas?.removeEventListener('mousedown', flap);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, started]);

  // Main game loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Physics update only after game started
      if (started && !gameOver) {
        velocity.current += gravity;
        birdY.current += velocity.current;

        // Add new pipes periodically
        if (frameCounter.current % 90 === 0) {
          const gapY = Math.random() * (height - gapHeight - 120) + 60;
          pipes.current.push({ x: width, gapY, scored: false });
        }
        frameCounter.current += 1;

        // Update pipes & check for collisions/score
        pipes.current.forEach((pipe) => {
          pipe.x -= pipeSpeed;

          // Score when pipe passes bird
          if (!pipe.scored && pipe.x + pipeWidth < width / 4) {
            pipe.scored = true;
            setScore((s) => s + 1);
          }
        });
        // Remove off-screen pipes
        pipes.current = pipes.current.filter((p) => p.x + pipeWidth > 0);

        // Collision detection
        const hitGround = birdY.current + birdRadius > height;
        const hitCeiling = birdY.current - birdRadius < 0;

        const hitPipe = pipes.current.some((pipe) => {
          const birdX = width / 4;
          const withinX =
            birdX + birdRadius > pipe.x && birdX - birdRadius < pipe.x + pipeWidth;
          if (!withinX) return false;
          const withinGap =
            birdY.current - birdRadius > pipe.gapY &&
            birdY.current + birdRadius < pipe.gapY + gapHeight;
          return !withinGap;
        });

        if (hitGround || hitCeiling || hitPipe) {
          setGameOver(true);
        }
      }

      // DRAW SECTION
      if (bgImgRef.current && bgImgRef.current.complete) {
        ctx.drawImage(bgImgRef.current, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, width, height); // fallback sky background
      }

      // Draw pipes
      ctx.fillStyle = '#228B22';
      pipes.current.forEach((pipe) => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.gapY);
        // Bottom pipe
        ctx.fillRect(
          pipe.x,
          pipe.gapY + gapHeight,
          pipeWidth,
          height - pipe.gapY - gapHeight
        );
      });

      // Draw bird (image)
      const birdX = width / 4;
      if (birdImgRef.current && birdImgRef.current.complete) {
        ctx.drawImage(
          birdImgRef.current,
          birdX - birdRadius,
          birdY.current - birdRadius,
          birdRadius * 2,
          birdRadius * 2
        );
      } else {
        // Fallback if image not loaded yet
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(birdX, birdY.current, birdRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Loop
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold mb-2">Flappy Bird Mini-Game</h1>
      <p className="text-center text-sm max-w-md">
        Click or press the <kbd className="px-1 py-0.5 border rounded">Space</kbd>{' '}
        key to flap your wings and navigate through the pipes! Your goal is to
        survive as long as possible and rack up points.
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border-2 border-gray-700 bg-sky-200"
        />
        {/* Score Display */}
        <span className="absolute top-2 left-2 text-2xl font-extrabold text-white drop-shadow-md">
          {score}
        </span>
        {/* Overlay messages */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/40 text-white px-4">
            <p className="text-lg font-semibold">Click or press Space to start!</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/60 text-white px-4">
            <p className="text-xl font-bold mb-2">Game Over</p>
            <p className="mb-4">Your score: {score}</p>
            <p className="text-sm">Click or press Space to play again</p>
          </div>
        )}
      </div>
    </div>
  );
} 