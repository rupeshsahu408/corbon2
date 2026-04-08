const router = require('express').Router()
const { getSupplierInvitePublic } = require('../controllers/invites')

router.get('/supplier/:token', getSupplierInvitePublic)

module.exports = router
