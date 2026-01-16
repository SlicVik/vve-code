import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'
import executeRouter from './routes/execute.js'
import { rateLimiter } from './middleware/rateLimit.js'

const PORT = process.env.PORT || 3001

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json({ limit: '5kb' })) // Max payload per design doc

// Rate limiting on execute endpoint
app.use('/api/execute', rateLimiter)

// Routes
app.use('/api', executeRouter)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() })
})

// WebSocket server for Yjs collaboration
const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
    // Extract room ID from URL path (e.g., ws://host/room-id)
    const roomId = req.url?.slice(1) || 'default-room'
    console.log(`[WS] Client connected to room: ${roomId}`)

    setupWSConnection(ws, req, { docName: roomId })
})

server.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║         VVE Code Gateway                 ║
  ╠══════════════════════════════════════════╣
  ║  HTTP API:  http://localhost:${PORT}/api   ║
  ║  WebSocket: ws://localhost:${PORT}         ║
  ╚══════════════════════════════════════════╝
  `)
})
