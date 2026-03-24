"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

// ─── Step definitions ─────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string;
  target: string | null;          // CSS selector, null = centred modal
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  tab?: string;                   // switch to this tab before showing step
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to Arduino Button Mapper 👋",
    body: "Let's take a quick tour so you know exactly what everything does. Click Next to start, or Skip to close.",
    position: "center",
  },
  {
    id: "configure-tab",
    target: "[data-tutorial='configure-tab']",
    title: "Configure Tab",
    body: "This is your main workspace. Set up all your inputs here — buttons, IR sensors, joysticks, and sip & puff sensors.",
    position: "bottom",
    tab: "configure",
  },
  {
    id: "add-input",
    target: "[data-tutorial='add-input']",
    title: "Adding Inputs",
    body: "Click any of these pills to add a new input. Each one maps a physical component on your Arduino to a keyboard key.",
    position: "bottom",
    tab: "configure",
  },
  {
    id: "upload",
    target: "[data-tutorial='upload-btn']",
    title: "Compile & Upload",
    body: "Once configured, plug in your Arduino and click this button. The app compiles your code and sends it to the board — no Arduino IDE needed.",
    position: "top",
    tab: "configure",
  },
  {
    id: "wiring",
    target: "[data-tutorial='wiring-btn']",
    title: "Wiring Diagram",
    body: "Not sure how to physically connect your components? Click Wiring to see an interactive diagram showing every connection for your setup.",
    position: "top",
    tab: "configure",
  },
  {
    id: "remap",
    target: "[data-tutorial='remap-btn']",
    title: "Remap a Device",
    body: "Already have a device? Plug it in and click Remap Device to read its current key mappings and reassign them — no starting from scratch.",
    position: "top",
    tab: "configure",
  },
  {
    id: "test-tab",
    target: "[data-tutorial='test-tab']",
    title: "Test Tab",
    body: "After uploading, come here to verify everything is working. Press inputs on your device and watch the keystrokes appear in real time.",
    position: "bottom",
    tab: "configure",
  },
  {
    id: "save",
    target: "[data-tutorial='save-panel']",
    title: "Saving Your Work",
    body: "Your config auto-saves while you're logged in. Click this button to manage saved setups, rename them, or share a link with someone else.",
    position: "top",
    tab: "configure",
  },
  {
    id: "done",
    target: null,
    title: "You're all set! 🎉",
    body: "That covers the basics. You can replay this tour anytime by clicking the ? button in the top bar.",
    position: "center",
  },
];

// ─── Spotlight rect ───────────────────────────────────────────────────────────

