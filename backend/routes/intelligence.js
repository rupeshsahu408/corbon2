const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getOverview,
  getAlerts,
  acknowledgeAlert,
  getSupplierScores,
  getForecast,
  getBenchmark,
  getPeriodCompare,
  chatAssistant,
  clearAssistantConversation,
} = require('../controllers/intelligence')

router.get('/overview', requireAuth, getOverview)
router.get('/alerts', requireAuth, getAlerts)
router.post('/alerts/:id/acknowledge', requireAuth, acknowledgeAlert)
router.get('/supplier-scores', requireAuth, getSupplierScores)
router.get('/forecast', requireAuth, getForecast)
router.get('/benchmark', requireAuth, getBenchmark)
router.get('/period-compare', requireAuth, getPeriodCompare)
router.post('/assistant/chat', requireAuth, chatAssistant)
router.post('/assistant/clear', requireAuth, clearAssistantConversation)

module.exports = router
