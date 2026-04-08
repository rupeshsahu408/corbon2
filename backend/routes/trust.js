const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { getTrustOverview } = require('../controllers/trust')

router.get('/overview', requireAuth, getTrustOverview)

module.exports = router