interface SpotRect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): SpotRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({
  step, stepIndex, total, rect, padding,
  onNext, onPrev, onSkip,
}: {
  step: TutorialStep; stepIndex: number; total: number;
  rect: SpotRect | null; padding: number;
  onNext: () => void; onPrev: () => void; onSkip: () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === total - 1;
  const isCentered = !rect || step.position === "center";

  // Tooltip width
  const TW = 300;

  let style: React.CSSProperties = {};

  if (isCentered) {
    style = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: TW,
    };
  } else if (rect) {
    const PAD = padding + 12; // gap between spotlight and tooltip
    const cx  = rect.left + rect.width / 2;
    const pos = step.position ?? "bottom";

    if (pos === "bottom") {
      style = {
        position: "fixed",
        top:  rect.top + rect.height + PAD,
        left: Math.max(8, Math.min(cx - TW / 2, window.innerWidth - TW - 8)),
        width: TW,
      };
    } else if (pos === "top") {
      style = {
        position: "fixed",
        bottom: window.innerHeight - rect.top + PAD,
        left:   Math.max(8, Math.min(cx - TW / 2, window.innerWidth - TW - 8)),
        width:  TW,
      };
    } else if (pos === "right") {
      style = {
        position: "fixed",
        top:  rect.top + rect.height / 2 - 60,
        left: rect.left + rect.width + PAD,
        width: TW,
      };
    } else {
      style = {
        position: "fixed",
        top:   rect.top + rect.height / 2 - 60,
        right: window.innerWidth - rect.left + PAD,
        width: TW,
      };
    }
  }

  return (
    <div
      style={{ ...style, zIndex: 10002 }}
      className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
    >
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={[
              "rounded-full transition-all",
              i === stepIndex ? "w-4 h-1.5 bg-violet-400" : "w-1.5 h-1.5 bg-gray-700",
            ].join(" ")}
          />
        ))}
        <span className="ml-auto text-[10px] text-gray-600">{stepIndex + 1} / {total}</span>
      </div>

      {/* Content */}
      <div>
        <h3 className="text-sm font-semibold text-gray-100 mb-1">{step.title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{step.body}</p>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSkip}
          className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          {isLast ? "Close" : "Skip tour"}
        </button>
        <div className="flex-1" />
        {!isFirst && (
          <button
            onClick={onPrev}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={12} /> Back
          </button>
        )}
        <button
          onClick={isLast ? onSkip : onNext}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          {isLast ? "Done" : "Next"} {!isLast && <ChevronRight size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

const PADDING = 8; // spotlight padding around target

export default function TutorialOverlay({
  steps = TUTORIAL_STEPS,
  onComplete,
  onTabChange,
  initialStep = 0,
}: {
  steps?: TutorialStep[];
  onComplete: () => void;
  onTabChange?: (tab: string) => void;
  initialStep?: number;
}) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);

  const step = steps[stepIndex];

  // Switch tab if needed, then find the target element
  const updateRect = useCallback(() => {
    if (!step.target) {
      setRect(null);
      setVisible(true);
      return;
    }
    const r = getRect(step.target);
    if (r) {
      setRect(r);
      setVisible(true);
    } else {
      // Retry — element might not be mounted yet
      rafRef.current = requestAnimationFrame(updateRect);
    }
  }, [step.target]);

  useEffect(() => {
    setVisible(false);
    if (step.tab && onTabChange) onTabChange(step.tab);
    // Short delay for tab switch to render
    const t = setTimeout(updateRect, 80);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(rafRef.current);
    };
  }, [stepIndex, step.tab, onTabChange, updateRect]);

  // Re-measure on resize/scroll
  useEffect(() => {
    if (!step.target) return;
    const measure = () => { const r = getRect(step.target!); if (r) setRect(r); };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target]);

  function next() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
    else onComplete();
  }
  function prev() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  if (!visible) return null;

  const isCentered = !rect || step.position === "center";

  return (
    <>
      {/* Dark overlay — either full-screen (centered) or with spotlight hole */}
      {isCentered ? (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
          style={{ zIndex: 10000 }}
          onClick={onComplete}
        />
      ) : (
        <>
          {/* 4 dark panels forming the "hole" around the target */}
          {/* Top */}
          <div style={{
            position: "fixed", zIndex: 10000, pointerEvents: "none",
            top: 0, left: 0, right: 0,
            height: rect!.top - PADDING,
            background: "rgba(0,0,0,0.75)",
          }} />
          {/* Bottom */}
          <div style={{
            position: "fixed", zIndex: 10000, pointerEvents: "none",
            top: rect!.top + rect!.height + PADDING,
            left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.75)",
          }} />
          {/* Left */}
          <div style={{
            position: "fixed", zIndex: 10000, pointerEvents: "none",
            top: rect!.top - PADDING,
            left: 0,
            width: rect!.left - PADDING,
            height: rect!.height + PADDING * 2,
            background: "rgba(0,0,0,0.75)",
          }} />
          {/* Right */}
          <div style={{
            position: "fixed", zIndex: 10000, pointerEvents: "none",
            top: rect!.top - PADDING,
            left: rect!.left + rect!.width + PADDING,
            right: 0,
            height: rect!.height + PADDING * 2,
            background: "rgba(0,0,0,0.75)",
          }} />
          {/* Glow ring around target */}
          <div style={{
            position: "fixed", zIndex: 10001, pointerEvents: "none",
            top:    rect!.top    - PADDING - 2,
            left:   rect!.left   - PADDING - 2,
            width:  rect!.width  + PADDING * 2 + 4,
            height: rect!.height + PADDING * 2 + 4,
            borderRadius: 10,
            boxShadow: "0 0 0 2px rgba(139,92,246,0.8), 0 0 20px rgba(139,92,246,0.4)",
          }} />
        </>
      )}

      {/* Skip X in corner */}
      <button
        onClick={onComplete}
        style={{ position: "fixed", top: 16, right: 16, zIndex: 10003 }}
        className="p-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors shadow-xl"
      >
        <X size={14} />
      </button>

      <Tooltip
        step={step}
        stepIndex={stepIndex}
        total={steps.length}
        rect={rect}
        padding={PADDING}
        onNext={next}
        onPrev={prev}
        onSkip={onComplete}
      />
    </>
  );
}
