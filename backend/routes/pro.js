const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getProDashboard,
  getProSuppliers,
  getProSupplierDetail,
  getProAlerts,
  acknowledgeProAlert,
  resolveProAlert,
} = require('../controllers/pro')

router.get('/dashboard', requireAuth, getProDashboard)
router.get('/suppliers', requireAuth, getProSuppliers)
router.get('/suppliers/:id/detail', requireAuth, getProSupplierDetail)
router.get('/alerts', requireAuth, getProAlerts)
router.post('/alerts/:id/acknowledge', requireAuth, acknowledgeProAlert)
router.post('/alerts/:id/resolve', requireAuth, resolveProAlert)

module.exports = router

