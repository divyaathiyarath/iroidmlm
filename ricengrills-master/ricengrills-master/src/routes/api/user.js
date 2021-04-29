const express = require("express");
const router = express.Router();
const auth = require("../auth");
const isAuth = require("../../middlewares/isAuth");

const userController = require("../../controllers/api/userController");
const productController = require("../../controllers/api/productController")
const generalController = require("../../controllers/api/generalController")

router.get("/", auth.optional, (req, res) => {
  res.json({
    status: true,
    message: "Yahooooo! Api home page",
  });
});

// user signup
router.post("/sign-up", auth.optional, userController.signUp);
router.post("/sign-up/resend-otp", auth.optional, userController.resendSignUpOtp);
router.post("/sign-up/verify-otp", auth.optional, userController.verifySignUpOtp);

// user sign in
router.post("/sign-in", auth.optional, userController.signIn);
router.post("/sign-in/verify-otp", auth.optional, userController.verifySignInOtp);

// User Profile
router.get("/profile", auth.required, userController.viewProfile);
router.post("/profile/image", auth.required, userController.updateProfilePic);
router.post("/profile/remove-image", auth.required, userController.deleteProfilePic);

// dELIVERY Location
router.post('/delivery-location/verify', auth.required, userController.verifyUserLocation);
router.post("/delivery-location", auth.required, userController.addLocation);
router.get("/delivery-locations", auth.required, userController.getLocations);
router.post("/delivery-location/delete", auth.required, userController.deleteLocation);
router.post('/delivery-location/mark-active', auth.required, userController.markAddressActive)

// router.post("/login", auth.optional, userController.login);
router.get("/check", auth.required, (req, res) => {
  res.json({
    status: true,
    message: "You are authenticated if you are seeing this message",
  });
});


// schedule booking
router.post('/add-food-credits', auth.required, userController.addCredits)
router.post('/add-food-credits/confirm', auth.required, userController.confirmAddCredits)

router.get('/credits-total', auth.required, userController.getCreditAmount)

router.post('/schedule-booking', auth.required, userController.scheduleBooking)
router.post('/schedule-booking/save-cart', auth.required, userController.saveScheduleCart)
router.post('/schedule-booking/save-cart-limit', auth.required, userController.saveScheduleCartLimitCheck)
router.get('/schedule-booking/cart', auth.required, userController.scheduledBookingCart)
router.post('/schedule-booking/clear-cart', auth.required, userController.clearScheduledCart)
router.post('/schedule-booking/confirm', auth.required, userController.confirmScheduledBooking)
router.post('/schedule-booking/cancel', auth.required, userController.cancelScheduledOrder)
router.post('/schedule-booking/update', auth.required, userController.updateScheduleBooking)

router.get('/schedule-booking/list', auth.required, userController.scheduleBookingList)
// router.post('/schedule-booking/confirm', auth.required, userController.confirmScheduledBookingTest)

router.get('/collection_points', auth.required, userController.getCollectionPoints)

// Product listing for ssheduled products
router.get('/products-list', auth.required, userController.getProductList)

// products listing for realtime booking
router.get('/products', auth.optional, productController.products)

// realtime booking
router.post("/realtime-booking/save-cart", auth.required, productController.realtimeSaveToCart)
router.post("/realtime-booking/confirm", auth.required, productController.confirmRealtimeBooking)

// Coupon code
router.post("/coupon/verify", auth.required, productController.verifyCoupon)


router.get('/general-settings', auth.optional, generalController.getSettings)
router.get('/suburbs', auth.optional, generalController.getSuburbs)

router.get('/my-orders', auth.required, userController.listMyOrders)
router.get('/my-orders/track', auth.required, userController.trackMyOrder)

router.get('/bulk-booking/products', auth.optional, userController.bulkProducts)
router.post('/bulk-booking', auth.required, userController.bulkBooking)

router.post('/firebase-token', auth.required, userController.updateFirebaseToken)

router.get('/accessories', auth.optional, productController.getAccessories)

router.get('/notifications', auth.required, userController.getNotifications)

// user home 
router.get('/home', auth.optional, userController.home)

// scheduled orders list
router.get('/scheduled-orders', auth.required, userController.scheduledOrdersList)

// Bulk orders list 
router.get('/bulk-orders', auth.required, userController.bulkOrders)

// Rate products
router.post('/rate_booking', auth.required, userController.rateBooking)

//create payment
router.post('/createpayment', auth.optional, userController.createPayment)

router.get('/about-us', generalController.aboutUs)
router.get('/terms-and-conditions', generalController.termsConditions)
router.get('/privacy-policy', generalController.privacyPolicy)

router.post('/allocate', auth.required, userController.allocate)

router.get('/send-mail', async(req, res) => {
  const {sendemail} = require('../../utils/testemail')
  await sendemail()
  console.log("done")
})

router.post('/collection_points/has-stock', auth.required, userController.getHasStockCollectionPoints)

router.get('/has-realtime-delivery', auth.optional, userController.hasRealTimeDelivery) // for scheduled oeders
router.get('/has-realtime-online-delivery', auth.optional, userController.hasRealTimeOnlineDelivery) // for realtime orders

module.exports = router;
