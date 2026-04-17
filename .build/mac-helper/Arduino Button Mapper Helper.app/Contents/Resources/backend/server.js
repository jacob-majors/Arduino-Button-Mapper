const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const cli = await findCli();
  const ok = !!cli;
  res.status(ok ? 200 : 503).json({
    ok,
    port: Number(PORT),
    cliInstalled: ok,
  });
});

const ALLOWED_FQBNS = new Set([
  'arduino:avr:leonardo',
  'arduino:avr:micro',
]);

// ─── Resolve arduino-cli path ─────────────────────────────────────────────────

const CLI_CANDIDATES = [
  'arduino-cli',
  '/opt/homebrew/bin/arduino-cli',   // Apple Silicon Mac (Homebrew)
  '/usr/local/bin/arduino-cli',      // Intel Mac (Homebrew)
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'arduino-cli', 'arduino-cli.exe')
    : null,                          // Windows (our PowerShell installer)
].filter(Boolean);

let resolvedCli = null;

function findCli() {
  return new Promise((resolve) => {
    if (resolvedCli) return resolve(resolvedCli);
    const tryNext = (i) => {
      if (i >= CLI_CANDIDATES.length) return resolve(null);
      exec(`"${CLI_CANDIDATES[i]}" version 2>&1`, (err, stdout) => {
        if (!err && stdout && stdout.toLowerCase().includes('arduino')) {
          resolvedCli = CLI_CANDIDATES[i];
          return resolve(resolvedCli);
        }
        tryNext(i + 1);
      });
    };
    tryNext(0);
  });
}

// ─── Port Detection ───────────────────────────────────────────────────────────

function parseArduinoCliPorts(output) {
  const ports = [];
  const lines = output.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 1 && parts[0]) {
      ports.push({
        path: parts[0].trim(),
        description: parts[3] ? parts[3].trim() : (parts[2] ? parts[2].trim() : 'Unknown'),
      });
    }
  }
  return ports;
}

function getFallbackPorts() {
  return new Promise((resolve) => {
    const platform = os.platform();

    if (platform === 'darwin') {
      exec('ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null', (err, stdout) => {
        const ports = [];
        if (stdout) {
          for (const line of stdout.trim().split('\n')) {
            const p = line.trim();
            if (!p) continue;
            ports.push({ path: p, description: p.includes('usbmodem') ? 'Arduino (USB)' : 'USB Serial' });
          }
        }
        ports.sort((a, b) => (b.description === 'Arduino (USB)' ? 1 : 0) - (a.description === 'Arduino (USB)' ? 1 : 0));
        resolve(ports);
      });

    } else if (platform === 'linux') {
      exec('ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null', (err, stdout) => {
        const ports = (stdout || '').trim().split('\n')
          .map((p) => p.trim()).filter(Boolean)
          .map((p) => ({ path: p, description: 'Serial Port' }));
        resolve(ports);
      });

    } else if (platform === 'win32') {
      // Registry query is the most reliable way to list COM ports on Windows
      exec('reg query HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM 2>nul', (err, stdout) => {
        const ports = [];
        if (stdout) {
          for (const line of stdout.trim().split('\n')) {
            const match = line.match(/REG_SZ\s+(COM\d+)/i);
            if (match) {
              const comPort = match[1].trim();
              const desc = line.toLowerCase().includes('arduino') ? 'Arduino' : 'Serial Port';
              ports.push({ path: comPort, description: desc });
            }
          }
        }
        resolve(ports);
      });

    } else {
      resolve([]);
    }
  });
}

app.get('/api/ports', async (req, res) => {
  const cli = await findCli();
  if (!cli) {
    // No arduino-cli — fall back directly to OS port listing
    const ports = await getFallbackPorts();
    return res.json({ ports });
  }

  exec(`"${cli}" board list 2>/dev/null`, async (err, stdout) => {
    if (err || !stdout || stdout.trim() === '' || stdout.trim().toLowerCase().startsWith('no boards')) {
      const ports = await getFallbackPorts();
      return res.json({ ports });
    }
    const ports = parseArduinoCliPorts(stdout);
    if (ports.length === 0) {
      const fallback = await getFallbackPorts();
      return res.json({ ports: fallback });
    }
    res.json({ ports });
  });
});

// ─── CLI Check ────────────────────────────────────────────────────────────────

app.get('/api/check-cli', async (req, res) => {
  const cli = await findCli();
  if (!cli) return res.json({ installed: false, version: null });
  exec(`"${cli}" version 2>&1`, (err, stdout) => {
    const match = stdout && (stdout.match(/Version:\s*([\d.]+)/i) || stdout.match(/([\d]+\.[\d]+\.[\d]+)/));
    res.json({ installed: true, version: match ? match[1] : null });
  });
});

// ─── Compile → return .hex ────────────────────────────────────────────────────

