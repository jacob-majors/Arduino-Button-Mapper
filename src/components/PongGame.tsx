"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const W = 600, H = 360;
const PAD_W = 10, PAD_H = 70, BALL_R = 7;
const PLAYER_X = 18, CPU_X = W - 18 - PAD_W;
const PAD_SPEED = 5, BALL_SPEED_INIT = 4.5;

interface State {
  py: number; cy: number;
  bx: number; by: number;
  vx: number; vy: number;
  ps: number; cs: number;
  trail: { x: number; y: number }[];
  running: boolean;
}

function initState(): State {
  const angle = (Math.random() * 0.6 - 0.3);
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    py: H / 2 - PAD_H / 2, cy: H / 2 - PAD_H / 2,
    bx: W / 2, by: H / 2,
    vx: dir * BALL_SPEED_INIT * Math.cos(angle),
    vy: BALL_SPEED_INIT * Math.sin(angle),
    ps: 0, cs: 0,
    trail: [],
    running: false,
  };
}

export default function PongGame({ joystickMaps, onGameOver }: { joystickMaps?: { up: string[]; down: string[] }; onGameOver?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(initState());
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  const [scores, setScores] = useState({ p: 0, c: 0 });
  const [started, setStarted] = useState(false);
  const [winner, setWinner] = useState<"you" | "cpu" | null>(null);

  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const upKeys = ["ArrowUp", "w", "W", ...(joystickMaps?.up ?? [])];
  const downKeys = ["ArrowDown", "s", "S", ...(joystickMaps?.down ?? [])];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = stateRef.current;

    // Background
    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, W, H);

    // Centre dashed line
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);

    // Ball trail
    s.trail.forEach((t, i) => {
      const a = (i / s.trail.length) * 0.25;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * (i / s.trail.length) * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,92,246,${a})`;
      ctx.fill();
    });

    // Ball glow
    const grd = ctx.createRadialGradient(s.bx, s.by, 0, s.bx, s.by, BALL_R * 3);
    grd.addColorStop(0, "rgba(167,139,250,0.35)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s.bx, s.by, BALL_R * 3, 0, Math.PI * 2); ctx.fill();

    // Ball
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath(); ctx.arc(s.bx, s.by, BALL_R, 0, Math.PI * 2); ctx.fill();

    // Player paddle (left)
    const pGrd = ctx.createLinearGradient(PLAYER_X, s.py, PLAYER_X + PAD_W, s.py);
    pGrd.addColorStop(0, "#60a5fa");
    pGrd.addColorStop(1, "#3b82f6");
    ctx.fillStyle = pGrd;
    ctx.shadowColor = "#60a5fa";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(PLAYER_X, s.py, PAD_W, PAD_H, 4);
    ctx.fill();

    // CPU paddle (right)
    const cGrd = ctx.createLinearGradient(CPU_X, s.cy, CPU_X + PAD_W, s.cy);
    cGrd.addColorStop(0, "#f87171");
    cGrd.addColorStop(1, "#ef4444");
    ctx.fillStyle = cGrd;
    ctx.shadowColor = "#f87171";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(CPU_X, s.cy, PAD_W, PAD_H, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Score
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#374151";
    ctx.fillText(String(s.ps), W / 2 - 50, 40);
    ctx.fillText(String(s.cs), W / 2 + 50, 40);

    // Labels
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("YOU", W / 2 - 50, 55);
    ctx.fillText("CPU", W / 2 + 50, 55);
  }, []);

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) { draw(); return; }

    // Player movement
    if (upKeys.some((k) => keysRef.current.has(k))) s.py = Math.max(0, s.py - PAD_SPEED);
    if (downKeys.some((k) => keysRef.current.has(k))) s.py = Math.min(H - PAD_H, s.py + PAD_SPEED);

    // CPU AI (tracks ball with slight lag)
    const cpuCenter = s.cy + PAD_H / 2;
    const diff = s.by - cpuCenter;
    const cpuMove = Math.min(Math.abs(diff), PAD_SPEED * 0.82) * Math.sign(diff);
    s.cy = Math.max(0, Math.min(H - PAD_H, s.cy + cpuMove));

    // Ball trail
    s.trail.push({ x: s.bx, y: s.by });
    if (s.trail.length > 8) s.trail.shift();

    // Move ball
    s.bx += s.vx;
    s.by += s.vy;

    // Top/bottom bounce
    if (s.by - BALL_R <= 0) { s.by = BALL_R; s.vy = Math.abs(s.vy); }
    if (s.by + BALL_R >= H) { s.by = H - BALL_R; s.vy = -Math.abs(s.vy); }

    // Player paddle collision
    if (
      s.vx < 0 &&
      s.bx - BALL_R <= PLAYER_X + PAD_W &&
      s.bx + BALL_R >= PLAYER_X &&
      s.by >= s.py && s.by <= s.py + PAD_H
    ) {
      const rel = (s.by - (s.py + PAD_H / 2)) / (PAD_H / 2);
      const angle = rel * 0.9;
      const speed = Math.min(Math.hypot(s.vx, s.vy) * 1.04, 12);
      s.vx = speed * Math.cos(angle);
      s.vy = speed * Math.sin(angle);
      s.bx = PLAYER_X + PAD_W + BALL_R;
    }

    // CPU paddle collision
    if (
      s.vx > 0 &&
      s.bx + BALL_R >= CPU_X &&
      s.bx - BALL_R <= CPU_X + PAD_W &&
      s.by >= s.cy && s.by <= s.cy + PAD_H
    ) {
      const rel = (s.by - (s.cy + PAD_H / 2)) / (PAD_H / 2);
      const angle = rel * 0.9;
      const speed = Math.min(Math.hypot(s.vx, s.vy) * 1.04, 12);
      s.vx = -(speed * Math.cos(angle));
      s.vy = speed * Math.sin(angle);
      s.bx = CPU_X - BALL_R;
    }

    // Score
    if (s.bx < 0) {
      s.cs += 1;
      setScores({ p: s.ps, c: s.cs });
      if (s.cs >= 7) { s.running = false; setWinner("cpu"); draw(); return; }
      Object.assign(s, { ...initState(), ps: s.ps, cs: s.cs });
      setTimeout(() => { stateRef.current.running = true; }, 800);
    }
    if (s.bx > W) {
      s.ps += 1;
      setScores({ p: s.ps, c: s.cs });
      if (s.ps >= 7) {
        s.running = false;
        setWinner("you");
        onGameOverRef.current?.(s.ps);
        draw();
        return;
      }
      Object.assign(s, { ...initState(), ps: s.ps, cs: s.cs });
      setTimeout(() => { stateRef.current.running = true; }, 800);
    }

    draw();
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ([...upKeys, ...downKeys].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const offKey = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", offKey);
    draw();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", offKey);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = () => {
    stateRef.current = initState();
    stateRef.current.running = true;
    setScores({ p: 0, c: 0 });
    setWinner(null);
    setStarted(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "100%", maxWidth: W, height: "auto", borderRadius: 10, display: "block" }}
      />
      {!started && (
        <button
          onClick={startGame}
          className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Start Game
        </button>
      )}
      {winner && (
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${winner === "you" ? "text-green-400" : "text-red-400"}`}>
            {winner === "you" ? "You win! 🎉" : "CPU wins!"}
          </span>
          <button
            onClick={startGame}
            className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
          >
            Play again
          </button>
        </div>
      )}
      <p className="text-xs text-gray-600">W / S or ↑ / ↓ to move · First to 7 wins</p>
    </div>
  );
}
