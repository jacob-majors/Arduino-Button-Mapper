"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const W = 700;
const H = 220;
const GROUND_Y = 178;
const PLAYER = 26;
const SPIKE_W = 22;
const BG = "#0b1220";

type Spike = { x: number; h: number };
type State = {
  running: boolean;
  dead: boolean;
  y: number;
  vy: number;
  rot: number;
  score: number;
  speed: number;
  groundOffset: number;
  spikes: Spike[];
};

function initState(): State {
  return {
    running: false,
    dead: false,
    y: GROUND_Y - PLAYER,
    vy: 0,
    rot: 0,
    score: 0,
    speed: 6.4,
    groundOffset: 0,
    spikes: [],
  };
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function GeometryDashGame({
  jumpKeys,
  onGameOver,
}: {
  jumpKeys: string[];
  onGameOver?: (score: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initState());
  const rafRef = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  const reportedRef = useRef(false);
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.dead) {
      stateRef.current = initState();
      reportedRef.current = false;
      setScore(0);
      setDead(false);
      return;
    }
    if (!s.running) s.running = true;
    if (s.y >= GROUND_Y - PLAYER - 1) {
      s.vy = -11.2;
    }
  }, []);

  useEffect(() => {
    const allowed = new Set([" ", "ArrowUp", "w", "W", ...jumpKeys]);
    const onKey = (e: KeyboardEvent) => {
      if (!allowed.has(e.key)) return;
      e.preventDefault();
      jump();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, jumpKeys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    ctx.scale(dpr, dpr);

    let last = 0;
    const tick = (ts: number) => {
      const s = stateRef.current;
      const dt = Math.min(ts - last || 16, 32);
      last = ts;

      ctx.clearRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0f172a");
      sky.addColorStop(1, "#111827");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#152238";
      for (let i = 0; i < 7; i++) {
        ctx.fillRect((i * 110 - (s.groundOffset % 110)), 28 + (i % 2) * 14, 54, 10);
      }

      if (s.running && !s.dead) {
        s.speed = Math.min(s.speed + 0.0009 * dt, 11);
        s.score += dt * 0.02;
        s.groundOffset += s.speed * (dt / 16);
        s.vy += 0.58 * (dt / 16);
        s.y += s.vy * (dt / 16);
        s.rot += 0.12 * (dt / 16);

        if (s.y >= GROUND_Y - PLAYER) {
          s.y = GROUND_Y - PLAYER;
          s.vy = 0;
          s.rot = 0;
        }

        const lastSpike = s.spikes[s.spikes.length - 1];
        if (!lastSpike || lastSpike.x < W - rand(170, 280)) {
          if (Math.random() < 0.026) {
            s.spikes.push({ x: W + 30, h: rand(18, 42) });
          }
        }
        s.spikes = s.spikes
          .map((spike) => ({ ...spike, x: spike.x - s.speed * (dt / 16) }))
          .filter((spike) => spike.x > -SPIKE_W - 20);

        const box = { x: 90, y: s.y, w: PLAYER, h: PLAYER };
        for (const spike of s.spikes) {
          const hit =
            box.x < spike.x + SPIKE_W - 4 &&
            box.x + box.w > spike.x + 4 &&
            box.y + box.h > GROUND_Y - spike.h &&
            box.y < GROUND_Y;
          if (hit) {
            s.dead = true;
            setDead(true);
            if (!reportedRef.current) {
              reportedRef.current = true;
              onGameOverRef.current?.(Math.floor(s.score));
            }
          }
        }
        setScore(Math.floor(s.score));
      }

      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 1);
      ctx.lineTo(W, GROUND_Y + 1);
      ctx.stroke();

      ctx.fillStyle = "#0f213b";
      for (let x = -(s.groundOffset % 30); x < W; x += 30) {
        ctx.fillRect(x, GROUND_Y + 6, 18, 8);
      }

      for (const spike of s.spikes) {
        ctx.beginPath();
        ctx.moveTo(spike.x, GROUND_Y);
        ctx.lineTo(spike.x + SPIKE_W / 2, GROUND_Y - spike.h);
        ctx.lineTo(spike.x + SPIKE_W, GROUND_Y);
        ctx.closePath();
        ctx.fillStyle = "#f472b6";
        ctx.fill();
      }

      ctx.save();
      ctx.translate(103, s.y + PLAYER / 2);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.dead ? "#fb7185" : "#22d3ee";
      ctx.fillRect(-PLAYER / 2, -PLAYER / 2, PLAYER, PLAYER);
      ctx.fillStyle = "#082f49";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = "#ecfeff";
      ctx.fillRect(4, -7, 4, 4);
      ctx.restore();

      ctx.fillStyle = "#7dd3fc";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(Math.floor(s.score)).padStart(5, "0"), W - 18, 24);

      if (!s.running && !s.dead) {
        ctx.fillStyle = "rgba(4,12,24,0.72)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("GEOMETRY DASH", W / 2, H / 2 - 12);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px monospace";
        ctx.fillText("Press jump to start", W / 2, H / 2 + 14);
      }

      if (s.dead) {
        ctx.fillStyle = "rgba(4,12,24,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fda4af";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("CRASHED", W / 2, H / 2 - 10);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "12px monospace";
        ctx.fillText("Press jump to restart", W / 2, H / 2 + 16);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center justify-end w-full px-1">
        <span className="text-xs text-cyan-300/70 font-mono">{dead ? `score ${score}` : "jump over spikes"}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="rounded-xl border border-cyan-900/40 cursor-pointer"
        style={{ width: "100%", imageRendering: "pixelated", background: BG }}
        onClick={jump}
      />
    </div>
  );
}
