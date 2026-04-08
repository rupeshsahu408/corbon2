const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getSuppliers, addSupplier, deleteSupplier, getStats,
  getAnalytics, bulkUpload, sendReminders, getSupplierTags,
  sendSupplierInvite, sendSupplierReminder, getSupplierData, createSupplierDocumentStub,
  getSupplierScorecards, getScope3Hotspots,
} = require('../controllers/suppliers')

router.get('/stats', requireAuth, getStats)
router.get('/analytics', requireAuth, getAnalytics)
router.get('/scorecards', requireAuth, getSupplierScorecards)
router.get('/hotspots', requireAuth, getScope3Hotspots)
router.get('/tags', requireAuth, getSupplierTags)
router.get('/', requireAuth, getSuppliers)
router.post('/', requireAuth, addSupplier)
router.delete('/:id', requireAuth, deleteSupplier)
router.post('/bulk-upload', requireAuth, ...bulkUpload)
router.post('/send-reminders', requireAuth, sendReminders)
router.get('/:id/data', requireAuth, getSupplierData)
router.post('/:id/resend-invite', requireAuth, sendSupplierInvite)
router.post('/:id/send-reminder', requireAuth, sendSupplierReminder)
router.post('/:id/documents', requireAuth, ...createSupplierDocumentStub)

module.exports = router
