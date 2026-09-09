const cors = require('cors')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const authRouter = require('./routes/auth')
const adminRouter = require('./routes/admin')
const jobsRouter = require('./routes/jobs')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
const port = process.env.PORT || 5000
const userSockets = new Map()
const socketUsers = new Map()

app.set('io', io)
app.set('userSockets', userSockets)
app.set('socketUsers', socketUsers)

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/admin', adminRouter)

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId || socket.handshake.query.userId

  if (userId) {
    socketUsers.set(socket.id, String(userId))
    const sockets = userSockets.get(String(userId)) || new Set()
    sockets.add(socket.id)
    userSockets.set(String(userId), sockets)
  }

  socket.on('disconnect', () => {
    socketUsers.delete(socket.id)
    if (!userId) return

    const sockets = userSockets.get(String(userId))
    sockets?.delete(socket.id)

    if (sockets?.size === 0) {
      userSockets.delete(String(userId))
    }
  })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500

  res.status(statusCode).json({
    error: error.message || 'Internal server error',
  })
})

server.listen(port, () => {
  console.log(`SahakarWorks server listening on port ${port}`)
})
