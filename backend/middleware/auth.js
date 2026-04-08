const admin = require('firebase-admin')

let initialized = false

function initFirebaseAdmin() {
  if (initialized) return
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson)
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    } else {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })
    }
    initialized = true
    console.log('[Firebase Admin] Initialized')
  } catch (err) {
    console.error('[Firebase Admin] Init error:', err.message)
  }
}

initFirebaseAdmin()

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: no token' })
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.uid = decoded.uid
    req.email = decoded.email
    next()
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message)
    return res.status(401).json({ message: 'Unauthorized: invalid token' })
  }
}

module.exports = { requireAuth }
