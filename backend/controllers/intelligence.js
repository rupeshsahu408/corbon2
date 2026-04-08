const intelligenceService = require('../services/intelligence/intelligenceService')

async function getOverview(req, res) {
  try {
    const forceRefresh = req.query.refresh === 'true'
    const data = await intelligenceService.getOverview(req.uid, req.email, forceRefresh)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getOverview]', err.message)
    res.status(500).json({ message: err.message || 'Failed to load intelligence overview' })
  }
}

async function getAlerts(req, res) {
  try {
    const data = await intelligenceService.getAlerts(req.uid, req.email, req.query.status || 'open')
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getAlerts]', err.message)
    res.status(500).json({ message: err.message || 'Failed to load alerts' })
  }
}

async function acknowledgeAlert(req, res) {
  try {
    const data = await intelligenceService.acknowledgeAlert(req.uid, req.email, req.params.id)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.acknowledgeAlert]', err.message)
    res.status(404).json({ message: err.message || 'Failed to acknowledge alert' })
  }
}

async function getSupplierScores(req, res) {
  try {
    const data = await intelligenceService.getSupplierScores(req.uid, req.email)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getSupplierScores]', err.message)
    res.status(500).json({ message: err.message || 'Failed to load supplier scores' })
  }
}

async function getForecast(req, res) {
  try {
    const data = await intelligenceService.getForecast(req.uid, req.email)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getForecast]', err.message)
    res.status(500).json({ message: err.message || 'Failed to load forecast' })
  }
}

async function getBenchmark(req, res) {
  try {
    const data = await intelligenceService.getBenchmark(req.uid, req.email)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getBenchmark]', err.message)
    res.status(500).json({ message: err.message || 'Failed to load benchmark' })
  }
}

async function getPeriodCompare(req, res) {
  try {
    const current = req.query.current
    const previous = req.query.previous
    if (!current || !previous) {
      return res.status(400).json({ message: 'current and previous periods are required (YYYY-MM)' })
    }
    const data = await intelligenceService.getPeriodCompare(req.uid, req.email, current, previous)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.getPeriodCompare]', err.message)
    res.status(500).json({ message: err.message || 'Failed to compare periods' })
  }
}

async function chatAssistant(req, res) {
  try {
    const question = String(req.body?.question || '').trim()
    if (!question) return res.status(400).json({ message: 'question is required' })
    const data = await intelligenceService.chatAssistant(req.uid, req.email, question)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.chatAssistant]', err.message)
    res.status(500).json({ message: err.message || 'Assistant failed' })
  }
}

async function clearAssistantConversation(req, res) {
  try {
    const data = await intelligenceService.clearAssistantConversation(req.uid, req.email)
    res.json(data)
  } catch (err) {
    console.error('[intelligence.clearAssistantConversation]', err.message)
    res.status(500).json({ message: err.message || 'Failed to clear conversation' })
  }
}

module.exports = {
  getOverview,
  getAlerts,
  acknowledgeAlert,
  getSupplierScores,
  getForecast,
  getBenchmark,
  getPeriodCompare,
  chatAssistant,
  clearAssistantConversation,
}
