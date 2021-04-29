const express = require("express");
const router = express.Router();
const auth = require("./auth");

const userController = require("../controllers/api/userController");
const generalController = require("../controllers/api/generalController")


const userRouter = require('./api/user')
const driverRouter = require('./api/driver')

const userApi = require('../middlewares/userApi')

router.use((req, res, next) => {
    if (req.vhost.hostname == "api.ricengrills.com.au") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://api.ricengrills.com.au";
        res.locals.asset_url = "https://api.ricengrills.com.au";
    }else if (req.vhost.hostname == "localhost") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://api.ricengrills.com";
        res.locals.asset_url = "http://api.ricengrills.com";
    }else if(req.vhost.hostname == "3.25.120.209"){
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://3.25.120.209";
        res.locals.asset_url = "http://3.25.120.209";
    }else if(req.vhost.hostname == "api.rngtesting.live"){
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://api.rngtesting.live";
        res.locals.asset_url = "https://api.rngtesting.live";
    }
    next();
});

router.get('/general-settings', auth.optional, generalController.getSettings)
router.get('/suburbs', auth.optional, generalController.getSuburbs)

router.use('/user',userApi,userRouter) //userApi middleware
router.use('/driver', driverRouter)

router.get('/user-app-banner',auth.optional,generalController.userBanner)
module.exports = router