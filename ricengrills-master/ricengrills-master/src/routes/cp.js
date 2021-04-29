const express = require("express");
const router = express.Router();
const loginController = require("../controllers/cp/loginController");
const dashboardController = require("../controllers/cp/dashboardController");
const profileController = require("../controllers/cp/profileController");
const stockController = require("../controllers/cp/stockController");
const orderController = require("../controllers/cp/orderController")
const reportController = require("../controllers/cp/reportcontroller")

const isAuth = require("../middlewares/isCpAuth");

router.use((req, res, next) => {
    if (req.vhost.hostname == "cp.ricengrills.com.au") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://cp.ricengrills.com.au";
        res.locals.asset_url = "https://cp.ricengrills.com.au";
    } else if (req.vhost.hostname == "localhost") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://localhost:3000/cp";
        res.locals.asset_url = "http://localhost:3000";
    }else if (req.vhost.hostname == "3.25.120.209") {
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "http://13.25.120.209/cp";
        res.locals.asset_url = "http://3.25.120.209";
    }else if(req.vhost.hostname == "cp.rngtesting.live"){
        res.locals.SITE_NAME = "RiceNGrills";
        res.locals.app_url = "https://cp.rngtesting.live";
        res.locals.asset_url = "https://cp.rngtesting.live";
    }
    
    next();
});

router.get("/", loginController.login); //admin login
router.post("/login", loginController.validateLogin); //validate admin login
router.get("/dashboard", isAuth, orderController.index); //admin login

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

router.get("/stock", isAuth, stockController.list);
router.get("/check_stock", isAuth, stockController.checkStock);
router.post("/stock/update", isAuth, stockController.updateStock)
router.get("/stock/new", isAuth, stockController.newstock);
router.post("/stock/new", isAuth, stockController.savestock);

router.get("/orders", isAuth, orderController.index)
router.post("/orders/updated", isAuth, orderController.update)
router.get("/orders/cancelled", isAuth, orderController.cancelled)
router.get("/orders/completed", isAuth, orderController.completed)

router.get("/stock/log", isAuth, reportController.listCpstocks)
router.get("/orders/download", isAuth, reportController.collectionpointExcel)

router.get("/logout", (req, res) => {
    req.session.destroy();
    return res.redirect(res.locals.app_url);
});
router.get("*", (req, res) => {
    res.render("admin/notfound");
});
module.exports = router;