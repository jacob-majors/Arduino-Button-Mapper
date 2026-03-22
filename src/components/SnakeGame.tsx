"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL  = 20;
const COLS  = 22;
const ROWS  = 17;
const W     = COLS * CELL; // 440
const H     = ROWS * CELL; // 340

const BG        = "#0f172a";
const GRID_LINE = "#1e293b";
const TEXT_DIM  = "#475569";
const TEXT_MID  = "#94a3b8";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DirectionMap {
  up: string; down: string; left: string; right: string;
}

type Dir = "U" | "D" | "L" | "R";
interface Pt { x: number; y: number; }

interface GameState {
  snake: Pt[];
  food: Pt;
  dir: Dir;
  pending: Dir;
  score: number;
  highScore: number;
  running: boolean;
  dead: boolean;
  tick: number;
}

const OPPOSITE: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };

function newFood(snake: Pt[]): Pt {
  let p: Pt;
  do {
    p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

function initState(hi = 0): GameState {
  const snake = [{ x: 13, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 8 }];
  return {
    snake,
    food: newFood(snake),
    dir: "R", pending: "R",
    score: 0, highScore: hi,
    running: false, dead: false, tick: 0,
  };
}

function stepMs(score: number) {
  return Math.max(80, 190 - score * 4);
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += CELL) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += CELL) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawFood(ctx: CanvasRenderingContext2D, food: Pt, now: number) {
  const pulse = 0.6 + 0.4 * Math.sin(now / 280);
  ctx.save();
  ctx.shadowBlur = 14 * pulse;
  ctx.shadowColor = "#f87171";
  ctx.fillStyle = "#f87171";
  const inset = 4;
  const r = (CELL - inset * 2) / 2;
  const cx = food.x * CELL + CELL / 2;
  const cy = food.y * CELL + CELL / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // shine
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D, snake: Pt[], dir: Dir, dead: boolean) {
  const len = snake.length;
  snake.forEach((p, i) => {
    const t = i / Math.max(len - 1, 1);
    // head: bright lime, tail: deep forest green
    const r = Math.round(74  * (1 - t) + 20 * t);
    const g = Math.round(222 * (1 - t) + 83 * t);
    const b = Math.round(128 * (1 - t) + 45 * t);
    ctx.fillStyle = dead ? `rgb(${Math.round(120*(1-t)+60*t)},${Math.round(120*(1-t)+60*t)},${Math.round(120*(1-t)+60*t)})` : `rgb(${r},${g},${b})`;

    if (i === 0 && !dead) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#4ade80";
    }

    const pad = i === 0 ? 1 : 2;
    ctx.fillRect(p.x * CELL + pad, p.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);

    if (i === 0) {
      // Eyes
      ctx.fillStyle = dead ? "#1e293b" : "#0f172a";
      const s = 3;
      if (dir === "R") {
        ctx.fillRect(p.x * CELL + CELL - 6, p.y * CELL + 4,        s, s);
        ctx.fillRect(p.x * CELL + CELL - 6, p.y * CELL + CELL - 7, s, s);
      } else if (dir === "L") {
        ctx.fillRect(p.x * CELL + 3, p.y * CELL + 4,        s, s);
        ctx.fillRect(p.x * CELL + 3, p.y * CELL + CELL - 7, s, s);
      } else if (dir === "U") {
        ctx.fillRect(p.x * CELL + 4,        p.y * CELL + 3, s, s);
        ctx.fillRect(p.x * CELL + CELL - 7, p.y * CELL + 3, s, s);
      } else {
        ctx.fillRect(p.x * CELL + 4,        p.y * CELL + CELL - 6, s, s);
        ctx.fillRect(p.x * CELL + CELL - 7, p.y * CELL + CELL - 6, s, s);
      }
      if (!dead) ctx.restore();
    }
  });
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number, hi: number) {
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "right";
  if (hi > 0) {
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`HI ${String(hi).padStart(4, "0")}`, W - 72, 16);
  }
  ctx.fillStyle = TEXT_MID;
  ctx.fillText(String(score).padStart(4, "0"), W - 10, 16);
}

function drawStartScreen(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(15,23,42,0.65)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = TEXT_MID;
  ctx.font = "bold 15px monospace";
  ctx.fillText("SNAKE", W / 2, H / 2 - 26);
  ctx.font = "12px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("↑ ↓ ← →  ·  W A S D  ·  joystick", W / 2, H / 2 - 4);
  ctx.fillText("Press any direction to start", W / 2, H / 2 + 16);
}

