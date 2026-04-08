const crypto = require('crypto')

function getKey() {
  const raw = process.env.MASTER_KEY || ''
  if (!raw) {
    throw new Error('Missing MASTER_KEY for encryption (set in backend/.env)')
  }
  // Expect 64 hex chars (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex')
  }
  // Otherwise derive key from passphrase
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptJson(obj) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

function decryptJson(b64) {
  const key = getKey()
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  return JSON.parse(plaintext)
}

module.exports = { encryptJson, decryptJson }

