const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getDirectEmissions,
  addDirectEmission,
  deleteDirectEmission,
  getAuditLog,
  bulkUploadDirectEmissions,
  uploadDirectCsv,
} = require('../controllers/directEmissions')

router.get('/', requireAuth, getDirectEmissions)
router.post('/', requireAuth, addDirectEmission)
router.post('/bulk-upload', requireAuth, uploadDirectCsv, bulkUploadDirectEmissions)
router.delete('/:id', requireAuth, deleteDirectEmission)
router.get('/audit', requireAuth, getAuditLog)

module.exports = router
