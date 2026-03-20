"use client";
import Link from "next/link";
import { Code, Zap, Download, Keyboard, Gamepad2, Lightbulb, ArrowRight, Github } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Keyboard size={22} className="text-blue-400" />,
    title: "Configure Your Buttons",
    desc: "Add buttons and assign each one a pin number and a key binding. Set up LEDs, joysticks, IR sensors, and port inputs — all from one screen.",
  },
  {
    number: "02",
    icon: <Code size={22} className="text-purple-400" />,
    title: "Generate the Sketch",
    desc: 'Click "View & Copy Sketch" to instantly generate clean Arduino code for your layout. No coding required.',
  },
  {
    number: "03",
    icon: <Download size={22} className="text-green-400" />,
    title: "Paste & Upload",
    desc: "Open Arduino IDE, paste the code, and upload to your board. Your Arduino is now a custom keyboard or controller.",
  },
];

const features = [
  { icon: <Zap size={16} className="text-yellow-400" />, label: "Wiring Diagram", desc: "Visual guide showing exactly how to wire every component to your board." },
  { icon: <Gamepad2 size={16} className="text-violet-400" />, label: "Built-in Tester", desc: "Test your button mappings live in the browser before uploading anything." },
  { icon: <Lightbulb size={16} className="text-amber-400" />, label: "LED Support", desc: "Add per-button LEDs that light up on press, or a power indicator LED." },
  { icon: <Download size={16} className="text-blue-400" />, label: "Share Setups", desc: "Download your config as a file and send it to anyone — they import it in one click." },
  { icon: <Code size={16} className="text-green-400" />, label: "Clean Code Output", desc: "Generated sketches are readable, debounced, and ready to upload without editing." },
  { icon: <Keyboard size={16} className="text-pink-400" />, label: "Any Key Binding", desc: "Map buttons to letters, numbers, function keys, arrows, modifiers, and more." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Keyboard size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm text-white">Arduino Button Mapper</span>
        </div>
        <Link
          href="/app"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          Open App <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Works with Arduino Leonardo & compatible boards
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-br from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
          Turn your Arduino into<br />a custom controller
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Map buttons to any key, generate clean Arduino code instantly, and paste it into Arduino IDE.
          No programming knowledge needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base transition-all shadow-xl shadow-blue-900/30"
          >
            Start Building <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-gray-600">Free · No account required to get started</p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-2">How it works</h2>
        <p className="text-sm text-gray-500 text-center mb-10">Three steps from idea to working hardware</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.number} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                  {s.icon}
                </div>
                <span className="text-3xl font-black text-gray-800">{s.number}</span>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-2">Everything you need</h2>
        <p className="text-sm text-gray-500 text-center mb-10">Built for accessibility controllers, gaming peripherals, and anything in between</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{f.label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <div className="bg-gradient-to-br from-blue-950/60 to-purple-950/60 border border-blue-800/40 rounded-3xl p-10 flex flex-col items-center text-center gap-5">
          <h2 className="text-3xl font-extrabold">Ready to build?</h2>
          <p className="text-gray-400 max-w-md text-sm leading-relaxed">
            Jump straight in — no account needed. Create an account when you want to save and share your setup.
          </p>
          <Link
            href="/app"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base transition-all shadow-xl shadow-blue-900/30"
          >
            Open the App <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 px-6 py-6 text-center text-xs text-gray-700">
        Arduino Button Mapper · Works with Arduino Leonardo and ATmega32U4-based boards
      </footer>
    </div>
  );
}
