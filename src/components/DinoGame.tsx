"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const FPS = 60;
const GAME_H = 150;
const GROUND_Y = 127;
const BOTTOM_PAD = 10;
const BG = "#f7f7f7";
const FG = "#535353";
const DINO_W = 44;
const DINO_H = 47;
const DINO_DUCK_H = 26;
const DINO_X = 50;
const GRAVITY = 0.6;
const JUMP_V = -12;
const SPEED_DROP = 3;

function groundDinoY() { return GROUND_Y - DINO_H - BOTTOM_PAD; }

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  legFrame: number,
  crashed: boolean,
  ducking: boolean
) {
  ctx.fillStyle = FG;

  if (ducking && !crashed) {
    // Low body
    ctx.fillRect(x + 2,  y + 10, 34, 16);
    // Head
    ctx.fillRect(x + 26, y,      18, 14);
    // Eye
    ctx.fillStyle = BG;
    ctx.fillRect(x + 36, y + 3,  5, 5);
    ctx.fillStyle = FG;
    ctx.fillRect(x + 37, y + 4,  3, 3);
    // Tail
    ctx.fillRect(x,      y + 12, 8, 6);
    // Legs
    if (legFrame === 0) {
      ctx.fillRect(x + 8,  y + 24, 8, 12); ctx.fillRect(x + 6,  y + 34, 10, 4);
      ctx.fillRect(x + 20, y + 24, 8,  6); ctx.fillRect(x + 18, y + 28,  9, 4);
    } else {
      ctx.fillRect(x + 8,  y + 24, 8,  6); ctx.fillRect(x + 6,  y + 28,  9, 4);
      ctx.fillRect(x + 20, y + 24, 8, 12); ctx.fillRect(x + 20, y + 34, 10, 4);
    }
    return;
  }

  // Body
  ctx.fillRect(x + 12, y + 14, 24, 18);
  // Neck
  ctx.fillRect(x + 22, y + 8,  10,  8);
  // Head
  ctx.fillRect(x + 18, y,      24, 14);
  // Mouth cutout
  ctx.fillStyle = BG;
  ctx.fillRect(x + 36, y + 8,   6,  4);
  // Eye
  ctx.fillRect(x + 26, y + 2,   6,  6);
  ctx.fillStyle = FG;
  if (crashed) {
    // X eyes
    ctx.fillRect(x + 26, y + 2, 2, 2); ctx.fillRect(x + 30, y + 6, 2, 2);
    ctx.fillRect(x + 30, y + 2, 2, 2); ctx.fillRect(x + 26, y + 6, 2, 2);
  } else {
    ctx.fillRect(x + 28, y + 4,  3,  3);
  }
  // Tail
  ctx.fillRect(x,       y + 18, 14,  8);
  ctx.fillRect(x + 2,   y + 24,  8,  4);
  // Arms
  ctx.fillRect(x + 18,  y + 22,  8,  4);
  // Legs
  if (crashed) {
    ctx.fillRect(x + 12, y + 32,  8, 10); ctx.fillRect(x + 8,  y + 40, 12, 4);
    ctx.fillRect(x + 24, y + 32,  8, 10); ctx.fillRect(x + 26, y + 40, 12, 4);
  } else if (legFrame === 0) {
    ctx.fillRect(x + 12, y + 32,  8, 12); ctx.fillRect(x + 8,  y + 42, 12, 4);
    ctx.fillRect(x + 24, y + 32,  8,  6); ctx.fillRect(x + 22, y + 36,  8, 4);
  } else {
    ctx.fillRect(x + 12, y + 32,  8,  6); ctx.fillRect(x + 10, y + 36,  8, 4);
    ctx.fillRect(x + 24, y + 32,  8, 12); ctx.fillRect(x + 24, y + 42, 12, 4);
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, large: boolean, count: number) {
  ctx.fillStyle = FG;
  const W = large ? 25 : 17;
  const H = large ? 50 : 35;
  const stemW = large ? 7 : 5;
  const armH = large ? 20 : 14;
  const armY = large ? 12 : 8;
  const armW = large ? 8 : 6;
  const y = GROUND_Y - H - BOTTOM_PAD;

  for (let i = 0; i < count; i++) {
    const cx = x + i * (W + 4);
    const stemX = cx + (W - stemW) / 2;
    ctx.fillRect(stemX, y, stemW, H);                  // main stem
    ctx.fillRect(cx, y + armY, armW, armH);            // left arm
    ctx.fillRect(cx, y + armY, armW, 4);               // left arm top
    ctx.fillRect(cx, y + armY + armH - 4, armW + stemW / 2, 4); // left junction
    const rx = cx + W - armW;
    ctx.fillRect(rx, y + armY, armW, armH);            // right arm
    ctx.fillRect(rx, y + armY, armW, 4);
    ctx.fillRect(rx - stemW / 2, y + armY + armH - 4, armW + stemW / 2, 4);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ccc";
  ctx.fillRect(x + 8, y + 4, 30, 6);
  ctx.fillRect(x + 4, y + 6, 38, 6);
  ctx.fillRect(x,     y + 8, 46, 4);
  ctx.fillRect(x + 10, y,    12, 6);
  ctx.fillRect(x + 22, y + 2, 14, 4);
}

function drawGround(ctx: CanvasRenderingContext2D, offset: number, W: number) {
  ctx.fillStyle = FG;
  ctx.fillRect(0, GROUND_Y, W, 1);
  ctx.fillStyle = "#bbb";
  for (let x = -(offset % 60); x < W; x += 60) {
    ctx.fillRect(x,      GROUND_Y + 4, 16, 2);
    ctx.fillRect(x + 30, GROUND_Y + 8,  8, 1);
    ctx.fillRect(x + 10, GROUND_Y + 10, 4, 1);
  }
}

function drawScore(ctx: CanvasRenderingContext2D, score: number, hi: number, W: number) {
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "right";
  if (hi > 0) {
    ctx.fillStyle = "#aaa";
    ctx.fillText(`HI ${String(hi).padStart(5, "0")}`, W - 80, 20);
  }
  ctx.fillStyle = FG;
  ctx.fillText(String(score).padStart(5, "0"), W - 16, 20);
}

function drawGameOver(ctx: CanvasRenderingContext2D, W: number) {
  ctx.fillStyle = FG;
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", W / 2, GAME_H / 2 - 18);
  // Restart icon (two triangles + circle)
  ctx.beginPath();
  const cx = W / 2, cy = GAME_H / 2 + 6;
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.strokeStyle = FG; ctx.lineWidth = 2;
  ctx.stroke();
  // Arrow
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy - 8); ctx.lineTo(cx, cy + 6);
  ctx.closePath(); ctx.fill();
}

// ─── Game State ───────────────────────────────────────────────────────────────

interface Cactus { x: number; large: boolean; count: number; }
interface CloudObj { x: number; y: number; }

interface State {
  running: boolean; crashed: boolean;
  dinoY: number; dinoVY: number; onGround: boolean;
  ducking: boolean; legFrame: number; legTimer: number;
  obstacles: Cactus[]; clouds: CloudObj[];
  score: number; highScore: number;
  speed: number; runningTime: number; groundOffset: number;
}

function mkState(hi = 0): State {
  return {
    running: false, crashed: false,
    dinoY: groundDinoY(), dinoVY: 0, onGround: true,
    ducking: false, legFrame: 0, legTimer: 0,
    obstacles: [],
    clouds: [{ x: 200, y: 25 }, { x: 450, y: 12 }],
    score: 0, highScore: hi,
    speed: 6, runningTime: 0, groundOffset: 0,
  };
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DinoGame({ jumpKeys }: { jumpKeys: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(mkState());
  const duckRef = useRef(false);
  const speedDropRef = useRef(false);
  const rafRef = useRef<number>(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [isDead, setIsDead] = useState(false);
  const [started, setStarted] = useState(false);

  const doJump = useCallback(() => {
    const s = stateRef.current;
    if (s.crashed) {
      stateRef.current = mkState(s.highScore);
      duckRef.current = false; speedDropRef.current = false;
      setIsDead(false); setStarted(true);
      return;
    }
    if (!s.running) { stateRef.current.running = true; setStarted(true); }
    if (s.onGround && !s.ducking) {
      stateRef.current.dinoVY = JUMP_V;
      stateRef.current.onGround = false;
      speedDropRef.current = false;
    }
  }, []);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown"," ","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowDown") {
        duckRef.current = true; stateRef.current.ducking = true;
        if (!stateRef.current.onGround) {
          speedDropRef.current = true;
          stateRef.current.dinoVY = Math.abs(stateRef.current.dinoVY);
        }
      }
      if (e.key === " " || e.key === "ArrowUp" || jumpKeys.includes(e.key)) doJump();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        duckRef.current = false; stateRef.current.ducking = false; speedDropRef.current = false;
      }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [doJump, jumpKeys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let last = 0;

    // Scale canvas for DPR
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 700 * dpr;
    canvas.height = GAME_H * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${GAME_H}px`;
    ctx.scale(dpr, dpr);
    const W = 700;

    function tick(ts: number) {
      const dt = Math.min(ts - last, 50);
      last = ts;
      const s = stateRef.current;
      s.ducking = duckRef.current;

      // Clear
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, GAME_H);

      if (s.running && !s.crashed) {
        s.runningTime += dt;
        s.groundOffset += s.speed * (dt / (1000 / FPS));
        s.speed = Math.min(s.speed + 0.001 * dt, 12);
        s.score = Math.floor(s.runningTime * 0.025);
        if (s.score > s.highScore) s.highScore = s.score;

        // Leg animation
        s.legTimer += dt;
        if (s.legTimer > 1000 / 12) { s.legFrame ^= 1; s.legTimer = 0; }

        // Physics
        if (!s.onGround) {
          const g = GRAVITY * (speedDropRef.current ? SPEED_DROP : 1);
          s.dinoVY += g * (dt / (1000 / FPS));
          s.dinoY  += s.dinoVY * (dt / (1000 / FPS));
          if (s.dinoY >= groundDinoY()) {
            s.dinoY = groundDinoY(); s.dinoVY = 0; s.onGround = true;
            speedDropRef.current = false;
          }
        }

        // Spawn cactus (after 3s)
        if (s.runningTime > 3000) {
          const lastObs = s.obstacles[s.obstacles.length - 1];
          const minGap = Math.max(200, 400 - s.speed * 14);
          if (!lastObs || lastObs.x < W - minGap) {
            if (Math.random() < 0.018) {
              s.obstacles.push({ x: W + 10, large: Math.random() < 0.4, count: Math.random() < 0.35 ? 2 : 1 });
            }
          }
        }
        s.obstacles = s.obstacles
          .map(o => ({ ...o, x: o.x - s.speed * (dt / (1000 / FPS)) }))
          .filter(o => o.x > -60);

        // Clouds
        if (!s.clouds.length || s.clouds[s.clouds.length - 1].x < W - rnd(250, 550))
          s.clouds.push({ x: W, y: rnd(8, 55) });
        s.clouds = s.clouds
          .map(c => ({ ...c, x: c.x - s.speed * 0.3 * (dt / (1000 / FPS)) }))
          .filter(c => c.x > -60);

        // Collision
        const duck = s.ducking && s.onGround;
        const dH = duck ? DINO_DUCK_H : DINO_H;
        const dinoBox = { x: DINO_X + 8, y: s.dinoY + 4 + (duck ? DINO_H - DINO_DUCK_H : 0), w: DINO_W - 16, h: dH - 8 };
        for (const obs of s.obstacles) {
          const obsW = (obs.large ? 25 : 17) * obs.count + (obs.count > 1 ? 4 * (obs.count - 1) : 0);
          const obsH = obs.large ? 50 : 35;
          const obsY = GROUND_Y - obsH - BOTTOM_PAD;
          const obsBox = { x: obs.x + 2, y: obsY + 4, w: obsW - 4, h: obsH - 6 };
          if (dinoBox.x < obsBox.x + obsBox.w && dinoBox.x + dinoBox.w > obsBox.x &&
              dinoBox.y < obsBox.y + obsBox.h && dinoBox.y + dinoBox.h > obsBox.y) {
            s.crashed = true; setIsDead(true); break;
          }
        }
        setDisplayScore(s.score);
      }

      // ── Draw ──
      s.clouds.forEach(c => drawCloud(ctx, c.x, c.y));
      drawGround(ctx, s.groundOffset, W);
      s.obstacles.forEach(o => drawCactus(ctx, o.x, o.large, o.count));

      const duck = s.ducking && s.onGround;
      const drawY = duck ? s.dinoY + (DINO_H - DINO_DUCK_H) : s.dinoY;
      drawDino(ctx, DINO_X, drawY, s.legFrame, s.crashed, duck);
      drawScore(ctx, s.score, s.highScore, W);

      if (!s.running && !s.crashed) {
        ctx.fillStyle = "#888"; ctx.font = "13px monospace"; ctx.textAlign = "center";
        ctx.fillText("Press Space / ↑ to start  ·  ↓ to duck", W / 2, GAME_H / 2 + 4);
      }
      if (s.crashed) drawGameOver(ctx, W);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-between w-full px-1">
        <span className="text-xs text-gray-400 font-mono">
          {!started ? "waiting" : isDead ? "game over" : "running"}
        </span>
        <span className="text-xs text-gray-400 font-mono">
          {displayScore > 0 ? "" : "↑ jump · ↓ duck"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", imageRendering: "pixelated", background: BG }}
        className="rounded-xl border border-gray-200 cursor-pointer"
        onClick={doJump}
      />
    </div>
  );
}
