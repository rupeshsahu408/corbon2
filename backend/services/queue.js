/**
 * Integration connector queue (Phase D)
 *
 * Use named queues for async ingestion jobs, e.g.:
 *   - `integration-sync` — pull normalised activity from ERP / travel / cloud providers
 *   - `integration-webhook` — replay deliveries after validation
 *
 * Pattern: producers `getQueue(name).add('jobType', payload, { attempts: 3 })`;
 * workers in `workers/worker.js` (or dedicated files) call `createWorker(name, processor)`.
 * When `REDIS_URL` is unset, `getQueue` / `createWorker` return null — HTTP handlers should degrade gracefully.
 */
const { Queue, Worker } = require('bullmq')
const Redis = require('ioredis')

const INTEGRATION_QUEUE_NAMES = {
  SYNC: 'integration-sync',
  WEBHOOK: 'integration-webhook',
}

let connection = null
function getConnection() {
  if (connection) return connection
  const url = process.env.REDIS_URL
  if (!url) return null
  connection = new Redis(url, { maxRetriesPerRequest: null })
  return connection
}

function getQueue(name) {
  const conn = getConnection()
  if (!conn) return null
  return new Queue(name, { connection: conn })
}

function createWorker(name, processor) {
  const conn = getConnection()
  if (!conn) return null
  return new Worker(name, processor, { connection: conn })
}

module.exports = { getQueue, createWorker, INTEGRATION_QUEUE_NAMES }

