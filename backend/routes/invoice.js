const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { uploadInvoice, confirmInvoice } = require('../controllers/invoice')

router.post('/upload-invoice', requireAuth, ...uploadInvoice)
router.post('/confirm-invoice', requireAuth, confirmInvoice)

module.exports = router
