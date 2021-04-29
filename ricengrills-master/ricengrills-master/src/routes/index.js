const express = require('express')
const router = express.Router()
const adminRouter = require('./admin')
const webRouter = require('./site')
const cpRouter = require('./cp')
const apiRouter = require('./api')
const driverRouter = require('./driver-panel')

router.use('/admin', adminRouter)
router.use('/cp', cpRouter)
router.use('/api', apiRouter)
router.use('/driver', driverRouter)
router.use('/', webRouter)

module.exports = router;