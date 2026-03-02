import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import crypto from "crypto"

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })
const PORT = process.env.PORT || 3000

const sessions = new Map()

/* ================= HOME ================= */
app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<title>SSH | BY AMAN</title>
<style>
  body { margin:0; height:100vh; background:#0a0a0c; display:flex; align-items:center; justify-content:center; font-family: 'Inter', sans-serif; color:#fff; }
  .status-card { background:#111114; border:1px solid #27272a; padding:3rem; border-radius:12px; text-align:center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
  h1 { font-size:1.5rem; letter-spacing:-0.025em; margin-bottom:0.5rem; color:#f4f4f5; }
  p { color:#71717a; margin-bottom:1.5rem; }
  .dot { display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:8px; box-shadow:0 0 10px #22c55e; }
</style>
</head>
<body>
  <div class="status-card">
    <div style="margin-bottom:1rem"><span class="dot"></span><span style="color:#22c55e; font-size:12px; font-weight:bold; text-transform:uppercase;">System Online</span></div>
    <h1>Secure Agent Gateway</h1>
    <br>
<style>@import 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';body{margin:0;height:100vh;background:#0a0a0c;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif}a{padding:12px 24px;background:#111114;color:#3b82f6;text-decoration:none;border:1px solid #27272a;border-radius:8px;font-weight:600;font-size:14px;transition:all .2s ease;box-shadow:0 4px 12px rgba(0,0,0,.5)}a:hover{background:#1c1c1f;border-color:#3b82f6;color:#60a5fa;transform:translateY(-1px);box-shadow:0 6px 20px rgba(59,130,246,.15)}</style><a href="https://github.com/IamGunpoint/ssh">Install System</a>
  </div>
</body>
</html>`)
})

/* ================= PROFESSIONAL TERMINAL ================= */
app.get("/s/:id", (req, res) => {
  if (!sessions.has(req.params.id)) return res.status(404).send("Session Expired")

  res.send(`<!DOCTYPE html>
<html>
<head>
<title>Terminal | BY AMAN</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css">
<style>
  body { margin:0; padding:0; height:100vh; background:#0a0a0c; overflow:hidden; display:flex; flex-direction:column; }
  
  /* Top Navigation Bar */
  .toolbar {
    height: 40px; background: #111114; border-bottom: 1px solid #27272a;
    display: flex; align-items: center; padding: 0 20px;
    justify-content: space-between; user-select: none;
  }
  .toolbar-left { display: flex; align-items: center; gap: 15px; }
  .tab { background: #1c1c1f; color: #a1a1aa; padding: 6px 16px; border-radius: 6px 6px 0 0; font-size: 12px; border: 1px solid #27272a; border-bottom: none; }
  .status-indicator { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #71717a; font-weight: 500; }
  .pulse { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; }

  /* Terminal Container */
  #terminal-wrapper { flex: 1; padding: 10px; background: #0a0a0c; }
  .xterm-viewport::-webkit-scrollbar { width: 8px; }
  .xterm-viewport::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
</style>
</head>
<body>

<div class="toolbar">
  <div class="toolbar-left">
    <div class="tab">BY AMAN</div>
    <div class="status-indicator"><div class="pulse"></div> SSH ACTIVE</div>
  </div>
  <div style="color:#3f3f46; font-size:11px; font-family:monospace;">AES-256-GCM</div>
</div>

<div id="terminal-wrapper"></div>

<script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit/lib/xterm-addon-fit.js"></script>

<script>
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"Cascadia Code", Menlo, monospace',
    theme: {
      background: "#0a0a0c",
      foreground: "#e4e4e7",
      cursor: "#3b82f6",
      selection: "rgba(59, 130, 246, 0.3)",
      black: "#000000", red: "#ef4444", green: "#22c55e", yellow: "#f59e0b",
      blue: "#3b82f6", magenta: "#a855f7", cyan: "#06b6d4", white: "#fafafa"
    }
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(document.getElementById("terminal-wrapper"));
  fitAddon.fit();

  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const ws = new WebSocket(protocol + location.host + "/session/${req.params.id}");

  // Standard Terminal Interaction: Type directly into terminal
  term.onData(data => ws.send(data));

  ws.onmessage = async (e) => {
    const data = (e.data instanceof Blob) ? await e.data.text() : e.data;
    term.write(data);
  };

  ws.onclose = () => {
    term.writeln("\\r\\n\\x1b[31m[System] Session disconnected.\\x1b[0m");
  };

  window.onresize = () => fitAddon.fit();
  window.onclick = () => term.focus();
  term.focus();
</script>
</body>
</html>`)
})

/* ================= SOCKET LOGIC ================= */
wss.on("connection", (ws, req) => {
  if (req.url === "/agent") {
    const id = crypto.randomBytes(6).toString("hex")
    sessions.set(id, { agent: ws, browser: null })
    ws.send(JSON.stringify({ url: `/s/${id}` }))

    ws.on("message", d => {
      const s = sessions.get(id)
      if (s?.browser) s.browser.send(d)
    })
    ws.on("close", () => sessions.delete(id))
    return
  }

  if (req.url.startsWith("/session/")) {
    const id = req.url.split("/").pop()
    const s = sessions.get(id)
    if (!s) return ws.close()

    s.browser = ws
    ws.on("message", d => { if (s.agent?.readyState === 1) s.agent.send(d) })
    ws.on("close", () => { if (s) s.browser = null })
  }
})

server.listen(PORT, () => console.log("Professional SSH Server on", PORT))
