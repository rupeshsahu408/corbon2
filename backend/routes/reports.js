const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getReport,
  saveReport,
  getSavedReports,
  createInventorySnapshot,
  listInventorySnapshots,
} = require('../controllers/reports')

router.get('/', requireAuth, getReport)
router.post('/save', requireAuth, saveReport)
router.get('/saved', requireAuth, getSavedReports)
router.post('/inventory-snapshot', requireAuth, createInventorySnapshot)
router.get('/inventory-snapshots', requireAuth, listInventorySnapshots)

module.exports = router
