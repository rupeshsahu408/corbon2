const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { exportDisclosure } = require('../controllers/disclosure')

router.get('/export', requireAuth, exportDisclosure)

module.exports = router
