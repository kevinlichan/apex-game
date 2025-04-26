'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * A lightweight Pac-Man-style mini-game rendered on an HTML5 canvas.
 *
 * Gameplay (very simplified):
 *   • Move Pac-Man with the arrow keys / WASD.
 *   • Eat as many cherries as you can to score points.
 *   • Do NOT collide with the roaming ghost – it ends the game.
 *   • Click the canvas or press any arrow / WASD key to start. After a game-over, do the same to restart.
 *
 *  Graphics are taken from the public folder:
 *   /Pacman.svg, /cherry.svg, /ghost.svg.
 */
export default function PacmanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ---------- React state ----------- */
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  /* ---------- Game constants ----------- */
  const width = 500;
  const height = 500;

  // Actor sizes (in px)
  const PAC_SIZE = 34; // drawn at 34×34 so that the 30-ish sprite fits neatly
  const GHOST_SIZE = 34;
  const CHERRY_SIZE = 26;
  const APEX_SIZE = 36;

  // Speeds (px per frame)
  const PAC_SPEED = 3.2;
  const GHOST_SPEED = 2.0;
  const CHASE_RADIUS = 150;

  /* ---------- Static barriers (walls/obstacles) ----------- */
  // Four rectangles forming a square hoop in the center
  const barriers = [
    { x: width / 2 - 60, y: height / 2 - 120, w: 120, h: 10 }, // top horizontal
    { x: width / 2 - 60, y: height / 2 + 100, w: 120, h: 10 }, // bottom horizontal
    { x: width / 2 - 120, y: height / 2 - 60, w: 10, h: 120 }, // left vertical
    { x: width / 2 + 110, y: height / 2 - 60, w: 10, h: 120 }, // right vertical

    // Side vertical bars
    { x: 50, y: 150, w: 10, h: 200 }, // left bar
    { x: width - 60, y: 150, w: 10, h: 200 }, // right bar
    // Top and bottom horizontal bars
    { x: 150, y: 40, w: 200, h: 10 }, // top bar
    { x: 150, y: height - 70, w: 200, h: 10 }, // bottom bar
    // Frame walls (10px thick)
    { x: 0, y: 0, w: width, h: 10 }, // top wall
    { x: 0, y: height - 10, w: width, h: 10 }, // bottom wall
    { x: 0, y: 0, w: 10, h: height }, // left wall
    { x: width - 10, y: 0, w: 10, h: height }, // right wall
  ];

  // Helper to test AABB collision with a barrier
  const collidesBarrier = (x: number, y: number, size: number) =>
    barriers.some(
      (b) => x < b.x + b.w && x + size > b.x && y < b.y + b.h && y + size > b.y
    );

  /* ---------- Mutable refs that survive re-renders ----------- */
  const pacman = useRef({ x: width / 2, y: height / 2, dx: 0, dy: 0 });

  /* ---------- Ghosts ----------- */
  type Ghost = {
    x: number;
    y: number;
    dx: number;
    dy: number;
    vulnerableUntil: number; // timestamp (ms) until which ghost is vulnerable
    eatenUntil: number; // timestamp (ms) until which ghost is hidden (after being eaten)
  };
  const NUM_GHOSTS = 3;
  const ghosts = useRef<Ghost[]>([]);
  const cherries = useRef<{ x: number; y: number }[]>([]);
  const animationRef = useRef<number | null>(null);
  const apexRef = useRef<{ x: number; y: number } | null>(null);
  const apexRespawnAt = useRef<number>(0);

  /* ---------- Image assets ----------- */
  const pacImgRef = useRef<HTMLImageElement | null>(null);
  const ghostImgRef = useRef<HTMLImageElement | null>(null);
  const ghostWhiteImgRef = useRef<HTMLImageElement | null>(null);
  const cherryImgRef = useRef<HTMLImageElement | null>(null);
  const apexImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Preload images only once
    const pac = new Image();
    pac.src = '/Pacman.svg';
    pacImgRef.current = pac;

    const gh = new Image();
    gh.src = '/ghost.svg';
    ghostImgRef.current = gh;

    const ghWhite = new Image();
    ghWhite.src = '/ghost_white.svg';
    ghostWhiteImgRef.current = ghWhite;

    const ch = new Image();
    ch.src = '/cherry.svg';
    cherryImgRef.current = ch;

    const apexImg = new Image();
    apexImg.src = '/apex.png';
    apexImgRef.current = apexImg;
  }, []);

  /* ---------- Helper functions ----------- */
  const randomPos = (size: number) => {
    let pos;
    // Keep generating positions until the item does not spawn inside a barrier
    do {
      pos = {
        x: Math.random() * (width - size),
        y: Math.random() * (height - size),
      };
    } while (collidesBarrier(pos.x, pos.y, size));
    return pos;
  };

  const spawnCherries = (count = 5) => {
    const arr = new Array(count).fill(0).map(() => randomPos(CHERRY_SIZE));
    cherries.current = arr;
  };

  // Spawn ghosts helper
  const spawnGhosts = () => {
    ghosts.current = Array.from({ length: NUM_GHOSTS }, () => {
      const pos = randomPos(GHOST_SIZE);
      const angle = Math.random() * Math.PI * 2;
      return {
        x: pos.x,
        y: pos.y,
        dx: Math.cos(angle) * GHOST_SPEED,
        dy: Math.sin(angle) * GHOST_SPEED,
        vulnerableUntil: 0,
        eatenUntil: 0,
      } as Ghost;
    });
  };

  // Spawn apex helper
  const spawnApex = () => {
    apexRef.current = randomPos(APEX_SIZE);
  };

  // Initial spawn of cherries and ghosts
  useEffect(() => {
    spawnCherries();
    spawnGhosts();
    spawnApex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Reset game ----------- */
  const resetGame = () => {
    pacman.current = { x: width / 2, y: height / 2, dx: 0, dy: 0 };
    spawnGhosts();
    spawnCherries();
    setScore(0);
    setGameOver(false);
    setStarted(false);
  };

  /* ---------- Controls ----------- */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const code = e.code;
      if (!started && !gameOver) {
        setStarted(true);
      }
      if (gameOver) {
        resetGame();
        setStarted(true);
        return;
      }
      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
          pacman.current.dy = -PAC_SPEED;
          pacman.current.dx = 0;
          break;
        case 'ArrowDown':
        case 'KeyS':
          pacman.current.dy = PAC_SPEED;
          pacman.current.dx = 0;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          pacman.current.dx = -PAC_SPEED;
          pacman.current.dy = 0;
          break;
        case 'ArrowRight':
        case 'KeyD':
          pacman.current.dx = PAC_SPEED;
          pacman.current.dy = 0;
          break;
      }
    };
    window.addEventListener('keydown', handleKey);

    const canvas = canvasRef.current;
    const handleClick = () => {
      if (!started) {
        setStarted(true);
      } else if (gameOver) {
        resetGame();
        setStarted(true);
      }
    };
    canvas?.addEventListener('mousedown', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKey);
      canvas?.removeEventListener('mousedown', handleClick);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, started]);

  /* ---------- Main game loop ----------- */
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // ---- Update logic ----
      if (started && !gameOver) {
        // Pac-Man movement with barrier collision check
        const prevPacX = pacman.current.x;
        const prevPacY = pacman.current.y;
        pacman.current.x += pacman.current.dx;
        pacman.current.y += pacman.current.dy;

        if (collidesBarrier(pacman.current.x, pacman.current.y, PAC_SIZE)) {
          // Revert movement if hitting barrier
          pacman.current.x = prevPacX;
          pacman.current.y = prevPacY;
          pacman.current.dx = 0;
          pacman.current.dy = 0;
        }

        // Keep Pac-Man inside frame walls (prevent leaving play area)
        if (pacman.current.x < 10) pacman.current.x = 10;
        if (pacman.current.x > width - PAC_SIZE - 10) pacman.current.x = width - PAC_SIZE - 10;
        if (pacman.current.y < 10) pacman.current.y = 10;
        if (pacman.current.y > height - PAC_SIZE - 10) pacman.current.y = height - PAC_SIZE - 10;

        const now = Date.now();

        // Ghosts movement
        ghosts.current.forEach((g) => {
          if (now < g.eatenUntil) {
            // Skip movement & drawing when ghost is eaten
            return;
          }

          const prevX = g.x;
          const prevY = g.y;
         
          g.x += g.dx;
          g.y += g.dy;

          // Bounce off canvas edges
          if (g.x < 0) {
            g.x = 0;
            g.dx *= -1;
          } else if (g.x > width - GHOST_SIZE) {
            g.x = width - GHOST_SIZE;
            g.dx *= -1;
          }
          if (g.y < 0) {
            g.y = 0;
            g.dy *= -1;
          } else if (g.y > height - GHOST_SIZE) {
            g.y = height - GHOST_SIZE;
            g.dy *= -1;
          }

          if (collidesBarrier(g.x, g.y, GHOST_SIZE)) {
            g.x = prevX;
            g.y = prevY;
            g.dx *= -1;
            g.dy *= -1;
          }

          // Chase Pac-Man if nearby and ghost is not vulnerable
          const distToPac = Math.hypot(
            pacman.current.x - g.x,
            pacman.current.y - g.y
          );
          if (distToPac < CHASE_RADIUS && now >= g.vulnerableUntil) {
            const angleToPac = Math.atan2(
              pacman.current.y - g.y,
              pacman.current.x - g.x
            );
            g.dx = Math.cos(angleToPac) * GHOST_SPEED;
            g.dy = Math.sin(angleToPac) * GHOST_SPEED;
          } else if (Math.random() < 0.02) {
            // Randomly change direction when not chasing
            const ang = Math.random() * Math.PI * 2;
            g.dx = Math.cos(ang) * GHOST_SPEED;
            g.dy = Math.sin(ang) * GHOST_SPEED;
          }
        });

        // Check cherry collisions
        cherries.current = cherries.current.filter((cherry) => {
          const dist = Math.hypot(
            (pacman.current.x + PAC_SIZE / 2) - (cherry.x + CHERRY_SIZE / 2),
            (pacman.current.y + PAC_SIZE / 2) - (cherry.y + CHERRY_SIZE / 2)
          );
          const eaten = dist < (PAC_SIZE + CHERRY_SIZE) / 2;
          if (eaten) {
            setScore((s) => s + 1);
          }
          return !eaten;
        });
        // Ensure there are always cherries to eat
        while (cherries.current.length < 5) {
          cherries.current.push(randomPos(CHERRY_SIZE));
        }

        // Apex collision
        if (apexRef.current) {
          const d = Math.hypot(
            pacman.current.x + PAC_SIZE / 2 - (apexRef.current.x + APEX_SIZE / 2),
            pacman.current.y + PAC_SIZE / 2 - (apexRef.current.y + APEX_SIZE / 2)
          );
          if (d < (PAC_SIZE + APEX_SIZE) / 2) {
            apexRef.current = null;
            apexRespawnAt.current = Date.now() + 15000; // respawn in 15s
            const vulnerableUntil = Date.now() + 10000; // 10s
            ghosts.current.forEach((g) => {
              g.vulnerableUntil = vulnerableUntil;
            });
          }
        }

        // Handle apex respawn
        if (!apexRef.current && now > apexRespawnAt.current) {
          spawnApex();
        }

        // Check ghost collision
        ghosts.current.forEach((g) => {
          if (now < g.eatenUntil) return; // ignore inactive ghosts

          const dist = Math.hypot(
            pacman.current.x + PAC_SIZE / 2 - (g.x + GHOST_SIZE / 2),
            pacman.current.y + PAC_SIZE / 2 - (g.y + GHOST_SIZE / 2)
          );

          if (dist < (PAC_SIZE + GHOST_SIZE) / 2) {
            if (now < g.vulnerableUntil) {
              // Pac-Man eats ghost
              setScore((s) => s + 10);
              g.eatenUntil = now + 2000; // hide for 2s
              g.x = width / 2 - GHOST_SIZE / 2;
              g.y = height / 2 - GHOST_SIZE / 2;
              // reset direction
              const ang = Math.random() * Math.PI * 2;
              g.dx = Math.cos(ang) * GHOST_SPEED;
              g.dy = Math.sin(ang) * GHOST_SPEED;
            } else {
              // Pac-Man hit active ghost -> game over
              setGameOver(true);
            }
          }
        });
      }

      // ---- Draw section ----
      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // Draw cherries
      cherries.current.forEach((cherry) => {
        if (cherryImgRef.current && cherryImgRef.current.complete) {
          ctx.drawImage(cherryImgRef.current, cherry.x, cherry.y, CHERRY_SIZE, CHERRY_SIZE);
        } else {
          ctx.fillStyle = '#ff001b';
          ctx.beginPath();
          ctx.arc(cherry.x + CHERRY_SIZE / 2, cherry.y + CHERRY_SIZE / 2, CHERRY_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw ghosts
      ghosts.current.forEach((g) => {
        if (Date.now() < g.eatenUntil) return; // skip drawing when eaten

        const isVulnerable = Date.now() < g.vulnerableUntil;
        const imgToUse = isVulnerable && ghostWhiteImgRef.current && ghostWhiteImgRef.current.complete
          ? ghostWhiteImgRef.current
          : ghostImgRef.current;
        if (imgToUse && imgToUse.complete) {
          ctx.drawImage(imgToUse, g.x, g.y, GHOST_SIZE, GHOST_SIZE);
        } else {
          ctx.fillStyle = isVulnerable ? '#ffffff' : '#ff001b';
          ctx.fillRect(g.x, g.y, GHOST_SIZE, GHOST_SIZE);
        }
      });

      // Draw Pac-Man
      if (pacImgRef.current && pacImgRef.current.complete) {
        ctx.drawImage(pacImgRef.current, pacman.current.x, pacman.current.y, PAC_SIZE, PAC_SIZE);
      } else {
        ctx.fillStyle = '#ffd65b';
        ctx.beginPath();
        ctx.arc(pacman.current.x + PAC_SIZE / 2, pacman.current.y + PAC_SIZE / 2, PAC_SIZE / 2, 0.25 * Math.PI, 1.75 * Math.PI);
        ctx.lineTo(pacman.current.x + PAC_SIZE / 2, pacman.current.y + PAC_SIZE / 2);
        ctx.fill();
      }

      // Draw barriers
      ctx.fillStyle = '#0033cc';
      barriers.forEach((b) => {
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      // Draw Apex power-up
      if (apexRef.current) {
        if (apexImgRef.current && apexImgRef.current.complete) {
          ctx.drawImage(
            apexImgRef.current,
            apexRef.current.x,
            apexRef.current.y,
            APEX_SIZE,
            APEX_SIZE
          );
        } else {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(
            apexRef.current.x + APEX_SIZE / 2,
            apexRef.current.y + APEX_SIZE / 2,
            APEX_SIZE / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Loop
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  /* ---------- React render ----------- */
  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold mb-2">Pac-Man Mini-Game</h1>
      <p className="text-center text-sm max-w-md">
        Use the arrow keys (or WASD) to move Pac-Man around, collect cherries, and
        avoid the ghosts!
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border-2 border-yellow-400 bg-black"
        />
        {/* Score */}
        <span className="absolute top-2 left-2 text-2xl font-extrabold text-yellow-300 drop-shadow-md">
          {score}
        </span>
        {/* Overlay messages */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/40 text-white px-4 select-none">
            <p className="text-lg font-semibold">Click or press an arrow key to start!</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/60 text-white px-4 select-none">
            <p className="text-xl font-bold mb-2">Game Over</p>
            <p className="mb-4">Your score: {score}</p>
            <p className="text-sm">Click or press an arrow key to play again</p>
          </div>
        )}
      </div>
    </div>
  );
} 