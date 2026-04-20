"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  Download,
  Eye,
  Heart,
  MessageSquare,
  PlayCircle,
  Share2,
  Wrench,
  Zap,
} from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Set up your board and controls",
    body:
      "Start with a clean hardware list, a short overview, and a visual layout that looks like a real Instructables intro block. The wiring panel stays responsive instead of locking the page to a giant SVG canvas.",
    accent: "from-[#ffe39b] via-[#ffd15f] to-[#f6b11b]",
    surface: "bg-[#fff7df]",
    figure: <WiringMockup />,
  },
  {
    number: 2,
    title: "Map each input inside the app",
    body:
      "The configuration step now reads like an actual tutorial section with a clear screenshot panel, supporting notes, and a compact checklist that scales well on tablets and phones.",
    accent: "from-[#c9eff7] via-[#92dce8] to-[#37b9cc]",
    surface: "bg-[#eefbfd]",
    figure: <ConfigMockup />,
  },
  {
    number: 3,
    title: "Upload the sketch and test live",
    body:
      "The final section mirrors the way Instructables uses a big visual, bite-sized callouts, and supporting metadata. Progress bars, test logs, and controls now collapse neatly instead of overflowing.",
    accent: "from-[#d8d4ff] via-[#b0a8ff] to-[#7b6df6]",
    surface: "bg-[#f4f2ff]",
    figure: <UploadMockup />,
  },
];

const materials = [
  "Arduino Leonardo or Micro",
  "Accessible buttons or switches",
  "USB cable",
  "Arduino Button Mapper app",
  "Optional local upload helper",
];

const quickFacts = [
  { icon: <Eye size={16} />, label: "18.4K views" },
  { icon: <Heart size={16} />, label: "96 favorites" },
  { icon: <MessageSquare size={16} />, label: "12 comments" },
];

function BrowserDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff6157]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2f]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

function MockWindow({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[24px] border border-[#d8d8d8] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.08)] ${className}`}>
      <div className="flex items-center justify-between border-b border-[#ececec] bg-[#fafafa] px-4 py-3">
        <BrowserDots />
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b7b7b]">{title}</p>
        <div className="w-12" />
      </div>
      {children}
    </div>
  );
}

