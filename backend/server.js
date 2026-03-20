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

// ─── Port Detection ───────────────────────────────────────────────────────────

function parseArduinoCliPorts(output) {
  const ports = [];
  const lines = output.trim().split('\n');
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Format: Port         Protocol  Type              Board Name  FQBN  Core
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
    let cmd;

    if (platform === 'darwin') {
      cmd = 'ls /dev/cu.* 2>/dev/null';
    } else if (platform === 'linux') {
      cmd = 'ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null';
    } else if (platform === 'win32') {
      // Use PowerShell — wmic is deprecated on Windows 11
      cmd = 'powershell -NoProfile -Command "Get-WMIObject Win32_SerialPort | ForEach-Object { $_.DeviceID + \',\' + $_.Description }" 2>nul';
    } else {
      return resolve([]);
    }

    exec(cmd, (err, stdout) => {
      if (err && !stdout) return resolve([]);
      const ports = [];

      if (platform === 'win32') {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(',');
          if (parts.length >= 1 && parts[0] && parts[0].toUpperCase().startsWith('COM')) {
            ports.push({ path: parts[0].trim(), description: parts[1] ? parts[1].trim() : 'Serial Port' });
          }
        }
      } else {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const p = line.trim();
          if (p) ports.push({ path: p, description: 'Serial Port' });
        }
      }
      resolve(ports);
    });
  });
}

app.get('/api/ports', (req, res) => {
  exec('arduino-cli board list 2>/dev/null', (err, stdout, stderr) => {
    if (err || !stdout || stdout.trim() === '' || stdout.trim().toLowerCase().startsWith('no boards')) {
      // Fallback to OS-level port listing
      getFallbackPorts().then((ports) => {
        res.json({ ports });
      });
      return;
    }

    const ports = parseArduinoCliPorts(stdout);
    if (ports.length === 0) {
      getFallbackPorts().then((fallbackPorts) => {
        res.json({ ports: fallbackPorts });
      });
    } else {
      res.json({ ports });
    }
  });
});

// ─── CLI Check ────────────────────────────────────────────────────────────────

app.get('/api/check-cli', (req, res) => {
  // Node exec uses a minimal PATH — probe common install locations explicitly
  const candidates = [
    'arduino-cli',
    '/opt/homebrew/bin/arduino-cli',  // Apple Silicon Mac
    '/usr/local/bin/arduino-cli',     // Intel Mac
    'C:\\Windows\\System32\\arduino-cli.exe',
  ];

  const tryNext = (i) => {
    if (i >= candidates.length) return res.json({ installed: false, version: null });
    exec(`"${candidates[i]}" version 2>&1`, (err, stdout) => {
      if (err || !stdout) return tryNext(i + 1);
      // Output: "arduino-cli  Version: 1.4.1 Commit: ..."
      const match = stdout.match(/Version:\s*([\d.]+)/i) || stdout.match(/([\d]+\.[\d]+\.[\d]+)/);
      if (match) return res.json({ installed: true, version: match[1] });
      if (stdout.toLowerCase().includes('arduino-cli')) return res.json({ installed: true, version: null });
      tryNext(i + 1);
    });
  };

  tryNext(0);
});

// ─── Sketch Generation ────────────────────────────────────────────────────────

function generateSketch(buttons) {
  const n = buttons.length;
  const pins = buttons.map((b) => b.pin).join(', ');
  const keys = buttons
    .map((b) => {
      if (b.arduinoKey.startsWith('KEY_')) {
        return b.arduinoKey;
      }
      return `'${b.arduinoKey}'`;
    })
    .join(', ');

  return `#include <Keyboard.h>

const int numButtons = ${n};
const int buttonPins[${n}] = {${pins}};
const int keyValues[${n}] = {${keys}};
bool lastButtonState[${n}];

void setup() {
  for (int i = 0; i < numButtons; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
    lastButtonState[i] = HIGH;
  }
  Keyboard.begin();
}

void loop() {
  for (int i = 0; i < numButtons; i++) {
    bool state = digitalRead(buttonPins[i]);
    if (state != lastButtonState[i]) {
      delay(20);
      state = digitalRead(buttonPins[i]);
      if (state != lastButtonState[i]) {
        if (state == LOW) {
          Keyboard.press(keyValues[i]);
        } else {
          Keyboard.release(keyValues[i]);
        }
        lastButtonState[i] = state;
      }
    }
  }
}
`;
}

app.post('/api/sketch', (req, res) => {
  const { buttons } = req.body;
  if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
    return res.status(400).json({ error: 'No buttons provided' });
  }
  const sketch = generateSketch(buttons);
  res.json({ sketch });
});

// ─── Upload via SSE ───────────────────────────────────────────────────────────

app.post('/api/upload', (req, res) => {
  const { port, sketch } = req.body;

  if (!port) {
    return res.status(400).json({ error: 'No port specified' });
  }
  if (!sketch || typeof sketch !== 'string' || !sketch.trim()) {
    return res.status(400).json({ error: 'No sketch provided' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(type, data) {
    const payload = JSON.stringify({ type, data });
    res.write(`data: ${payload}\n\n`);
  }

  // Create temp directory for the sketch
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-sketch-'));
  const sketchName = path.basename(tmpDir);
  const sketchDir = path.join(tmpDir, sketchName);
  fs.mkdirSync(sketchDir);
  const sketchFile = path.join(sketchDir, `${sketchName}.ino`);

  fs.writeFileSync(sketchFile, sketch, 'utf8');

  sendEvent('info', `Sketch written to ${sketchFile}`);
  sendEvent('info', 'Starting compilation...');

  let uploadProcess = null;

  const compile = spawn('arduino-cli', [
    'compile',
    '--fqbn', 'arduino:avr:leonardo',
    sketchDir,
  ]);

  compile.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) sendEvent('log', line.trim());
    }
  });

  compile.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) sendEvent('log', line.trim());
    }
  });

  compile.on('close', (code) => {
    if (code !== 0) {
      sendEvent('error', `Compilation failed with exit code ${code}`);
      sendEvent('done', JSON.stringify({ success: false }));
      res.end();
      cleanup();
      return;
    }

    sendEvent('success', 'Compilation successful!');
    sendEvent('info', `Uploading to ${port}...`);

    const upload = uploadProcess = spawn('arduino-cli', [
      'upload',
      '-p', port,
      '--fqbn', 'arduino:avr:leonardo',
      sketchDir,
    ]);

    upload.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) sendEvent('log', line.trim());
      }
    });

    upload.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) sendEvent('log', line.trim());
      }
    });

    upload.on('close', (uploadCode) => {
      if (uploadCode !== 0) {
        sendEvent('error', `Upload failed with exit code ${uploadCode}`);
        sendEvent('done', JSON.stringify({ success: false }));
      } else {
        sendEvent('success', 'Upload complete! Your Arduino is ready.');
        sendEvent('done', JSON.stringify({ success: true }));
      }
      res.end();
      cleanup();
    });
  });

  function cleanup() {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  }

  req.on('close', () => {
    compile.kill();
    if (uploadProcess) uploadProcess.kill();
    cleanup();
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     Arduino Button Mapper - Backend        ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Server running at http://localhost:${PORT}   ║`);
  console.log('║                                            ║');
  console.log('║  Make sure arduino-cli is installed and    ║');
  console.log('║  the Arduino AVR core is installed:        ║');
  console.log('║  arduino-cli core install arduino:avr      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});
