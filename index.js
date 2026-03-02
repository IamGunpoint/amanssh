import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import crypto from "crypto"

const PORT = 3000
const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

/*
  sessions map:
  sessionId -> agent websocket
*/
const sessions = new Map()

/* ======================
   HTML TEMPLATE
====================== */
const indexHTML = (id) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>amanSSH • Web Terminal</title>

<!-- xterm -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />

<style>
:root {
  --bg: #0b0f14;
  --panel: #111827;
  --panel-2: #0f172a;
  --border: #1f2937;
  --text: #e5e7eb;
  --muted: #9ca3af;
  --accent: #38bdf8;
}

* {
  box-sizing: border-box;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  margin: 0;
  background: radial-gradient(1200px 600px at 20% -10%, #1e293b, transparent),
              radial-gradient(800px 500px at 90% 10%, #020617, transparent),
              var(--bg);
  color: var(--text);
}

/* NAV */
nav {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.brand {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.4px;
}

.brand span {
  color: var(--accent);
}

.nav-right {
  font-size: 13px;
  color: var(--muted);
}

/* LAYOUT */
.container {
  padding: 24px;
}

.card {
  background: linear-gradient(180deg, var(--panel), var(--panel-2));
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  overflow: hidden;
}

/* HEADER */
.card-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.session {
  font-size: 13px;
  color: var(--muted);
}

/* TERMINAL */
#terminal {
  height: 70vh;
  padding: 12px;
}

/* FOOTER */
.footer {
  padding: 14px 20px;
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
}
</style>
</head>

<body>
<nav>
  <div class="brand">aman<span>SSH</span></div>
  <div class="nav-right">Secure Web Terminal</div>
</nav>

<div class="container">
  <div class="card">
    <div class="card-header">
      <div>Live Terminal</div>
      <div class="session">Session: ${id}</div>
    </div>

    <div id="terminal"></div>

    <div class="footer">
      <div>Connected via WebSocket</div>
      <div>Powered by amanSSH</div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
<script>
const term = new Terminal({
  cursorBlink: true,
  theme: {
    background: "#0b0f14",
    foreground: "#e5e7eb",
    cursor: "#38bdf8",
    selection: "#1f2937"
  }
})

term.open(document.getElementById("terminal"))
term.focus()

const ws = new WebSocket(
  (location.protocol === "https:" ? "wss://" : "ws://") +
  location.host +
  "/session/${id}"
)

ws.onopen = () => {
  term.writeln("\\x1b[32mConnected to amanSSH session\\x1b[0m")
}

ws.onmessage = (e) => term.write(e.data)
ws.onclose = () => term.writeln("\\r\\n\\x1b[31mDisconnected\\x1b[0m")

term.onData(d => ws.send(d))
</script>
</body>
</html>
`

/* ======================
   ROUTES
====================== */

app.get("/", (req, res) => {
  res.send(`
    <h2>amanSSH Server Running</h2>
    <p>Run <code>amanssh</code> on your VPS to generate a session.</p>
  `)
})

app.get("/s/:id", (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) return res.status(404).send("Session not found")
  res.send(indexHTML(id))
})

/* ======================
   WEBSOCKETS
====================== */

wss.on("connection", (ws, req) => {
  // Agent connects here
  if (req.url === "/agent") {
    const id = crypto.randomBytes(6).toString("hex")
    sessions.set(id, ws)

    ws.send(JSON.stringify({
      type: "session",
      id,
      url: `/s/${id}`
    }))

    ws.on("close", () => sessions.delete(id))
    return
  }

  // Browser session
  if (req.url.startsWith("/session/")) {
    const id = req.url.split("/").pop()
    const agent = sessions.get(id)
    if (!agent) return ws.close()

    ws.on("message", d => agent.send(d))
    agent.on("message", d => ws.send(d))
  }
})

server.listen(PORT, () => {
  console.log(`amanSSH server running on port ${PORT}`)
})