function WiringMockup() {
  return (
    <MockWindow title="Materials + Wiring">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[20px] bg-[#18243a] p-5 text-white">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#9db0cf]">Circuit view</p>
              <h4 className="mt-2 text-xl font-semibold">Arduino Button Mapper</h4>
            </div>
            <div className="rounded-full bg-[#f6c344] px-3 py-1 text-xs font-semibold text-[#3c2c00]">Draft</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "Jump Button", pin: "D2", tone: "bg-[#ffb4a1]" },
              { name: "Select Switch", pin: "D3", tone: "bg-[#c8f1cb]" },
              { name: "IR Sensor", pin: "D6", tone: "bg-[#a4e8f1]" },
              { name: "Sip Input", pin: "D7", tone: "bg-[#ddd5ff]" },
            ].map((item) => (
              <div key={item.name} className={`rounded-[18px] ${item.tone} p-4 text-[#152033]`}>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-[#4b5b77]">Mapped in app</p>
                <div className="mt-4 inline-flex rounded-full bg-white/85 px-3 py-1 text-xs font-semibold">{item.pin}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] border border-[#ece6d2] bg-[#fffaf0] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8c7b57]">Board guide</p>
          <div className="mt-5 rounded-[22px] bg-[#0f1728] p-5 text-white">
            <div className="mx-auto max-w-[220px] rounded-[24px] bg-[#203250] px-6 py-7 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <Cpu className="mx-auto mb-3 text-[#f6c344]" size={28} />
              <p className="text-lg font-semibold">Arduino Leonardo</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                {["D2", "D3", "D6", "D7"].map((pin) => (
                  <div key={pin} className="rounded-xl bg-[#314766] px-3 py-2">
                    {pin}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-[#4d4d4d]">
            <p className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#e49d00]" />
              Label each input before wiring.
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#e49d00]" />
              Keep the hero image simple and bright.
            </p>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

function ConfigMockup() {
  return (
    <MockWindow title="Configure Inputs">
      <div className="grid gap-4 p-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[20px] border border-[#e6edf2] bg-[#f8fbfd] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-[#152033]">Pin and key mapping</h4>
              <p className="text-sm text-[#66758f]">A cleaner card stack that scales instead of shrinking into unreadable artboards.</p>
            </div>
            <div className="rounded-full bg-[#16243a] px-3 py-1.5 text-xs font-semibold text-white">Configure</div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["Jump Button", "Pin D2", "Space"],
              ["Select Switch", "Pin D3", "Enter"],
              ["IR Sensor", "Pin D6", "E"],
              ["Sip & Puff", "Pin D7", "F"],
            ].map(([label, pin, key]) => (
              <div key={label} className="grid gap-3 rounded-[18px] border border-[#dfe8ee] bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-[#152033]">{label}</p>
                  <p className="text-sm text-[#71839a]">Accessible input mapped in the builder</p>
                </div>
                <div className="rounded-full bg-[#f2f6f9] px-3 py-1.5 text-sm font-semibold text-[#30415e]">{pin}</div>
                <div className="rounded-full bg-[#f6c344] px-3 py-1.5 text-sm font-semibold text-[#3c2c00]">{key}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[20px] bg-[#16243a] p-5 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-[#a7b8d5]">Why this scales better</p>
            <div className="mt-4 space-y-3 text-sm text-[#e4ebf5]">
              <p>Real content blocks stack vertically on narrow screens.</p>
              <p>Controls keep readable text sizes without forcing horizontal scroll.</p>
              <p>The visual rhythm is closer to Instructables cards and article modules.</p>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#ecd98a] bg-[#fff8db] p-5">
            <div className="flex items-center gap-3">
              <Zap className="text-[#d69200]" size={20} />
              <p className="font-semibold text-[#5b4300]">Maker note</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#6b5a23]">
              This panel mimics the way Instructables often pairs a main screenshot with short, plain-language guidance instead of presenting everything as one giant image.
            </p>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

function UploadMockup() {
  return (
    <MockWindow title="Upload + Test">
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_0.88fr]">
        <div className="rounded-[20px] bg-[#101827] p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold">Upload progress</h4>
              <p className="text-sm text-[#a7b8d5]">Compact progress and status cards for tutorial screenshots.</p>
            </div>
            <button className="rounded-full bg-[#f6c344] px-4 py-2 text-sm font-semibold text-[#3c2c00]">Compile & Upload</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Compile", "Done", "bg-[#2db0ff]"],
              ["Connect", "Ready", "bg-[#3ecf8e]"],
              ["Flash", "Complete", "bg-[#ff9868]"],
            ].map(([label, status, tone]) => (
              <div key={label} className="rounded-[18px] bg-white/8 p-4 ring-1 ring-white/10">
                <div className={`h-2 rounded-full ${tone}`} />
                <p className="mt-4 font-semibold">{label}</p>
                <p className="mt-1 text-sm text-[#b7c3d9]">{status}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[18px] bg-white/8 p-4 ring-1 ring-white/10">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-[#f6c344]" />
            </div>
            <p className="mt-3 text-sm text-[#dce6f7]">Upload complete. Device ready for live input testing.</p>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#e6edf2] bg-[#fbfdff] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#7f8da2]">Live monitor</p>
              <h4 className="mt-2 text-lg font-semibold text-[#152033]">Keyboard events</h4>
            </div>
            <div className="rounded-full bg-[#eef4f8] px-3 py-1.5 text-xs font-semibold text-[#42536c]">Testing</div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["10:42:10", "SPACE", "text-[#d46d44]"],
              ["10:42:14", "ENTER", "text-[#1f8f8b]"],
              ["10:42:18", "LEFT CLICK", "text-[#3767d1]"],
            ].map(([time, label, tone]) => (
              <div key={`${time}-${label}`} className="flex items-center justify-between rounded-[16px] bg-[#f4f7fa] px-4 py-3">
                <span className="font-mono text-sm text-[#7b8ca2]">{time}</span>
                <span className={`font-mono text-sm font-semibold ${tone}`}>{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[18px] bg-[#fff8db] p-4 text-sm leading-6 text-[#6b5a23]">
            Big visuals still feel like screenshots, but the surrounding layout behaves like a real article page and scales cleanly on small screens.
          </div>
        </div>
      </div>
    </MockWindow>
  );
}

function StepCard({
  id,
  number,
  title,
  body,
  accent,
  surface,
  figure,
}: {
  id: string;
  number: number;
  title: string;
  body: string;
  accent: string;
  surface: string;
  figure: ReactNode;
}) {
  return (
    <section id={id} className="rounded-[28px] border border-[#e8e8e8] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_300px]">
        <div>
          <div className="flex items-center gap-3">
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${accent} text-lg font-bold text-[#2b2100]`}>
              {number}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#888]">Step {number}</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#1f1f1f]">{title}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#555]">{body}</p>
          <div className={`mt-5 rounded-[24px] border border-white/60 p-3 sm:p-4 ${surface}`}>{figure}</div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-[#ececec] bg-[#fafafa] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">What to show</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#555]">
              <li className="flex gap-3">
                <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#e3a400]" />
                Keep one clear headline action per screenshot.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#e3a400]" />
                Use short captions the way Instructables articles usually do.
              </li>
              <li className="flex gap-3">
                <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#e3a400]" />
                Let panels stack naturally on mobile rather than shrinking the whole image.
              </li>
            </ul>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f6c344] px-4 py-3 text-sm font-semibold text-[#3c2c00] transition-transform hover:scale-[1.01]">
            <Download size={16} />
            Download step image
          </button>
        </aside>
      </div>
    </section>
  );
}

export default function InstructablesPage() {
  return (
    <main className="min-h-screen bg-[#f3f3f3] text-[#222]">
      <header className="border-b border-[#d8d8d8] bg-[#f6c344]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1f1f1f] text-xl font-black text-[#f6c344]">
              i
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-[#1f1f1f]">Instructables</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c4a12]">Yours for the making</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm font-semibold text-[#3e3210]">
            {["Circuits", "Workshop", "Craft", "Teachers", "Contest"].map((item) => (
              <span key={item} className="rounded-full bg-white/45 px-3 py-2">
                {item}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#7a7a7a]">
          <span>Circuits</span>
          <ChevronRight size={16} />
          <span>Arduino</span>
          <ChevronRight size={16} />
          <span className="font-semibold text-[#3f3f3f]">Arduino Button Mapper Guide</span>
        </div>

        <section className="mt-5 rounded-[30px] border border-[#e4e4e4] bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_320px]">
            <div>
              <div className="inline-flex items-center rounded-full bg-[#fff2c2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#7b5b00]">
                Featured mockup refresh
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-[#1f1f1f] sm:text-5xl">
                Arduino Button Mapper on an Instructables-style page that actually scales
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#555] sm:text-lg">
                The old page behaved like a poster gallery. This version is rebuilt as a responsive article with Instructables-inspired structure: bold yellow header, editorial card layout, step sections, sidebar notes, and screenshot panels that stay readable across screen sizes.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#575757]">
                {quickFacts.map((fact) => (
                  <div key={fact.label} className="inline-flex items-center gap-2 rounded-full bg-[#f7f7f7] px-3 py-2">
                    {fact.icon}
                    {fact.label}
                  </div>
                ))}
              </div>

              <div className="mt-6 overflow-hidden rounded-[28px] border border-[#e6e6e6] bg-[#fcfcfc]">
                <div className="aspect-[16/10] w-full p-3 sm:p-5">
                  <WiringMockup />
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-[#ececec] bg-[#fafafa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">Author</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#16243a] text-lg font-bold text-white">JM</div>
                  <div>
                    <p className="font-semibold text-[#1f1f1f]">Jacob Majors</p>
                    <p className="text-sm text-[#676767]">Maker tools and accessible controls</p>
                  </div>
                </div>
                <button className="mt-4 w-full rounded-full border border-[#d6d6d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#333]">
                  Follow
                </button>
              </div>

              <div className="rounded-[24px] border border-[#ececec] bg-[#fafafa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">Supplies</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#555]">
                  {materials.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-[#f6c344]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[24px] bg-[#16243a] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9eb0cd]">Actions</p>
                <div className="mt-4 grid gap-3">
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f6c344] px-4 py-3 text-sm font-semibold text-[#3c2c00]">
                    <PlayCircle size={16} />
                    Start Reading
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                    <Share2 size={16} />
                    Share
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[#e8e8e8] bg-white p-6 shadow-[0_18px_42px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">Introduction</p>
              <p className="mt-4 text-[15px] leading-8 text-[#555]">
                This page now behaves like a tutorial article instead of a fixed export board. The layout uses responsive grids, aspect-ratio based media containers, and card groupings that resemble the real Instructables reading experience. That means less pinching and horizontal scrolling, and a clearer connection to the visual language people expect from the site.
              </p>
            </div>

            {steps.map((step) => (
              <StepCard key={step.number} id={`step-${step.number}`} {...step} />
            ))}
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-6">
            <div className="rounded-[24px] border border-[#ececec] bg-white p-5 shadow-[0_14px_35px_rgba(0,0,0,0.04)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">On this page</p>
              <div className="mt-4 space-y-3 text-sm">
                {steps.map((step) => (
                  <a
                    key={step.number}
                    href={`#step-${step.number}`}
                    className="flex items-center justify-between rounded-2xl bg-[#f7f7f7] px-4 py-3 text-[#444] transition-colors hover:bg-[#fff2c2]"
                  >
                    <span>Step {step.number}</span>
                    <span className="font-semibold text-[#222]">{step.title}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#ecd98a] bg-[#fff8db] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a6a05]">What changed</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[#6b5a23]">
                <p>The page is now mobile-friendly and content-first.</p>
                <p>The overall look is much closer to a live Instructables article.</p>
                <p>Screenshot areas use flexible containers instead of hard-coded giant canvases.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
