const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const {
  getMe,
  upsertSupplierProfile,
  connectSupplier,
  updateSupplierSharing,
  submitSharedEmission,
  getSupplierDashboard,
  createDataRequest,
  getCompanyNetwork,
  discoverSuppliers,
  getSupplierMarketplace,
  connectSupplierProfile,
  updateDataRequestStatus,
} = require('../controllers/platform')

router.get('/me', requireAuth, getMe)
router.post('/supplier/profile', requireAuth, upsertSupplierProfile)
router.get('/supplier/dashboard', requireAuth, getSupplierDashboard)
router.post('/supplier/emissions', requireAuth, submitSharedEmission)
router.patch('/supplier/sharing/:companyId', requireAuth, updateSupplierSharing)

router.post('/company/connect-supplier', requireAuth, connectSupplier)
router.post('/company/data-request', requireAuth, createDataRequest)
router.get('/company/network', requireAuth, getCompanyNetwork)
router.get('/company/discover-suppliers', requireAuth, discoverSuppliers)
router.get('/company/marketplace', requireAuth, getSupplierMarketplace)
router.post('/company/connect-supplier/:supplierProfileId', requireAuth, connectSupplierProfile)
router.patch('/supplier/requests/:id/status', requireAuth, updateDataRequestStatus)

module.exports = router
