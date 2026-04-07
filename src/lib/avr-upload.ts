"use client";

/** Parse Intel HEX string into a flat binary buffer (32 KB) */
export function parseIntelHex(hex: string): Uint8Array {
  const data = new Uint8Array(0x8000).fill(0xff);
  let extAddr = 0;
  for (const raw of hex.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith(":")) continue;
    const count = parseInt(line.slice(1, 3), 16);
    const addr  = parseInt(line.slice(3, 7), 16);
    const type  = parseInt(line.slice(7, 9), 16);
    if (type === 0x00) {
      for (let i = 0; i < count; i++)
        data[extAddr + addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
    } else if (type === 0x04) {
      extAddr = parseInt(line.slice(9, 13), 16) << 16;
    } else if (type === 0x01) break;
  }
  return data;
}

/** Round up to the nearest 128-byte flash page */
function pageAlign(data: Uint8Array): number {
  let end = data.length;
  while (end > 0 && data[end - 1] === 0xff) end--;
  return Math.ceil(end / 128) * 128;
}

type Progress = (msg: string) => void;

/** Open a serial port with a hard timeout so a dead port handle never hangs forever */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openPort(port: any, options: Record<string, unknown>, timeoutMs = 4000): Promise<boolean> {
  try {
    await Promise.race([
      port.open(options),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function readExact(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  n: number,
  timeoutMs = 4000
): Promise<Uint8Array> {
  const buf: number[] = [];
  const deadline = Date.now() + timeoutMs;
  while (buf.length < n) {
    if (Date.now() > deadline) {
      throw new Error(
        "Board not responding. Check that:\n" +
        "① You selected the correct port\n" +
        "② It's a data USB cable (not charge-only)\n" +
        "③ The board is an Arduino Leonardo or compatible\n" +
        "Try pressing the Reset button and uploading again."
      );
    }
    const { value, done } = await reader.read();
    if (done) throw new Error("Port closed unexpectedly — the Arduino may have disconnected.");
    if (value) buf.push(...Array.from(value));
  }
  return new Uint8Array(buf.slice(0, n));
}

/**
 * Full compile-and-upload flow:
 *  1. POST /api/compile → receive .hex
 *  2. Web Serial: auto-select or prompt for port
 *  3. Web Serial: 1200-baud touch to trigger bootloader
 *  4. Web Serial: avr109 (Catarina) protocol to flash the .hex
 *
 * @param forceNewPort - true to always show the port picker (e.g. "Change Port" button)
 */
export async function compileAndUpload(
  backendUrl: string,
  sketch: string,
  onProgress: Progress,
  forceNewPort = false
): Promise<void> {
  // ── Check Web Serial support ─────────────────────────────────────────────
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial API not available. Open this page in Chrome or Edge — Firefox and Safari do not support Web Serial."
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;

  // ── Step 1: Compile on backend ───────────────────────────────────────────
  onProgress("Compiling sketch on server… (no Arduino needed for this step)");
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sketch, fqbn: "arduino:avr:leonardo" }),
    });
  } catch {
    throw new Error(
      `Cannot reach the compile server (${backendUrl}). ` +
      "The backend may be down — check Railway or your NEXT_PUBLIC_BACKEND_URL setting."
    );
  }
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text().catch(() => "");
    // Hitting Vercel frontend instead of Railway backend → HTML response
    if (contentType.includes("text/html") || text.trimStart().startsWith("<!")) {
      throw new Error(
        `Wrong server — got a webpage instead of the compile API.\n` +
        `Backend URL is: ${backendUrl}\n` +
        `Fix: set NEXT_PUBLIC_BACKEND_URL to your Railway URL and redeploy on Vercel.`
      );
    }
    // Parse the JSON error from the backend
    let log = "";
    try {
      const j = JSON.parse(text);
      log = (j.log ?? "").trim();
    } catch { /* fall through */ }

    if (log) {
      // Pull out lines that contain "error:" — these are the actual compiler errors
      const lines = log.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const errorLines = lines.filter((l: string) => /error:/i.test(l));
      const shown = (errorLines.length > 0 ? errorLines : lines.slice(-6)).slice(0, 8).join("\n");
      throw new Error(`Sketch has a compile error:\n${shown}`);
    }
    throw new Error(`Compilation failed (HTTP ${res.status})`);
  }
  const { hex } = await res.json();
  onProgress("✓ Compilation successful — connecting to board…");

  // ── Step 2: Port selection ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let port: any = null;

  if (!forceNewPort) {
    // Try to reuse a previously-granted port (no dialog shown)
    try {
      const grantedPorts = await serial.getPorts();
      if (grantedPorts.length === 1) {
        port = grantedPorts[0];
        onProgress("Using previously selected Arduino port…");
      } else if (grantedPorts.length > 1) {
        // Prefer any port whose info looks like an Arduino
        const arduinoPorts = grantedPorts.filter((p: { getInfo: () => { usbVendorId?: number } }) => {
          const info = p.getInfo?.() ?? {};
          return info.usbVendorId === 0x2341 || info.usbVendorId === 0x1B4F || info.usbVendorId === 0x239A;
        });
        port = arduinoPorts[0] ?? grantedPorts[0];
        onProgress("Using previously selected Arduino port…");
      }
    } catch { /* getPorts not available — fall through to requestPort */ }
  }

  if (!port) {
    onProgress("Select your Arduino port in the browser dialog…");
    try {
      port = await serial.requestPort({ filters: [] });
    } catch (e: unknown) {
      const err = e as Error;
      if (err?.name === "NotAllowedError" || err?.message?.includes("No port selected")) {
        throw new Error("Upload cancelled — no port was selected.");
      }
      throw new Error(`Could not open port picker: ${err?.message ?? String(e)}`);
    }
  }

  // ── Step 3: 1200-baud touch (triggers Leonardo bootloader) ───────────────
  onProgress("Triggering bootloader (1200-baud touch)…");
  const portsBefore: unknown[] = await serial.getPorts().catch(() => []);

  // Open at 1200 baud — Leonardo treats this as "enter bootloader on close"
  await openPort(port, { baudRate: 1200 }, 3000);
  try { await port.close(); } catch { /* ignore */ }

  onProgress("Waiting for bootloader to enumerate…");
  await new Promise((r) => setTimeout(r, 3200));

  // ── Step 4: Connect to bootloader at 57600 ───────────────────────────────
  // After reset the Leonardo re-enumerates as a NEW USB device.
  // Web Serial's getPorts() only returns previously-granted ports so the new
  // bootloader device usually won't show up — that's expected, not a bug.
  // Strategy: try all candidate ports with a hard timeout on each open() so
  // a dead/stale port handle never hangs forever. Fall back to requestPort()
  // which shows a browser dialog where the user can pick "Arduino bootloader".
  onProgress("Connecting to bootloader…");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bp: any = null;
  const flashOpts = { baudRate: 57600, dataBits: 8, stopBits: 1, parity: "none" };

  // Try 1: any newly-appeared granted port (bootloader port was pre-granted)
  const portsAfter: unknown[] = await serial.getPorts().catch(() => []);
  const newlyAppeared = portsAfter.filter((p) => !portsBefore.includes(p));
  for (const candidate of newlyAppeared) {
    if (await openPort(candidate, flashOpts)) { bp = candidate; break; }
  }

  // Try 2: original port handle (on Mac/Linux often reconnects after re-enum)
  if (!bp && await openPort(port, flashOpts)) { bp = port; }

  // Try 3: any other already-granted port (Windows COM number may have changed)
  if (!bp) {
    const allGranted: unknown[] = await serial.getPorts().catch(() => []);
    for (const candidate of allGranted) {
      if (candidate === port) continue;
      if (await openPort(candidate, flashOpts)) { bp = candidate; break; }
    }
  }

  // Try 4: ask the user — browser dialog shows the bootloader device by name
  if (!bp) {
    onProgress("Select the Arduino bootloader port in the browser dialog…");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chosen: any = await serial.requestPort({ filters: [] });
      if (await openPort(chosen, flashOpts)) bp = chosen;
    } catch { /* user cancelled or failed */ }
  }

  if (!bp) {
    throw new Error(
      "Could not connect to the bootloader after reset.\n" +
      "① Make sure it's a data USB cable (not charge-only)\n" +
      "② Press the reset button TWICE quickly — the LED should pulse slowly\n" +
      "③ Click Compile & Upload within 8 seconds of the double-press"
    );
  }
  const writer = bp.writable!.getWriter();
  const reader = bp.readable!.getReader();
  const send = (b: number[]) => writer.write(new Uint8Array(b));
  const read = (n: number, t?: number) => readExact(reader, n, t);
  const readCR = async (label: string) => {
    const b = await read(1);
    if (b[0] !== 0x0d) throw new Error(`Protocol error during "${label}" — got 0x${b[0].toString(16)} instead of CR. Wrong board type?`);
  };

  try {
    // Verify it's a Catarina/avr109 bootloader
    await send([0x53]); // 'S' — software identifier
    const idBytes = await read(7, 3000);
    const id = String.fromCharCode(...Array.from(idBytes));
    if (!id.includes("CATERIN") && !id.includes("Arduino")) {
      throw new Error(
        `Wrong bootloader detected: "${id.trim()}"\n` +
        "This app supports Arduino Leonardo and ATmega32U4-based boards only.\n" +
        "Make sure you selected the correct port."
      );
    }
    onProgress(`Bootloader: ${id.trim()}`);

    // Select device (ATmega32U4 = 0x44)
    await send([0x54, 0x44]); // 'T'
    await readCR("select device");

    // Enter program mode
    await send([0x50]); // 'P'
    await readCR("enter program mode");

    // Chip erase
    await send([0x65]); // 'e'
    await readCR("chip erase");
    onProgress("Chip erased. Writing flash…");

    // Write flash pages
    const flashData = parseIntelHex(hex);
    const len = pageAlign(flashData);
    const PAGE = 128;

    for (let addr = 0; addr < len; addr += PAGE) {
      const wordAddr = addr >> 1;
      await send([0x41, (wordAddr >> 8) & 0xff, wordAddr & 0xff]);
      await readCR("set address");

      const chunk = flashData.slice(addr, addr + PAGE);
      await send([0x42, 0x00, PAGE, 0x46, ...Array.from(chunk)]);
      await readCR("write block");

      const pct = Math.round(((addr + PAGE) / len) * 100);
      onProgress(`Writing… ${pct}%`);
    }

    // Leave program mode
    await send([0x4c]); // 'L'
    await readCR("leave program mode");

    // Exit bootloader — board resets and runs the sketch
    await send([0x45]); // 'E'

    onProgress("✓ Upload complete! Your Arduino is starting up…");
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { await bp.close(); } catch { /* ignore */ }
  }
}
