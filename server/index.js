const cors = require('cors')
const express = require('express')
const authRouter = require('./routes/auth')
const adminRouter = require('./routes/admin')
const jobsRouter = require('./routes/jobs')

const app = express()
const port = process.env.PORT || 5000

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500

  res.status(statusCode).json({
    error: error.message || 'Internal server error',
  })
})

app.listen(port, () => {
  console.log(`SahakarWorks server listening on port ${port}`)
})
