const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { getMoneyOverview, postScenario, patchCarbonPrice } = require('../controllers/moneyLayer')

router.get('/overview', requireAuth, getMoneyOverview)
router.post('/scenario', requireAuth, postScenario)
router.patch('/carbon-price', requireAuth, patchCarbonPrice)

module.exports = router
