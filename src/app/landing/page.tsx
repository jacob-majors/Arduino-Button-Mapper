import Link from "next/link";
import { Code, Zap, Upload, Keyboard, Gamepad2, Lightbulb, ArrowRight, Wind, Radio, Joystick } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Keyboard size={22} className="text-blue-400" />,
    title: "Configure Your Inputs",
    desc: "Add micro switches, toggle switches, joysticks, IR sensors, or sip & puff sensors. Assign each one a pin and a key binding — all from one screen.",
  },
  {
    number: "02",
    icon: <Code size={22} className="text-purple-400" />,
    title: "Generate the Sketch",
    desc: 'Click "View & Copy Sketch" to instantly generate clean Arduino code for your layout. No coding required.',
  },
  {
    number: "03",
    icon: <Upload size={22} className="text-green-400" />,
    title: "Upload to Your Board",
    desc: "Paste the code into Arduino IDE — or use the built-in Compile & Upload button in Chrome to flash your board directly from the browser. Nothing to install.",
  },
];

const features = [
  { icon: <Keyboard size={16} className="text-blue-400" />, label: "Multiple Input Types", desc: "Micro switches, toggle switches, joysticks, IR sensors, and sip & puff sensors all supported." },
  { icon: <Upload size={16} className="text-green-400" />, label: "One-Click Upload", desc: "Compile & flash directly from Chrome or Edge via Web Serial — no Arduino IDE or local software required." },
  { icon: <Zap size={16} className="text-yellow-400" />, label: "Wiring Diagram", desc: "Visual guide showing exactly how to wire every component to your board." },
  { icon: <Gamepad2 size={16} className="text-violet-400" />, label: "Built-in Tester", desc: "Test your button mappings live in the browser — play Dino, Snake, or Pong with your controller." },
  { icon: <Lightbulb size={16} className="text-amber-400" />, label: "Per-Button LEDs", desc: "Assign an LED to any input that lights up when pressed or toggled." },
  { icon: <Code size={16} className="text-pink-400" />, label: "Clean Code Output", desc: "Generated sketches are readable, debounced, and ready to upload without editing." },
];

const inputTypes = [
  { icon: <Keyboard size={13} className="text-blue-400" />, label: "Micro Switch" },
  { icon: <Keyboard size={13} className="text-sky-400" />, label: "Toggle Switch" },
  { icon: <Joystick size={13} className="text-violet-400" />, label: "Joystick" },
  { icon: <Radio size={13} className="text-green-400" />, label: "IR Sensor" },
  { icon: <Wind size={13} className="text-cyan-400" />, label: "Sip & Puff" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <nav className="border-b border-gray-800/50 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Keyboard size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm text-white">Arduino Button Mapper</span>
        </div>
        <Link
          href="/app"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors"
        >
          Launch App <ArrowRight size={13} />
        </Link>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Arduino Leonardo &amp; ATmega32U4-Compatible Boards
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-5 bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent leading-tight">
          Turn your Arduino into<br />a custom controller
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mb-8 leading-relaxed">
          Map any input to any key, generate clean Arduino code instantly,
          and upload straight from your browser — nothing to install.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {inputTypes.map((t) => (
            <span key={t.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-400">
              {t.icon} {t.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base transition-all shadow-2xl shadow-blue-900/40"
          >
            Start Building <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-gray-600">Free · No account required</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto w-full px-6">
        <div className="border-t border-gray-800/60" />
      </div>

      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-2">How It Works</h2>
        <p className="text-sm text-gray-500 text-center mb-12">Three steps from idea to working hardware</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.number} className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-3 w-6 h-px bg-gray-700 z-10" />
              )}
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

      <div className="max-w-6xl mx-auto w-full px-6">
        <div className="border-t border-gray-800/60" />
      </div>

      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-2">Everything You Need</h2>
        <p className="text-sm text-gray-500 text-center mb-12">Built for accessibility controllers, gaming peripherals, and anything in between</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex gap-3 hover:border-gray-700 transition-colors">
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

      <section className="px-6 pb-20 max-w-6xl mx-auto w-full">
        <div className="bg-gradient-to-br from-blue-950/50 to-purple-950/50 border border-blue-800/30 rounded-3xl p-12 flex flex-col items-center text-center gap-5">
          <h2 className="text-3xl font-extrabold">Ready to build?</h2>
          <p className="text-gray-400 max-w-sm text-sm leading-relaxed">
            Jump straight in — no account needed. Sign up when you want to save and share your setup.
          </p>
          <Link
            href="/app"
            className="flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base transition-all shadow-2xl shadow-blue-900/40"
          >
            Open the App <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="px-6 pb-16 max-w-6xl mx-auto w-full">
        <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-lg font-black shadow-lg shadow-blue-900/30">
            JM
          </div>
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Built By</p>
            <h3 className="text-base font-bold text-white mb-1.5">Jacob Majors</h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
              A tool built for custom Arduino-based accessibility controllers and gaming peripherals.
              Configure your inputs, generate code, and flash your board — all from the browser.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800/50 px-6 py-5 text-center text-xs text-gray-700">
        Arduino Button Mapper &nbsp;·&nbsp; Arduino Leonardo &amp; ATmega32U4-Compatible Boards
      </footer>
    </div>
  );
}
