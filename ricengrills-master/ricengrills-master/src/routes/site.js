const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/web/dashboardController");
const cartController = require("../controllers/web/cartController");
const loginController = require("../controllers/web/loginController");
const userController = require("../controllers/web/userController");
const paymentController = require("../controllers/web/paymentController");
const scheduledController = require("../controllers/web/scheduledController");
const bulkOrderController = require("../controllers/web/bulkOrderController");
const orderController = require("../controllers/web/orderController");
const auth = require("../middlewares/isUserAuth");
const optional = require("../middlewares/isUserAuthOptional");
const { response } = require("express");

router.use((req, res, next) => {
  if (req.vhost.hostname == "ricengrills.com.au") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "https://ricengrills.com.au";
    res.locals.asset_url = "https://ricengrills.com.au";
  } else if (req.vhost.hostname == "www.ricengrills.com.au") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "https://www.ricengrills.com.au";
    res.locals.asset_url = "https://www.ricengrills.com.au";
  } else if (req.vhost.hostname == "localhost") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "http://localhost:3000";
    res.locals.asset_url = "http://localhost:3000";
  } else if (req.vhost.hostname == "3.25.120.209") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "http://3.25.120.209";
    res.locals.asset_url = "http://3.25.120.209";
  }else if(req.vhost.hostname == "rngtesting.live"){
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "https://rngtesting.live";
    res.locals.asset_url = "https://rngtesting.live";
  }
  next(); 
});

router.get("/", optional, dashboardController.home);
router.post(
  "/update_device_token",
  auth,
  dashboardController.updateDeviceToken
);

router.get("/login", optional, loginController.login);
router.post("/login", optional, loginController.sendOtp);
router.post("/validatelogin", optional, loginController.validateLogin);
router.get("/signup", optional, loginController.signup);
router.post("/signup", optional, loginController.addUser);

router.get("/home", optional, dashboardController.home);
router.get(
  "/regularproducts",
  optional,
  dashboardController.getRegularProducts
);

//cart details
router.post("/addtocart", optional, cartController.addToCart);
router.post("/addproductstocart", optional, cartController.addProductsToCart);
router.get("/cart", auth, cartController.cart);
router.get("/cartregularproducts", auth, cartController.getCartRegularProducts);
router.get("/cartaccessories", auth, cartController.getCartAccessories);
router.get(
  "/getcollectionpoints",
  optional,
  cartController.getCollectionPoints
);
router.get("/addressdetails", optional, cartController.getAddressDetails);
router.get("/addressdetails_realtime", optional, cartController.getAddressDetailsRealtime);
// router.get('/menu', optional, cartController.getMenu)
router.get("/menu", optional, cartController.getnewMenu);
router.post("/checkout", auth, cartController.checkOut);
router.get("/getcoupon", auth, cartController.getcoupon);
router.get("/setaddress", auth, cartController.setaddress);
router.get("/removefromcart", auth, cartController.removeFromCart);
router.get("/order-confirm", auth, paymentController.orderConfirm);
router.get("/success", auth, paymentController.success);

//scheduled
router.get("/scheduled", optional, scheduledController.schedule);
router.get("/getshiftsbydate", optional, scheduledController.getShiftsByDate);
router.post("/addcredit", auth, scheduledController.addCredit);
router.get("/credit-confirm", auth, paymentController.creditConfirm);
router.get("/scheduledbooking", optional, scheduledController.scheduledBooking);
router.post(
  "/scheduledbooking",
  auth,
  scheduledController.scheduledBookingConfirmation
);
router.post(
  "/updateschedulebooking",
  auth,
  scheduledController.updateScheduleBooking
);

router.get("/getorderdetails", optional, scheduledController.getOrderDetails);
router.get("/editorder/:id", optional, scheduledController.editOrder);

//bulk order
router.get("/bulk-order", optional, bulkOrderController.bulkorder);
router.post("/bulkorder", auth, bulkOrderController.bulkBooking);
router.get("/bulkorders", auth, bulkOrderController.bulkorders);
router.get("/getbulkorderlist", auth, bulkOrderController.getBulkOrderList);

//orders
router.get("/getorderslist", auth, orderController.getOrdersList);
router.get("/getscheduledlist", auth, orderController.getScheduledList);
router.post("/cancelorder", auth, orderController.cancelScheduledOrder);

router.get("/user", auth, userController.orders);
router.get("/profile", auth, userController.profile);
router.post("/profile", auth, userController.update);
router.get("/logout", auth, userController.logout);
router.get("/addresses", auth, userController.addresses);
router.post("/address", auth, userController.addAddress);
router.post("/address/delete", auth, userController.deleteAddress);
router.get("/address/one", auth, userController.addressDetails);

// about us
router.get("/about-us", optional, dashboardController.aboutUs);
// faq
router.get("/faq", optional, dashboardController.faq);

// router.get('/menudirect', optional, dashboardController.menudirect)

// cookies
router.get("/cookies", optional, dashboardController.cookies);

// privacy
router.get("/privacy", optional, dashboardController.privacy);

// terms of use
router.get("/termsofuse", optional, dashboardController.termsofuse);

//be our partner
router.get("/beourpartner", optional, dashboardController.beOurPartner);
router.post("/beourpartner", optional, dashboardController.addCollectionPoint);

//be our partner
router.get("/beourdpartner", optional, dashboardController.beOurDPartner);
router.post("/beourdpartner", optional, dashboardController.addDeliveryPartner);

//company information
router.get("/company", optional, dashboardController.company);
router.post("/company", optional, dashboardController.saveCompany);

router.get("/notifications", auth, dashboardController.notifications);

router.post("/test", optional, paymentController.confirmfrom_webhook);

router.post("/test2", optional, paymentController.confirmfrom_webhook);

router.post("/paypal-order_approval", optional, paymentController.paypal_orderconfirm);
router.post("/paypal-webhook", optional, paymentController.confirmfrom_webhook_paypal);

router.get("/generateinvoice/:booking_id", optional ,paymentController.generateInvoice);
// router.get("/testinvoice",optional,(req,res)=>{
//   const {
//     sendOrderConfirm,
//   } = require("../jobs/notification");
//   sendOrderConfirm.add({
//     booking_id: "5ffd8bed774fe11bd0f15276",
//     total: 100,
//     name: "Saleesh",
//     email: "saleeshprakash@gmail.com",
//   });
//   return res.json({
//     status:true
//   })
// })

router.get("/trackdriver", optional, userController.trackDriver);
router.get("/getcompanydetails", optional, userController.getcompanydetails);
router.get("/checkscheduledtypesbyshift", optional, scheduledController.checkScheduledTypesbyShift);
router.get("/forgotpassword", optional, loginController.forgotPassword)
router.post("/sendforgotpassword", optional, loginController.sendForgotPassword)
router.get("/resetpassword", optional, loginController.resetPassword)
router.post("/resetpassword", optional, loginController.setResetPassword)
router.post("/setoffice", auth, loginController.setOffice)

router.get("*", optional, (req, res) => {
  res.render("web/404");
});

module.exports = router;
