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
<title>ssh</title>
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
  <h1>ssh</h1>
  <a href="https://github.com/IamGunpoint/ssh" target="_blank">
    https://github.com/IamGunpoint/ssh
  </a>
</div>
</body>
</html>`)
})

/* ================= TERMINAL ================= */
app.get("/s/:id", (req, res) => {
  if (!sessions.has(req.params.id)) return res.send("Invalid session")

  res.send(`<!DOCTYPE html>
<html>
<head>
<title>ssh</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css">
<style>
html,body{margin:0;height:100%;background:#0b1020}
.top{
  height:52px;
  background:#0b1020;
  border-bottom:1px solid #1e293b;
  display:flex;align-items:center;
  padding:0 16px;color:#c7d2fe
}
.dot{width:12px;height:12px;border-radius:50%;margin-right:8px}
.red{background:#ef4444}
.yellow{background:#facc15}
.green{background:#22c55e}
#term{height:calc(100% - 52px)}
</style>
</head>
<body>
<div class="top">
  <div class="dot red"></div>
  <div class="dot yellow"></div>
  <div class="dot green"></div>
  <span style="margin-left:10px">ssh — live terminal</span>
</div>
<div id="term"></div>

<script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
<script>
const term = new Terminal({
  cursorBlink:true,
  fontSize:14,
  theme:{
    background:"#0b1020",
    foreground:"#e5e7eb",
    cursor:"#a5b4fc",
    selection:"#1e293b"
  }
})

term.open(document.getElementById("term"))
term.focus()

window.addEventListener("click",()=>term.focus())

const ws = new WebSocket(
  (location.protocol==="https:"?"wss://":"ws://") +
  location.host + "/session/${req.params.id}"
)

term.onData(d => ws.send(d))
ws.onmessage = e => term.write(e.data)
ws.onclose = () => term.writeln("\\r\\n[disconnected]")
</script>
</body>
</html>`)
})

/* ================= SOCKETS ================= */
wss.on("connection", (ws, req) => {

  // VPS CLIENT
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

  // BROWSER
  if (req.url.startsWith("/session/")) {
    const id = req.url.split("/").pop()
    const s = sessions.get(id)
    if (!s) return ws.close()

    s.browser = ws
    ws.on("message", d => s.agent.send(d))
    ws.on("close", () => { if (s) s.browser = null })
  }
})

server.listen(PORT, () =>
  console.log("ssh server running on", PORT)
)
