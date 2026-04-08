const crypto = require('crypto')
const { query } = require('../models/db')
const Redis = require('ioredis')

const memoryRate = new Map()
let redis = null

function getRedis() {
  if (redis) return redis
  const url = process.env.REDIS_URL
  if (!url) return null
  redis = new Redis(url, { maxRetriesPerRequest: 1 })
  return redis
}

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function requireApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key']
  if (!rawKey) return res.status(401).json({ message: 'Missing API key' })
  const keyHash = hashKey(rawKey)
  const result = await query(
    `SELECT * FROM api_keys WHERE api_key_hash = $1 AND status = 'active' LIMIT 1`,
    [keyHash]
  )
  if (!result.rows.length) return res.status(401).json({ message: 'Invalid API key' })
  const apiKey = result.rows[0]

  const limit = parseInt(process.env.PUBLIC_API_RATE_LIMIT || '120', 10)
  const windowSeconds = 60
  const now = Date.now()
  const windowKey = Math.floor(now / (windowSeconds * 1000))
  const rateKey = `rate:${apiKey.id}:${windowKey}`
  const redisClient = getRedis()

  if (redisClient) {
    try {
      const count = await redisClient.incr(rateKey)
      if (count === 1) await redisClient.expire(rateKey, windowSeconds)
      const remaining = Math.max(0, limit - count)
      res.setHeader('X-RateLimit-Limit', String(limit))
      res.setHeader('X-RateLimit-Remaining', String(remaining))
      res.setHeader('X-RateLimit-Reset', String((windowKey + 1) * windowSeconds))
      if (count > limit) return res.status(429).json({ message: 'Rate limit exceeded' })
    } catch {
      // fall back to in-memory if Redis temporarily unavailable
      const bucket = memoryRate.get(rateKey) || { count: 0 }
      bucket.count += 1
      memoryRate.set(rateKey, bucket)
      const remaining = Math.max(0, limit - bucket.count)
      res.setHeader('X-RateLimit-Limit', String(limit))
      res.setHeader('X-RateLimit-Remaining', String(remaining))
      res.setHeader('X-RateLimit-Reset', String((windowKey + 1) * windowSeconds))
      if (bucket.count > limit) return res.status(429).json({ message: 'Rate limit exceeded' })
    }
  } else {
    const bucket = memoryRate.get(rateKey) || { count: 0 }
    bucket.count += 1
    memoryRate.set(rateKey, bucket)
    const remaining = Math.max(0, limit - bucket.count)
    res.setHeader('X-RateLimit-Limit', String(limit))
    res.setHeader('X-RateLimit-Remaining', String(remaining))
    res.setHeader('X-RateLimit-Reset', String((windowKey + 1) * windowSeconds))
    if (bucket.count > limit) return res.status(429).json({ message: 'Rate limit exceeded' })
  }

  req.apiKey = apiKey
  req.companyId = apiKey.company_id
  next()
}

function requireApiScope(scope) {
  return (req, res, next) => {
    const scopes = Array.isArray(req.apiKey?.scopes) ? req.apiKey.scopes : []
    if (scopes.includes('*') || scopes.includes(scope)) return next()
    return res.status(403).json({ message: `Missing API scope: ${scope}` })
  }
}

module.exports = { requireApiKey, requireApiScope, hashKey }
