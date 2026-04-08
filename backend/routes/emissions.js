const router = require('express').Router()
const { getSupplierForm, submitEmissions } = require('../controllers/emissions')

router.get('/form/:token', getSupplierForm)
router.post('/submit/:token', submitEmissions)

module.exports = router
