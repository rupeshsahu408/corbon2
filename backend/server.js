require('dotenv').config()
const express = require('express')
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const openapi = require('./openapi.json')

const authRoutes = require('./routes/auth')
const supplierRoutes = require('./routes/suppliers')
const emissionsRoutes = require('./routes/emissions')
const reportRoutes = require('./routes/reports')
const directEmissionsRoutes = require('./routes/directEmissions')
const intelligenceRoutes = require('./routes/intelligence')
const platformRoutes = require('./routes/platform')
const enterpriseRoutes = require('./routes/enterprise')
const publicApiRoutes = require('./routes/publicApi')
const proRoutes = require('./routes/pro')
const invoiceRoutes = require('./routes/invoice')
const supplierPortalRoutes = require('./routes/supplierPortal')
const inviteRoutes = require('./routes/invites')
const moneyLayerRoutes = require('./routes/moneyLayer')
const trustRoutes = require('./routes/trust')
const disclosureRoutes = require('./routes/disclosure')
const { initDB } = require('./models/db')
const { getPublicMethodology } = require('./config/methodology')
const { runAutomatedReminders } = require('./controllers/suppliers')
const { recoverExpiredIntegrationCircuits } = require('./services/integrationSync')

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigins = [
  ...(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
].filter(Boolean)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true
  // Allow Vercel preview/prod domains for this project family.
  if (/^https:\/\/corbon2(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return true
  return false
}

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser/server-to-server requests (no Origin header).
    if (isAllowedOrigin(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/emissions', emissionsRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/direct-emissions', directEmissionsRoutes)
app.use('/api/intelligence', intelligenceRoutes)
app.use('/api/platform', platformRoutes)
app.use('/api/enterprise', enterpriseRoutes)
app.use('/api/public/v1', publicApiRoutes)
app.use('/api/pro', proRoutes)
app.use('/api', invoiceRoutes)
app.use('/api/supplier', supplierPortalRoutes)
app.use('/api/invites', inviteRoutes)
app.use('/api/money', moneyLayerRoutes)
app.use('/api/trust', trustRoutes)
app.use('/api/disclosure', disclosureRoutes)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi))

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.get('/api/methodology', (_, res) => res.json(getPublicMethodology()))

app.use((err, req, res, next) => {
  console.error('[Error]', err.message)
  res.status(500).json({ message: err.message || 'Internal server error' })
})

initDB()
  .then(() => {
    setInterval(() => {
      runAutomatedReminders().catch((err) => {
        console.error('[Automation] Reminder run failed:', err.message)
      })
    }, 60 * 60 * 1000)

    runAutomatedReminders().catch((err) => {
      console.error('[Automation] Initial reminder run failed:', err.message)
    })

    setInterval(() => {
      recoverExpiredIntegrationCircuits().catch((err) => {
        console.error('[Automation] Circuit recovery failed:', err.message)
      })
    }, 5 * 60 * 1000)

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[CarbonFlow Backend] running on http://localhost:${PORT}`)
    })
  })
  .catch(err => {
    console.error('[Fatal] DB init failed:', err?.message || err)
    process.exit(1)
  })
