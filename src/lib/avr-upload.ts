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

async function readExact(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  n: number,
  timeoutMs = 4000
): Promise<Uint8Array> {
  const buf: number[] = [];
  const deadline = Date.now() + timeoutMs;
  while (buf.length < n) {
    if (Date.now() > deadline) throw new Error("Read timeout — is the Arduino in bootloader mode?");
    const { value, done } = await reader.read();
    if (done) throw new Error("Port closed unexpectedly");
    if (value) buf.push(...Array.from(value));
  }
  return new Uint8Array(buf.slice(0, n));
}

/**
 * Full compile-and-upload flow:
 *  1. POST /api/compile → receive .hex
 *  2. Web Serial: 1200-baud touch to trigger bootloader
 *  3. Web Serial: avr109 (Catarina) protocol to flash the .hex
 */
export async function compileAndUpload(
  backendUrl: string,
  sketch: string,
  onProgress: Progress
): Promise<void> {
  // ── Check Web Serial support ─────────────────────────────────────────────
  if (!("serial" in navigator)) {
    throw new Error(
      "Web Serial API not available. Open this page in Chrome or Edge (not Firefox/Safari)."
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;

  // ── Step 1: Compile on backend ───────────────────────────────────────────
  onProgress("Sending code to backend for compilation…");
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sketch, fqbn: "arduino:avr:leonardo" }),
    });
  } catch {
    throw new Error(
      `Cannot reach the compile server at ${backendUrl}. ` +
      "Make sure the backend is running and NEXT_PUBLIC_BACKEND_URL is set correctly."
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let errMsg = "Unknown error";
    try { const j = JSON.parse(text); errMsg = j.error ?? errMsg; } catch { errMsg = text.slice(0, 200) || `HTTP ${res.status}`; }
    throw new Error(`Compilation failed (HTTP ${res.status}): ${errMsg}`);
  }
  const { hex } = await res.json();
  onProgress("Compilation successful!");

  // ── Step 2: Request port ─────────────────────────────────────────────────
  onProgress("Select your Arduino port in the browser dialog…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const port: any = await serial.requestPort({ filters: [] });

  // ── Step 3: 1200-baud touch (triggers Leonardo bootloader) ───────────────
  onProgress("Triggering bootloader (1200-baud touch)…");
  try {
    await port.open({ baudRate: 1200 });
    await new Promise((r) => setTimeout(r, 300));
    await port.close();
  } catch {
    // Some boards don't need this; continue anyway
  }

  onProgress("Waiting for bootloader to start…");
  await new Promise((r) => setTimeout(r, 2800));

  // ── Step 4: Re-open at 57600 for avr109 ──────────────────────────────────
  onProgress("Connecting to bootloader…");
  try {
    await port.open({ baudRate: 57600, dataBits: 8, stopBits: 1, parity: "none" });
  } catch {
    throw new Error(
      "Could not re-open the port after bootloader reset. " +
      "On Windows the COM number may change — try clicking 'Compile & Upload' again and selecting the new port."
    );
  }

  const writer = port.writable!.getWriter();
  const reader = port.readable!.getReader();
  const send = (b: number[]) => writer.write(new Uint8Array(b));
  const read = (n: number, t?: number) => readExact(reader, n, t);
  const readCR = async (label: string) => {
    const b = await read(1);
    if (b[0] !== 0x0d) throw new Error(`${label}: expected CR, got 0x${b[0].toString(16)}`);
  };

  try {
    // Verify it's a Catarina/avr109 bootloader
    await send([0x53]); // 'S' — software identifier
    const idBytes = await read(7, 3000);
    const id = String.fromCharCode(...Array.from(idBytes));
    if (!id.includes("CATERIN") && !id.includes("Arduino")) {
      throw new Error(`Unexpected bootloader: "${id.trim()}" — make sure it's an Arduino Leonardo or compatible board`);
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
    onProgress("Chip erased. Writing…");

    // Write flash pages
    const flashData = parseIntelHex(hex);
    const len = pageAlign(flashData);
    const PAGE = 128;

    for (let addr = 0; addr < len; addr += PAGE) {
      // Set word address ('A')
      const wordAddr = addr >> 1;
      await send([0x41, (wordAddr >> 8) & 0xff, wordAddr & 0xff]);
      await readCR("set address");

      // Block write ('B' + size_hi + size_lo + 'F' + data)
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
    try { await port.close(); } catch { /* ignore */ }
  }
}
