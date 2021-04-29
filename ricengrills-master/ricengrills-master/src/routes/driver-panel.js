const express = require("express");
const router = express.Router();
const loginController = require("../controllers/driver-panel/loginController");
const dashboardController = require("../controllers/driver-panel/dashboardController");
const profileController = require("../controllers/driver-panel/profileController");
const stockController = require("../controllers/driver-panel/stockController")
const orderController = require("../controllers/driver-panel/orderController")

const isAuth = require("../middlewares/isDriverPanelAuth");

router.use((req, res, next) => {
    if (req.vhost.hostname == "driver.ricengrills.com.au") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://driver.ricengrills.com.au";
        res.locals.asset_url = "https://driver.ricengrills.com.au";
    } else if (req.vhost.hostname == "localhost") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://localhost:3000/driver";
        res.locals.asset_url = "http://localhost:3000";
    }else if(req.vhost.hostname == "3.25.120.209"){
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://3.25.120.209/driver";
        res.locals.asset_url = "http://3.25.120.209";
    }else if(req.vhost.hostname == "driver.rngtesting.live"){
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://driver.rngtesting.live";
        res.locals.asset_url = "https://driver.rngtesting.live";
    }
    next();
});

router.get("/", loginController.login); //admin login
router.post("/login", loginController.validateLogin); //validate admin login

//refilling dashboard
router.get("/dashboard", isAuth, dashboardController.dashboard);
router.get("/current-stocks", isAuth, dashboardController.getCurrentStockDetails);
router.get("/cps-stocks", isAuth, dashboardController.getCollectionPoints);


//stocks
router.get("/stocks", isAuth, stockController.activeStocks)
router.get("/stock/new", isAuth, stockController.stockRequest)
router.post("/stock/new", isAuth, stockController.saveRequest)

//stock requests
router.get("/my_requests", isAuth, stockController.myRequests)
router.get("/to_collectionpoints", isAuth, stockController.toCps)
router.get("/to_drivers", isAuth, stockController.toDrivers)
router.get("/getdriverrequests_refilling",isAuth,stockController.getDriverRequests)
router.get("/getcpsrequests_refilling",isAuth,stockController.getCPRequests)

router.get("/to_drivers/:req_id", isAuth, stockController.toDriversRequest)
router.post("/to_drivers/submit", isAuth, stockController.transferStockToDriver)

router.get("/to_collectionpoints/:req_id", isAuth, stockController.toCPRequest)
router.post("/to_collectionpoints/submit", isAuth, stockController.transferStockToCollectionPoint)

router.get("/profile", isAuth, profileController.edit);
router.post("/profile", isAuth, profileController.updateProfile);
router.post(
    "/profile/update-password",
    isAuth,
    profileController.updatePassword
);
router.post("/forgot-password", profileController.forgotPassword);
router.get("/password-reset/:token", profileController.resetPassword);
router.post("/update-password", profileController.updateNewPassword);

//orders
router.get("/orders", isAuth, orderController.index)
router.get("/orders/submit/:cp_id", isAuth, orderController.submit)
router.post("/orders/submit", isAuth, orderController.transferStock)
router.get("/collectionpointwithstocks", isAuth, orderController.getCollectionPointsWithRequiredStocks)
router.get('/check_stock', isAuth, orderController.checkStock)


router.get("/logout", (req, res) => {
    req.session.destroy();
    return res.redirect(res.locals.app_url);
});
router.get("*", (req, res) => {
    res.render("admin/notfound");
});
module.exports = router;