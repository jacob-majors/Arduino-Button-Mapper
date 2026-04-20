import Link from "next/link";
import { ArrowRight, Cpu, Gamepad2, Sparkles, Upload, Wand2 } from "lucide-react";

const quickSteps = [
  { title: "Add inputs", icon: <Sparkles size={18} />, color: "bg-[#fff1bf] text-[#7a5500]" },
  { title: "Generate code", icon: <Wand2 size={18} />, color: "bg-[#dff5ff] text-[#005c73]" },
  { title: "Upload fast", icon: <Upload size={18} />, color: "bg-[#e8e1ff] text-[#4c2d9d]" },
];

const featureTiles = [
  { title: "Buttons, toggles, joysticks", subtitle: "Build layouts visually", tone: "bg-[#fff9eb]" },
  { title: "Clean Arduino sketch output", subtitle: "Readable and ready to flash", tone: "bg-[#eef8ff]" },
  { title: "Live test view", subtitle: "Check mappings instantly", tone: "bg-[#f3f0ff]" },
];

function AppArtwork() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#d8e0e8] bg-white shadow-[0_30px_80px_rgba(20,30,50,0.12)]">
      <div className="flex items-center justify-between border-b border-[#ebeff4] bg-[#f8fafc] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff6b63]" />
          <span className="h-3 w-3 rounded-full bg-[#f6c24a]" />
          <span className="h-3 w-3 rounded-full bg-[#33c35b]" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8797]">Arduino Button Mapper</p>
        <div className="w-12" />
      </div>

      <div className="grid gap-4 bg-[linear-gradient(180deg,#fcfdff_0%,#f3f7fb_100%)] p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-[24px] bg-[#172033] p-4 text-white">
          <p className="text-xs uppercase tracking-[0.22em] text-[#96a7c4]">Inputs</p>
          <div className="mt-4 space-y-2">
            {["Jump Button", "Menu Toggle", "IR Sensor", "Sip & Puff"].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-2xl bg-white/8 px-3 py-3">
                <span className="text-sm">{item}</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs">D{index + 2}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[20px] bg-[#f6c344] p-4 text-[#3d2b00]">
            <p className="text-xs font-bold uppercase tracking-[0.22em]">Status</p>
            <p className="mt-2 text-lg font-black">Board connected</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[24px] border border-[#dee6ef] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#8090a3]">Configure</p>
                <h3 className="mt-2 text-xl font-black text-[#172033]">Map your controls</h3>
              </div>
              <button className="rounded-full bg-[#172033] px-4 py-2 text-sm font-semibold text-white">Add input</button>
            </div>

            <div className="mt-4 grid gap-3">
              {[
                ["Jump Button", "Pin D2", "Space"],
                ["Menu Toggle", "Pin D3", "Enter"],
                ["IR Sensor", "Pin D6", "E"],
              ].map(([name, pin, key]) => (
                <div key={name} className="grid gap-3 rounded-[18px] border border-[#e6edf4] bg-[#fbfdff] p-4 sm:grid-cols-[1fr_auto_auto]">
                  <div>
                    <p className="font-semibold text-[#172033]">{name}</p>
                    <p className="text-sm text-[#708096]">Custom mapping</p>
                  </div>
                  <span className="rounded-full bg-[#eef3f8] px-3 py-1.5 text-sm font-semibold text-[#36475e]">{pin}</span>
                  <span className="rounded-full bg-[#f6c344] px-3 py-1.5 text-sm font-semibold text-[#3d2b00]">{key}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] bg-[#172033] p-4 text-white">
              <p className="text-xs uppercase tracking-[0.22em] text-[#95a6c2]">Sketch</p>
              <div className="mt-4 space-y-2 rounded-[20px] bg-black/20 p-4 font-mono text-sm text-[#d4dded]">
                <p>#include &lt;Keyboard.h&gt;</p>
                <p>const int buttonPins[] = &#123;2, 3, 6&#125;;</p>
                <p>const int keyValues[] = &#123;32, 176, 69&#125;;</p>
                <p>void setup() &#123; Keyboard.begin(); &#125;</p>
                <p>void loop() &#123; /* generated logic */ &#125;</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#dee6ef] bg-[#f8fbfd] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8090a3]">Upload</p>
              <div className="mt-4 space-y-3">
                {[
                  ["Compile", "Done", "bg-[#4dbbff]"],
                  ["Upload", "Ready", "bg-[#46d393]"],
                  ["Test", "Live", "bg-[#ff9f67]"],
                ].map(([label, state, tone]) => (
                  <div key={label} className="rounded-[18px] bg-white p-4 shadow-[0_10px_24px_rgba(20,30,50,0.05)]">
                    <div className={`h-2 rounded-full ${tone}`} />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-semibold text-[#172033]">{label}</span>
                      <span className="text-sm text-[#708096]">{state}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControllerCard() {
  return (
    <div className="relative overflow-hidden rounded-[30px] bg-[#172033] p-6 text-white shadow-[0_28px_70px_rgba(23,32,51,0.2)]">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#f6c344]/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#39b6ff]/15 blur-3xl" />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.22em] text-[#98a7c2]">Made for real builds</p>
        <h3 className="mt-3 text-2xl font-black">From adaptive buttons to arcade-style controls</h3>

        <div className="mt-8 flex items-center justify-center">
          <div className="relative h-52 w-full max-w-md">
            <div className="absolute inset-x-10 top-10 h-32 rounded-[999px] bg-[linear-gradient(180deg,#2a3b59_0%,#1d2941_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <div className="absolute left-8 top-6 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_35%_35%,#56d8ff_0%,#0881a3_70%)] shadow-[0_0_0_10px_rgba(8,129,163,0.15)]" />
            <div className="absolute right-8 top-6 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffc978_0%,#d48400_70%)] shadow-[0_0_0_10px_rgba(212,132,0,0.15)]" />
            <div className="absolute left-1/2 top-[84px] h-16 w-16 -translate-x-1/2 rounded-2xl bg-[#0e1728] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
            <div className="absolute left-[22%] top-[112px] h-10 w-10 rounded-full bg-white/10" />
            <div className="absolute right-[22%] top-[112px] h-10 w-10 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {["No coding wall", "Fast iteration", "Clean visual flow"].map((item) => (
            <div key={item} className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[#d9e3f2]">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#eef3f7] text-[#172033]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top_left,_rgba(246,195,68,0.24),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(57,182,255,0.18),_transparent_30%),linear-gradient(180deg,#fbfdff_0%,#eef3f7_72%,#eaf0f5_100%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#172033] text-white shadow-[0_14px_30px_rgba(23,32,51,0.18)]">
            <Cpu size={20} />
          </div>
          <div>
            <p className="text-base font-black tracking-tight">Arduino Button Mapper</p>
            <p className="text-xs uppercase tracking-[0.18em] text-[#718197]">Custom input builder</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/instructables" className="hidden rounded-full border border-[#d8e0e8] bg-white px-4 py-2 text-sm font-semibold text-[#344258] sm:inline-flex">
            Guide
          </Link>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white">
            Open App
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f1d889] bg-[#fff4cf] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#7b5b00]">
            <span className="h-2 w-2 rounded-full bg-[#f6c344]" />
            Arduino Leonardo ready
          </div>

          <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight text-[#172033] sm:text-6xl">
            A homepage that looks like a real product, not a wall of text
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#58697d]">
            Build custom controls, generate the sketch, and upload fast.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#172033] px-6 py-3.5 text-base font-semibold text-white shadow-[0_18px_38px_rgba(23,32,51,0.18)]">
              Start Building
              <ArrowRight size={17} />
            </Link>
            <Link href="/landing" className="inline-flex items-center justify-center rounded-full border border-[#d8e0e8] bg-white px-6 py-3.5 text-base font-semibold text-[#344258]">
              Alternate Landing
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {quickSteps.map((step) => (
              <div key={step.title} className="rounded-[24px] border border-[#d8e0e8] bg-white p-4 shadow-[0_12px_28px_rgba(20,30,50,0.05)]">
                <div className={`inline-flex rounded-2xl px-3 py-3 ${step.color}`}>{step.icon}</div>
                <p className="mt-4 text-base font-bold">{step.title}</p>
              </div>
            ))}
          </div>
        </div>

        <ControllerCard />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AppArtwork />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {featureTiles.map((tile) => (
            <div key={tile.title} className={`rounded-[28px] border border-[#d8e0e8] p-6 shadow-[0_14px_34px_rgba(20,30,50,0.05)] ${tile.tone}`}>
              <p className="text-xl font-black tracking-tight text-[#172033]">{tile.title}</p>
              <p className="mt-2 text-sm font-medium text-[#5d6d80]">{tile.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col gap-6 rounded-[34px] bg-[#172033] px-6 py-10 text-white shadow-[0_30px_80px_rgba(23,32,51,0.18)] sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#97a6c0]">Ready to go</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Open the app and start mapping controls</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f6c344] px-6 py-3.5 text-base font-semibold text-[#3d2b00]">
              Launch App
              <ArrowRight size={17} />
            </Link>
            <Link href="/instructables" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3.5 text-base font-semibold text-white">
              View Guide
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
