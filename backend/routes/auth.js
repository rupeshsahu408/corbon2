const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { registerCompany, getCompany, updateOnboarding, registerSupplier } = require('../controllers/auth')

router.post('/register', requireAuth, registerCompany)
router.post('/register-supplier', requireAuth, registerSupplier)
router.get('/company', requireAuth, getCompany)
router.post('/onboarding', requireAuth, updateOnboarding)

module.exports = router
