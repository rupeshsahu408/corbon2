const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { submitSharedEmission } = require('../controllers/platform')

router.post('/emissions', requireAuth, submitSharedEmission)

module.exports = router
