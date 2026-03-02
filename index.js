import express from "express"
import http from "http"
import { WebSocketServer } from "ws"
import crypto from "crypto"

const PORT = process.env.PORT || 3000

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

/*
  sessions:
  id -> { agent, browser }
*/
const sessions = new Map()

/* ---------- ROUTES ---------- */
app.get("/", (_, res) => {
  res.send("<h2>amanSSH running</h2>")
})

app.get("/s/:id", (req, res) => {
  if (!sessions.has(req.params.id)) {
    return res.status(404).send("Session not found")
  }

  res.send(`
<!DOCTYPE html>
<html>
<body style="margin:0;background:#020617;color:#fff">
<div id="t" style="height:100vh"></div>
<script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
<script>
const term = new Terminal({ cursorBlink:true })
term.open(document.getElementById("t"))

const ws = new WebSocket(
  (location.protocol==="https:"?"wss://":"ws://") +
  location.host + "/session/${req.params.id}"
)

ws.onmessage = e => term.write(e.data)
term.onData(d => ws.send(d))
</script>
</body>
</html>
`)
})

/* ---------- WEBSOCKETS ---------- */
wss.on("connection", (ws, req) => {

  // ===== AGENT CONNECT =====
  if (req.url === "/agent") {
    const id = crypto.randomBytes(6).toString("hex")

    sessions.set(id, { agent: ws, browser: null })

    ws.send(JSON.stringify({
      id,
      url: `/s/${id}`
    }))

    ws.on("message", data => {
      const session = sessions.get(id)
      if (session?.browser) {
        session.browser.send(data)
      }
    })

    ws.on("close", () => sessions.delete(id))
    return
  }

  // ===== BROWSER CONNECT =====
  if (req.url.startsWith("/session/")) {
    const id = req.url.split("/").pop()
    const session = sessions.get(id)
    if (!session) return ws.close()

    session.browser = ws

    ws.on("message", data => {
      if (session.agent) {
        session.agent.send(data)
      }
    })

    ws.on("close", () => {
      if (session) session.browser = null
    })
  }
})

server.listen(PORT, () =>
  console.log("amanSSH server running on", PORT)
)