function drawDeadScreen(ctx: CanvasRenderingContext2D, score: number) {
  ctx.fillStyle = "rgba(15,23,42,0.78)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f87171";
  ctx.font = "bold 17px monospace";
  ctx.fillText("GAME OVER", W / 2, H / 2 - 22);
  ctx.fillStyle = TEXT_MID;
  ctx.font = "13px monospace";
  ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 2);
  ctx.fillStyle = TEXT_DIM;
  ctx.font = "11px monospace";
  ctx.fillText("Press any direction to restart", W / 2, H / 2 + 22);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SnakeGame({ joystickMaps = [] }: { joystickMaps?: DirectionMap[] }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef<GameState>(initState());
  const rafRef      = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  const [score,   setScore]   = useState(0);
  const [dead,    setDead]    = useState(false);
  const [started, setStarted] = useState(false);

  const handleDir = useCallback((d: Dir) => {
    const s = stateRef.current;
    if (s.dead) {
      stateRef.current = initState(s.highScore);
      stateRef.current.running = true;
      stateRef.current.pending = d;
      stateRef.current.dir     = d;
      lastTickRef.current = 0;
      setDead(false); setStarted(true); setScore(0);
      return;
    }
    if (!s.running) { s.running = true; setStarted(true); }
    if (d !== OPPOSITE[s.dir]) s.pending = d;
  }, []);

  // Keyboard / joystick input
  useEffect(() => {
    const KEY_DIR: Record<string, Dir> = {
      ArrowUp: "U", w: "U", W: "U",
      ArrowDown: "D", s: "D", S: "D",
      ArrowLeft: "L", a: "L", A: "L",
      ArrowRight: "R", d: "R", D: "R",
    };
    for (const m of joystickMaps) {
      if (m.up)    KEY_DIR[m.up]    = "U";
      if (m.down)  KEY_DIR[m.down]  = "D";
      if (m.left)  KEY_DIR[m.left]  = "L";
      if (m.right) KEY_DIR[m.right] = "R";
    }
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key];
      if (dir) { e.preventDefault(); handleDir(dir); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDir, joystickMaps]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    function advance(now: number) {
      const s = stateRef.current;
      if (!s.running || s.dead) return;
      if (now - lastTickRef.current < stepMs(s.score)) return;
      lastTickRef.current = now;

      s.dir = s.pending;
      s.tick++;

      const head = s.snake[0];
      const next: Pt = {
        x: head.x + (s.dir === "R" ? 1 : s.dir === "L" ? -1 : 0),
        y: head.y + (s.dir === "D" ? 1 : s.dir === "U" ? -1 : 0),
      };

      // Wall collision
      if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
        s.dead = true;
        if (s.score > s.highScore) s.highScore = s.score;
        setDead(true);
        return;
      }

      // Self collision (skip tail — it will move away)
      if (s.snake.slice(0, -1).some((p) => p.x === next.x && p.y === next.y)) {
        s.dead = true;
        if (s.score > s.highScore) s.highScore = s.score;
        setDead(true);
        return;
      }

      const ate = next.x === s.food.x && next.y === s.food.y;
      s.snake = [next, ...s.snake];
      if (!ate) {
        s.snake.pop();
      } else {
        s.score++;
        s.food = newFood(s.snake);
        setScore(s.score);
      }
    }

    function draw(now: number) {
      const s = stateRef.current;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx);
      drawFood(ctx, s.food, now);
      drawSnake(ctx, s.snake, s.dir, s.dead);
      drawHUD(ctx, s.score, s.highScore);

      if (!s.running && !s.dead) drawStartScreen(ctx);
      if (s.dead)                drawDeadScreen(ctx, s.score);
    }

    function tick(ts: number) {
      advance(ts);
      draw(ts);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-end w-full px-1">
        <span className="text-xs text-gray-500 font-mono">↑↓←→ · WASD · joystick</span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ imageRendering: "pixelated", width: "100%", height: "auto" }}
        className="rounded-xl border border-gray-800 cursor-pointer"
        onClick={() => { if (!stateRef.current.running || stateRef.current.dead) handleDir("R"); }}
      />
    </div>
  );
}
