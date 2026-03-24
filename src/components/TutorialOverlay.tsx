"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

// ─── Step definitions ─────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string;
  target: string | null;
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  tab?: string;
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
    position: "top",
    tab: "configure",
  },
  {
    id: "upload",
    target: "[data-tutorial='upload-btn']",
    title: "Compile & Upload",
    body: "Once configured, plug in your Arduino and click this button. The app compiles your code and sends it to the board — no Arduino IDE needed.",
    position: "bottom",
    tab: "configure",
  },
  {
    id: "wiring",
    target: "[data-tutorial='wiring-btn']",
    title: "Wiring Diagram",
    body: "Not sure how to physically connect your components? Click the Wiring icon to see an interactive diagram showing every connection for your setup.",
    position: "bottom",
  },
  {
    id: "remap",
    target: "[data-tutorial='remap-tab']",
    title: "Remap a Device",
    body: "Already have a device? Click the Remap tab to read its current key mappings and reassign them — no starting from scratch.",
    position: "bottom",
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

// ─── Keyframe animations ──────────────────────────────────────────────────────

function TutorialStyles() {
  return (
    <style>{`
      @keyframes tutorialGlow {
        0%, 100% {
          box-shadow: 0 0 0 2px rgba(139,92,246,0.9),
                      0 0 28px rgba(139,92,246,0.5),
                      0 0 70px rgba(139,92,246,0.2);
        }
        50% {
          box-shadow: 0 0 0 3px rgba(167,139,250,1),
                      0 0 50px rgba(139,92,246,0.8),
                      0 0 100px rgba(139,92,246,0.3);
        }
      }
      @keyframes tutorialSpotPulse {
        0%, 100% { opacity: 0.06; }
        50%      { opacity: 0.18; }
      }
      @keyframes tutorialFadeSlide {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes tutorialFadeSlideUp {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes tutorialScaleIn {
        from { opacity: 0; transform: translate(-50%, -46%) scale(0.95); }
        to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      @keyframes tutorialPanelIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
  );
}

// ─── Spotlight rect ───────────────────────────────────────────────────────────

interface SpotRect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): SpotRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const TW = 320;

function Tooltip({
  step, stepIndex, total, rect, padding,
  onNext, onPrev, onSkip,
}: {
  step: TutorialStep; stepIndex: number; total: number;
  rect: SpotRect | null; padding: number;
  onNext: () => void; onPrev: () => void; onSkip: () => void;
}) {
  const isFirst    = stepIndex === 0;
  const isLast     = stepIndex === total - 1;
  const isCentered = !rect || step.position === "center";
  const progress   = total > 1 ? (stepIndex / (total - 1)) * 100 : 100;

  let posStyle: React.CSSProperties = {};
  let anim = "tutorialFadeSlide";

  if (isCentered) {
    posStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: TW,
      animation: "tutorialScaleIn 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards",
    };
  } else if (rect) {
    const PAD = padding + 14;
    const cx  = rect.left + rect.width / 2;
    const pos = step.position ?? "bottom";
    const left = Math.max(8, Math.min(cx - TW / 2, window.innerWidth - TW - 8));

    if (pos === "bottom") {
      anim = "tutorialFadeSlide";
      posStyle = { position: "fixed", top: rect.top + rect.height + PAD, left, width: TW };
    } else if (pos === "top") {
      anim = "tutorialFadeSlideUp";
      posStyle = { position: "fixed", bottom: window.innerHeight - rect.top + PAD, left, width: TW };
    } else if (pos === "right") {
      posStyle = { position: "fixed", top: Math.max(8, rect.top + rect.height / 2 - 70), left: rect.left + rect.width + PAD, width: TW };
    } else {
      posStyle = { position: "fixed", top: Math.max(8, rect.top + rect.height / 2 - 70), right: window.innerWidth - rect.left + PAD, width: TW };
    }

    if (!posStyle.animation) {
      posStyle.animation = `${anim} 0.22s ease-out forwards`;
    }
  }

  return (
    <div style={{ ...posStyle, zIndex: 10005 }} className="flex flex-col rounded-2xl shadow-2xl overflow-hidden">
      {/* Gradient top bar */}
      <div style={{ height: 2, background: "linear-gradient(90deg, #7c3aed, #a78bfa, #60a5fa)" }} />

      {/* Body */}
      <div style={{
        background: "rgba(10,7,24,0.97)",
        border: "1px solid rgba(139,92,246,0.22)",
        borderTop: "none",
        borderRadius: "0 0 16px 16px",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "14px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {/* Progress bar + counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(55,40,90,0.7)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              borderRadius: 99,
              background: "linear-gradient(90deg, #7c3aed, #a78bfa)",
              width: `${progress}%`,
              transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
          <span style={{ fontSize: 10, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>{stepIndex + 1}/{total}</span>
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              height: 5,
              width: i === stepIndex ? 18 : 5,
              borderRadius: 99,
              background: i === stepIndex
                ? "linear-gradient(90deg,#7c3aed,#a78bfa)"
                : i < stepIndex ? "rgba(124,58,237,0.4)" : "rgba(55,65,81,0.7)",
              transition: "width 0.25s ease, background 0.25s ease",
            }} />
          ))}
        </div>

        {/* Text */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#f9fafb", marginBottom: 5, lineHeight: 1.35 }}>{step.title}</h3>
          <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, margin: 0 }}>{step.body}</p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}>
          <button
            onClick={onSkip}
            style={{ fontSize: 11, color: "#4b5563", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#9ca3af")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
          >
            {isLast ? "Close" : "Skip tour"}
          </button>
          <div style={{ flex: 1 }} />
          {!isFirst && (
            <button
              onClick={onPrev}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                borderRadius: 8, fontSize: 12, color: "#6b7280", background: "transparent",
                border: "1px solid rgba(75,85,99,0.4)", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e5e7eb"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(75,85,99,0.4)"; }}
            >
              <ChevronLeft size={12} /> Back
            </button>
          )}
          <button
            onClick={isLast ? onSkip : onNext}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 14px",
              borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", border: "none",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              boxShadow: "0 2px 12px rgba(124,58,237,0.4)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          >
            {isLast ? "Done" : "Next"} {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

const PADDING = 10;

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

  const updateRect = useCallback(() => {
    if (!step.target) {
      setRect(null);
      setVisible(true);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setTimeout(() => {
        const r2 = el.getBoundingClientRect();
        setRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
        setVisible(true);
      }, 250);
    } else {
      rafRef.current = requestAnimationFrame(updateRect);
    }
  }, [step.target]);

  useEffect(() => {
    setVisible(false);
    if (step.tab && onTabChange) onTabChange(step.tab);
    const t = setTimeout(updateRect, 80);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(rafRef.current);
    };
  }, [stepIndex, step.tab, onTabChange, updateRect]);

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
  const panelStyle: React.CSSProperties = {
    position: "fixed", zIndex: 10000, pointerEvents: "none",
    background: "rgba(3,0,14,0.84)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    animation: "tutorialPanelIn 0.18s ease-out forwards",
  };

  return (
    <>
      <TutorialStyles />

      {isCentered ? (
        <div
          onClick={onComplete}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(3,0,14,0.88)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "tutorialPanelIn 0.18s ease-out forwards",
          }}
        />
      ) : (
        <>
          {/* 4 blurred panels */}
          <div style={{ ...panelStyle, top: 0, left: 0, right: 0, height: Math.max(0, rect!.top - PADDING) }} />
          <div style={{ ...panelStyle, top: rect!.top + rect!.height + PADDING, left: 0, right: 0, bottom: 0 }} />
          <div style={{ ...panelStyle, top: rect!.top - PADDING, left: 0, width: Math.max(0, rect!.left - PADDING), height: rect!.height + PADDING * 2 }} />
          <div style={{ ...panelStyle, top: rect!.top - PADDING, left: rect!.left + rect!.width + PADDING, right: 0, height: rect!.height + PADDING * 2 }} />

          {/* Violet pulsing glow under the spotlight element */}
          <div style={{
            position: "fixed", zIndex: 10001, pointerEvents: "none",
            top:    rect!.top    - PADDING,
            left:   rect!.left   - PADDING,
            width:  rect!.width  + PADDING * 2,
            height: rect!.height + PADDING * 2,
            borderRadius: 12,
            background: "radial-gradient(ellipse at center, rgba(139,92,246,1) 0%, transparent 75%)",
            animation: "tutorialSpotPulse 2s ease-in-out infinite",
          }} />

          {/* Animated glow ring */}
          <div style={{
            position: "fixed", zIndex: 10002, pointerEvents: "none",
            top:    rect!.top    - PADDING - 1.5,
            left:   rect!.left   - PADDING - 1.5,
            width:  rect!.width  + PADDING * 2 + 3,
            height: rect!.height + PADDING * 2 + 3,
            borderRadius: 13,
            animation: "tutorialGlow 2s ease-in-out infinite",
          }} />
        </>
      )}

      {/* X close button */}
      <button
        onClick={onComplete}
        style={{
          position: "fixed", top: 14, right: 14, zIndex: 10006,
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 8,
          background: "rgba(10,7,24,0.9)",
          border: "1px solid rgba(139,92,246,0.2)",
          color: "#6b7280", cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#e5e7eb"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; }}
      >
        <X size={13} />
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
