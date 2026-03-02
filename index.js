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
<title>ssh console</title>
<style>
html,body{
  margin:0;height:100%;
  background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
  display:flex;align-items:center;justify-content:center;
  font-family:system-ui;color:#fff
}
.card{
  background:rgba(0,0,0,.45);
  backdrop-filter:blur(20px);
  border-radius:22px;
  padding:40px 50px;
  box-shadow:0 0 80px rgba(0,0,0,.8);
  text-align:center
}
h1{margin:0 0 12px;font-weight:600}
a{color:#7dd3fc;text-decoration:none;font-size:18px}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
  <h1>ssh remote console</h1>
  <a href="#" target="_blank">Ready for connections</a>
</div>
</body>
</html>`)
})

/* ================= MINECRAFT-STYLE TERMINAL ================= */
app.get("/s/:id", (req, res) => {
  if (!sessions.has(req.params.id)) return res.send("Invalid session")

  res.send(`<!DOCTYPE html>
<html>
<head>
<title>Server Console</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css">
<style>
  html, body { 
    margin: 0; padding: 0; height: 100%; 
    background: #000; font-family: 'Courier New', Courier, monospace;
    overflow: hidden; display: flex; flex-direction: column;
  }
  
  /* Header */
  .header {
    background: #1a1a1a; color: #aaa;
    padding: 10px 15px; font-size: 13px;
    border-bottom: 2px solid #333;
    display: flex; justify-content: space-between;
  }

  /* The Output Area */
  #terminal-container { 
    flex-grow: 1; 
    padding: 10px;
    background: #000;
  }

  /* The Minecraft Input Field */
  .input-area {
    background: #1a1a1a;
    padding: 15px;
    display: flex;
    border-top: 2px solid #333;
  }

  .input-area span {
    color: #55ff55; /* Minecraft Green */
    margin-right: 10px;
    font-weight: bold;
    user-select: none;
  }

  #cmd-input {
    background: transparent;
    border: none;
    color: #fff;
    flex-grow: 1;
    font-family: inherit;
    font-size: 16px;
    outline: none;
  }
</style>
</head>
<body>

<div class="header">
  <span>SERVER_CONSOLE > REMOTE_AGENT</span>
  <span>STATUS: <span style="color:#22c55e">ONLINE</span></span>
</div>

<div id="terminal-container"></div>

<div class="input-area">
  <span>></span>
  <input type="text" id="cmd-input" placeholder="Type a command..." autofocus autocomplete="off">
</div>

<script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
<script>
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 15,
    convertEol: true,
    theme: {
      background: "#000000",
      foreground: "#ffffff"
    }
  });

  const container = document.getElementById("terminal-container");
  const input = document.getElementById("cmd-input");
  
  term.open(container);
  
  // Connect WebSocket
  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const ws = new WebSocket(protocol + location.host + "/session/${req.params.id}");

  // Handle Incoming Data
  ws.onmessage = (e) => {
    // If it's a blob, we need to read it
    if (e.data instanceof Blob) {
        e.data.text().then(text => term.write(text));
    } else {
        term.write(e.data);
    }
  };

  ws.onclose = () => term.writeln("\\r\\n[SESSION CLOSED]");

  // Handle Command Submission
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = input.value;
      if (cmd.trim() !== "") {
        // Optional: Show what you typed in the console like Minecraft
        term.writeln("\\x1b[32m[User]\\x1b[0m " + cmd);
        
        // Send command to the agent
        ws.send(cmd + "\\n");
        input.value = "";
      }
    }
  });

  // Keep focus on input
  window.addEventListener("click", () => input.focus());
</script>
</body>
</html>`)
})

/* ================= SOCKETS ================= */
wss.on("connection", (ws, req) => {

  // AGENT (The VPS/Computer running the script)
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

  // BROWSER (The User viewing the console)
  if (req.url.startsWith("/session/")) {
    const id = req.url.split("/").pop()
    const s = sessions.get(id)
    if (!s) return ws.close()

    s.browser = ws
    ws.on("message", d => {
        if (s.agent && s.agent.readyState === 1) {
            s.agent.send(d);
        }
    })
    ws.on("close", () => { if (s) s.browser = null })
  }
})

server.listen(PORT, () =>
  console.log("ssh server running on", PORT)
)