app.post('/api/compile', async (req, res) => {
  const { sketch, fqbn = 'arduino:avr:leonardo' } = req.body;
  if (!sketch || typeof sketch !== 'string' || !sketch.trim())
    return res.status(400).json({ error: 'No sketch provided' });
  if (typeof fqbn !== 'string' || !ALLOWED_FQBNS.has(fqbn))
    return res.status(400).json({ error: 'Unsupported board target' });

  const cli = await findCli();
  if (!cli) return res.status(500).json({ error: 'arduino-cli not found. Please install it and restart the backend.' });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-sketch-'));
  const sketchName = path.basename(tmpDir);
  const sketchDir = path.join(tmpDir, sketchName);
  fs.mkdirSync(sketchDir);
  fs.writeFileSync(path.join(sketchDir, `${sketchName}.ino`), sketch, 'utf8');

  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir);

  const compile = spawn(cli, ['compile', '--fqbn', fqbn, '--output-dir', outDir, sketchDir]);
  let compileLog = '';

  compile.stdout.on('data', (d) => { compileLog += d.toString(); });
  compile.stderr.on('data', (d) => { compileLog += d.toString(); });

  compile.on('close', (code) => {
    if (code !== 0) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return res.status(400).json({ error: 'Compilation failed', log: compileLog });
    }
    // arduino-cli outputs <name>.ino.hex
    const hexFile = path.join(outDir, `${sketchName}.ino.hex`);
    if (!fs.existsSync(hexFile)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      return res.status(500).json({ error: 'No .hex file produced', log: compileLog });
    }
    const hex = fs.readFileSync(hexFile, 'utf8');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    res.json({ hex });
  });

  compile.on('error', (err) => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    res.status(500).json({ error: `Failed to start arduino-cli: ${err.message}` });
  });
});

// ─── Upload via SSE ───────────────────────────────────────────────────────────

app.post('/api/upload', async (req, res) => {
  const { port, sketch } = req.body;

  if (!port) return res.status(400).json({ error: 'No port specified' });
  if (!sketch || typeof sketch !== 'string' || !sketch.trim()) return res.status(400).json({ error: 'No sketch provided' });

  const cli = await findCli();
  if (!cli) return res.status(500).json({ error: 'arduino-cli not found. Please install it and restart the backend.' });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(type, data) {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-sketch-'));
  const sketchName = path.basename(tmpDir);
  const sketchDir = path.join(tmpDir, sketchName);
  fs.mkdirSync(sketchDir);
  const sketchFile = path.join(sketchDir, `${sketchName}.ino`);
  fs.writeFileSync(sketchFile, sketch, 'utf8');

  sendEvent('info', 'Starting compilation...');

  let uploadProcess = null;

  const compile = spawn(cli, ['compile', '--fqbn', 'arduino:avr:leonardo', sketchDir]);

  compile.stdout.on('data', (d) => d.toString().split('\n').forEach((l) => l.trim() && sendEvent('log', l.trim())));
  compile.stderr.on('data', (d) => d.toString().split('\n').forEach((l) => l.trim() && sendEvent('log', l.trim())));

  compile.on('error', (err) => {
    sendEvent('error', `Failed to start compiler: ${err.message}`);
    sendEvent('done', JSON.stringify({ success: false }));
    res.end(); cleanup();
  });

  compile.on('close', (code) => {
    if (code !== 0) {
      sendEvent('error', `Compilation failed (exit ${code})`);
      sendEvent('done', JSON.stringify({ success: false }));
      res.end(); cleanup(); return;
    }

    sendEvent('success', 'Compilation successful!');
    sendEvent('info', `Uploading to ${port}...`);

    uploadProcess = spawn(cli, ['upload', '-p', port, '--fqbn', 'arduino:avr:leonardo', sketchDir]);

    uploadProcess.stdout.on('data', (d) => d.toString().split('\n').forEach((l) => l.trim() && sendEvent('log', l.trim())));
    uploadProcess.stderr.on('data', (d) => d.toString().split('\n').forEach((l) => l.trim() && sendEvent('log', l.trim())));

    uploadProcess.on('error', (err) => {
      sendEvent('error', `Failed to start uploader: ${err.message}`);
      sendEvent('done', JSON.stringify({ success: false }));
      res.end(); cleanup();
    });

    uploadProcess.on('close', (uploadCode) => {
      if (uploadCode !== 0) {
        sendEvent('error', `Upload failed (exit ${uploadCode})`);
        sendEvent('done', JSON.stringify({ success: false }));
      } else {
        sendEvent('success', 'Upload complete! Your Arduino is ready.');
        sendEvent('done', JSON.stringify({ success: true }));
      }
      res.end(); cleanup();
    });
  });

  function cleanup() {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  req.on('close', () => {
    compile.kill();
    if (uploadProcess) uploadProcess.kill();
    cleanup();
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

// ─── Startup: ensure arduino:avr core is installed ───────────────────────────
// This self-heals if the Docker build silently skipped the core install.

function ensureAvrCore(cli) {
  return new Promise((resolve) => {
    if (!cli) return resolve();
    exec(`find /root/.arduino15/libraries/Keyboard /root/.arduino15/packages/arduino/hardware/avr -name "Keyboard.h" 2>/dev/null`, (err, stdout) => {
      if (stdout && stdout.trim()) {
        console.log('✓ arduino:avr core already installed (Keyboard.h found)');
        return resolve();
      }
      console.log('⚠ Keyboard.h not found — installing arduino:avr core now…');
      exec(`"${cli}" core update-index && "${cli}" core install arduino:avr && "${cli}" lib install "Keyboard" "Mouse"`, { timeout: 300000 }, (err2, stdout2, stderr2) => {
        if (err2) {
          console.error('✗ Failed to install arduino:avr core:', stderr2 || err2.message);
        } else {
          console.log('✓ arduino:avr core installed successfully');
        }
        resolve();
      });
    });
  });
}

app.listen(PORT, async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     Arduino Button Mapper - Backend        ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Server running at http://localhost:${PORT}   ║`);
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  const cli = await findCli();
  await ensureAvrCore(cli);
});
