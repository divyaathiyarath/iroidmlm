const express = require("express");
const router = express.Router();
const loginController = require("../controllers/admin/loginController");
const dashboardController = require("../controllers/admin/dashboardController");
const vehicleController = require("../controllers/admin/vehicleController");
const driverController = require("../controllers/admin/driverController");
const userController = require("../controllers/admin/userController");
const productController = require("../controllers/admin/productController");
const profileController = require("../controllers/admin/profileController");
const adminController = require("../controllers/admin/adminController");
const collectionPointController = require("../controllers/admin/collectionPointController");
const suburbController = require("../controllers/admin/suburbController");
const sensorContoller = require("../controllers/admin/sensorController");
const boxesController = require("../controllers/admin/boxesController");
const shiftController = require("../controllers/admin/shiftController");
const stockController = require("../controllers/admin/stockController");
const settingsController = require("../controllers/admin/settingsController");
const couponController = require("../controllers/admin/couponController");
const notificationController = require("../controllers/admin/notificationController");
const bannerController = require("../controllers/admin/bannerController");
const bulkOrderController = require("../controllers/admin/bulkOrdercontroller")
const OrderController = require("../controllers/admin/orderController")
const transferController = require("../controllers/admin/transferController")
const jobNotificationController = require("../controllers/admin/jobNotificationController")
const reportController = require("../controllers/admin/reportController")
const stockLimitController = require('../controllers/admin/stockLimitController')
const companyController = require('../controllers/admin/companyController')
const isAuth = require("../middlewares/isAuth");
const stocks = require("../models/stocks");

router.use((req, res, next) => {
  if (req.vhost.hostname == "admin.ricengrills.com.au") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "https://admin.ricengrills.com.au";
    res.locals.asset_url = "https://admin.ricengrills.com.au";
    res.locals.cp_url = "https://cp.ricengrills.com.au";
  } else if (req.vhost.hostname == "localhost") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "http://localhost:3000/admin";
    res.locals.asset_url = "http://localhost:3000";
    res.locals.cp_url = "http://localhost:3000/cp";
  } else if (req.vhost.hostname == "3.25.120.209") {
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "http://3.25.120.209/admin";
    res.locals.asset_url = "http://3.25.120.209";
    res.locals.cp_url = "http://3.25.120.209/cp";
  }else if(req.vhost.hostname == "admin.rngtesting.live"){
    res.locals.SITE_NAME = "RiceNGrills";
    res.locals.app_url = "https://admin.rngtesting.live";
    res.locals.asset_url = "https://admin.rngtesting.live";
    res.locals.cp_url = "https://cp.rngtesting.live";
  }
  next();
});

router.get("/", loginController.login); //admin login
router.post("/login", loginController.validateLogin); //validate admin login
router.get("/dashboard", isAuth, dashboardController.dashboard); //admin login
router.get("/getvanlocations", isAuth, dashboardController.getvanlocations); //admin login
router.get("/getcollectionpoints", isAuth, dashboardController.getCollectionPoints); //admin login
router.get("/export/driver", isAuth, dashboardController.driverExport); //admin login
router.get("/export/orders", isAuth, dashboardController.orderExport); //admin login
//vehicles
router.get("/vehicles", isAuth, vehicleController.list);
router.get("/vehicles/deliveryVehicle", isAuth, vehicleController.listDeliveryVehicles)
router.get("/vehicles/new", isAuth, vehicleController.new);
router.post("/vehicles/new", isAuth, vehicleController.save);
router.get("/vehicles/edit/:id", isAuth, vehicleController.changeVehicle);
router.post("/vehicles/edit/:id", isAuth, vehicleController.editVehicle);
router.post("/vehicles/delete", isAuth, vehicleController.delete);
//end vehicles
//drivers
router.get("/drivers", isAuth, driverController.list);
router.get("/drivers/new", isAuth, driverController.new);
router.post("/drivers/new", isAuth, driverController.save);
router.post("/drivers/changevehicle", isAuth, driverController.changeVehicle);
router.post("/drivers/delete", isAuth, driverController.delete);
router.get("/drivers/one", isAuth, driverController.one);
router.get("/drivers/pending", isAuth, driverController.pendingDrivers);
router.post("/drivers/approve", isAuth, driverController.approveDriver);
router.post("/drivers/reject-driver", isAuth, driverController.rejectDriver);
router.get("/drivers/rejected", isAuth, driverController.rejectedDrivers);
router.get("/drivers/excessstocks", isAuth, driverController.stockRequests)
router.get("/drivers/aboutus", isAuth, driverController.aboutus)
router.post("/drivers/aboutus", isAuth, driverController.saveaboutus)
router.get("/drivers/privacypolicy", isAuth, driverController.privacypolicy)
router.post("/drivers/privacypolicy", isAuth, driverController.saveprivacypolicy)
router.get("/drivers/termsnconditions", isAuth, driverController.termsnconditions)
router.post("/drivers/termsnconditions", isAuth, driverController.savetnc)
//end drivers

//products
router.get("/products", isAuth, productController.list);
router.get("/products/new", isAuth, productController.new);
router.post("/products/new", isAuth, productController.save);
router.post("/products/delete", isAuth, productController.delete);
router.get("/products/edit/:product_id", isAuth, productController.edit);
router.post("/products/edit", isAuth, productController.update);
//end products

//Admin Profile
router.get("/profile", isAuth, profileController.profile);
router.post("/profile/update", isAuth, profileController.updateProfile);
router.post(
  "/profile/update-password",
  isAuth,
  profileController.updatePassword
);
// End admin pROFILE

// forgot password
router.post("/forgot-password", profileController.forgotPassword);
router.get("/password-reset/:token", profileController.resetPassword);
router.post("/update-password", profileController.updateNewPassword);
// End forgot password

router.get("/update_device_token", isAuth, profileController.updateDeviceToken);

router.get("/collectionpoints", isAuth, collectionPointController.list);
router.get("/collectionpoints/pending", isAuth, collectionPointController.pendingList);
router.post("/collectionpoints/reject", isAuth, collectionPointController.rejectCollectionPoint);
router.post("/collectionpoints/approve", isAuth, collectionPointController.approveCollectionPoint);

router.post("/collectionpoints/new", isAuth, collectionPointController.save);
router.get("/collectionpoints/new", isAuth, collectionPointController.new);
router.get(
  "/collectionpoints/edit/:collectionpoint",
  isAuth,
  collectionPointController.edit
);
router.get(
  "/collectionpoints/excessstock/:collectionpoint_id",
  isAuth,
  collectionPointController.excessstock
);
router.get(
  "/collectionpoints/excessstock/new/:collectionpoint_id",
  isAuth,
  collectionPointController.newstock
);
router.post(
  "/collectionpoints/excessstock/new",
  isAuth,
  collectionPointController.savestock
);
router.post(
  "/collectionpoints/update",
  isAuth,
  collectionPointController.update
);
router.post(
  "/collectionpoints/delete",
  isAuth,
  collectionPointController.delete
);
router.get(
  "/collectionpoints/download",
  isAuth,
  collectionPointController.downloadCollectionPointExcel
);
router.get(
  "/collectionpoints/stockRequests",
  isAuth,
  collectionPointController.stockRequests
);
router.get(
  "/collectionpoints/editStock/:_id",
  isAuth,
  collectionPointController.editStocks
);
router.post(
  "/collectionpoints/editStock",
  isAuth,
  collectionPointController.stockupdates
);

router.post(
  "/collectionpoints/stockRequests/delete",
  isAuth,
  collectionPointController.deleteStock
);
// End collection points

// Admins
router.get("/admin-list", isAuth, adminController.adminLists);
router.get("/admin/new", isAuth, adminController.newAdmin);
router.post("/admin/new", isAuth, adminController.save);
router.post("/admin/delete", isAuth, adminController.delete);
router.get("/admin/edit/:id", isAuth, adminController.editAdmin);
router.post("/admin/update", isAuth, adminController.updateAdmin);
router.post("/admin/reset-password", isAuth, adminController.resetPassword);

//Users

router.get("/suburbs/new", isAuth, suburbController.new);
router.post("/suburbs/new", isAuth, suburbController.save);
router.get("/suburbs", isAuth, suburbController.list);
router.post("/suburbs/delete", isAuth, suburbController.delete);
router.get("/suburbs/edit/:suburb_id", isAuth, suburbController.edit);
router.post("/suburbs/update", isAuth, suburbController.update);
router.get("/suburbs/one", isAuth, suburbController.one);
router.post("/suburb/setrealtimedelivery", isAuth, suburbController.setRealTimeDelivery);
router.post('/suburb/setrealtimeonlinedelivery', isAuth, suburbController.setrealtimeonlinedelivery)

//boxes

router.get("/boxes/new", isAuth, boxesController.new);
router.post("/boxes/new", isAuth, boxesController.save);
router.get("/boxes", isAuth, boxesController.list);
router.post("/boxes/delete", isAuth, boxesController.delete);
router.get("/boxes/edit/:box_id", isAuth, boxesController.edit);
router.post("/boxes/update", isAuth, boxesController.update);
router.get("/boxes/search", isAuth, boxesController.search);

//users

router.get("/user/list", isAuth, userController.listUsers);
router.post("/user/list/deactivate/", isAuth, userController.deactivate);

//shifts

router.get("/shifts/new", isAuth, shiftController.new);
router.post("/shifts/new", isAuth, shiftController.save);
router.get("/shifts", isAuth, shiftController.list);
router.post("/shifts/delete", isAuth, shiftController.delete);
router.get("/shifts/edit/:shift_id", isAuth, shiftController.edit);
router.post("/shifts/update", isAuth, shiftController.update);

//sensors
router.get("/sensors", isAuth, sensorContoller.list);
router.get("/sensors/new", isAuth, sensorContoller.new);
router.post("/sensors/new", isAuth, sensorContoller.save);
router.post("/sensors/delete", isAuth, sensorContoller.delete);
router.get("/sensors/logs",isAuth,sensorContoller.temperature_logs)

//stocks

router.get("/stocks/new", isAuth, stockController.new);
router.post("/stocks/new", isAuth, stockController.save);
router.get("/stocks", isAuth, stockController.list);
router.get("/stocks/check", isAuth, stockController.check);
router.post("/stock/delete", isAuth, stockController.delete);
router.get("/stocks/edit/:stock_id", isAuth, stockController.edit);
router.post("/stocks/update", isAuth, stockController.update);
router.get("/stocks/reports", isAuth, stockController.reports);
router.get("/stocks/scheduled/:suburb_id/:shift_id/:driver_id", isAuth, stockController.getScheduledOrdersBySuburbId);
router.post("/scheduledorder/approve", isAuth, stockController.scheduledApproval)


//settings
router.get("/settings", isAuth, settingsController.list);
router.get("/settings/new", isAuth, settingsController.new);
router.post("/settings/new", isAuth, settingsController.save);
router.get("/settings/edit", isAuth, settingsController.edit);
router.post("/settings/edit", isAuth, settingsController.update);

//Coupons
router.get("/coupons", isAuth, couponController.list);
router.get("/coupons/new", isAuth, couponController.new);
router.post("/coupons/new", isAuth, couponController.save);
router.post("/coupons/delete", isAuth, couponController.delete);
router.get("/coupons/edit/:id", isAuth, couponController.editCoupon);
router.post("/coupons/edit", isAuth, couponController.update);
router.post("/coupons/deactivate", isAuth, couponController.activeStatus);
// notifications
router.get("/notifications/new", isAuth, notificationController.new);
router.post("/notifications/new", isAuth, notificationController.save);
router.get("/notifications", isAuth, notificationController.list);
router.post("/notifications/delete", isAuth, notificationController.delete);

// notifications
router.get("/banners/new", isAuth, bannerController.new);
router.post("/banners/new", isAuth, bannerController.save);
router.get("/banners", isAuth, bannerController.list);
router.post("/banners/delete", isAuth, bannerController.delete);
// router.get('/banners/new-user-banner',isAuth,bannerController.newUserbanner)
// router.post('/banners/new-user-banner',isAuth,bannerController.saveUserbanner)

//orders
router.get("/orders/list", isAuth, OrderController.list)
router.post("/orders/list/delivered",isAuth,OrderController.markdelivered)
router.post("/orders/list/undelivered",isAuth,OrderController.markUndelivered)

//bulk orders
router.get("/bulkorders/list", isAuth, bulkOrderController.list)
router.get("/bulkorders/getorder", isAuth, bulkOrderController.getOrder)
router.post("/bulkorders/rejectorder", isAuth, bulkOrderController.rejectOrder)
router.post("/bulkorders/approveorder", isAuth, bulkOrderController.approvedOrder)


//food transfer requests
router.get("/transfers/collectionpoints", isAuth, transferController.collectionpoint)
router.post('/transfers/collectionpoints', isAuth, transferController.collectionpoints)
router.get("/transfers/refillingdrivers", isAuth, transferController.refillingdriver)
router.post("/transfers/refillingdrivers", isAuth, transferController.refillDriver)
router.get("/transfers/transferdriver", isAuth, transferController.getTransferDriver)
router.post("/transfers/transferdriver", isAuth, transferController.transferDriver)
router.get("/transfers/callbackdriver", isAuth, transferController.getCallbackdriver)
router.post("/transfers/callbackdriver", isAuth, transferController.callbackdrivers)
// router.post("/transfers/callbackdriver", isAuth, transferController.callbackdrivers)
router.get('/transfers/return-factory', isAuth, transferController.returnToFactory)
router.post('/transfers/return-factory', isAuth, transferController.returnFactory)
router.get("/get_drivers_suburb", isAuth, transferController.getDriversSuburb)


//job notificaitons
router.get("/jobnotifications/new", isAuth, jobNotificationController.new)
router.post("/jobnotifications/new", isAuth, jobNotificationController.save)
router.get("/jobnotifications", isAuth, jobNotificationController.list)
router.get("/jobnotifications/export", isAuth, jobNotificationController.jobNotificationExcel)
router.get("/jobnotifications/accepted", isAuth, jobNotificationController.accepted)
router.post("/jobnotifications/approve", isAuth, jobNotificationController.approveJob)
router.post("/jobnotifications/sendjobapprovalnotification", isAuth, jobNotificationController.sendJobApprovalNotification)


//reports
router.get("/reports/driversales", isAuth, reportController.driverSales)
router.get("/reports/cpsales", isAuth, reportController.cpSales)
router.get("/reports/driversales/export", isAuth, reportController.driverSalesExport)
router.get("/reports/cpsales/export", isAuth, reportController.cpSalesExport)
router.get("/reports/individualsales/:driver_id/:from_date/:to_date", isAuth, reportController.individualsales)
router.get("/reports/orders", isAuth, reportController.orderSales)
router.get("/reports/ordersexport/export",isAuth,reportController.ordersExport)
router.get("/reports/paymentreports", isAuth, reportController.paymentreports)
router.get("/report/paymentreports/export",isAuth,reportController.paymentsexport)
router.get("/reports/userexports",isAuth,reportController.userExports)
router.get("/reports/scheduledorders",isAuth,reportController.scheduledOrders)
router.get("/reports/scheduledordersexport/export",isAuth,reportController.scheduledOrderexport)
router.get("/reports/collectionpointorders",isAuth,reportController.collectionpointorders)
router.get("/reports/collectionpointexports/export",isAuth,reportController.collectionpointexports)
router.get("/reports/stockreportexport/export",isAuth,reportController.stockreportexport)
router.get("/reports/collectionpoint-commission", isAuth, reportController.collectionPointCommission)

// scheduled stock limit 
router.get('/schedule-stock-limit', isAuth, stockLimitController.list)
router.post('/schedule-stock-limit', isAuth, stockLimitController.save)
router.post('/schedule-stock-limit/delete', isAuth, stockLimitController.delete)
router.get('/schedule-stock-limit/:id', isAuth, stockLimitController.editStockLimit)
router.post('/schedule-stock-limit/update', isAuth, stockLimitController.updateStockLimit)

// //scheduled orders
// router.get('/scheduledorders',isAuth, scheduledController.list)

router.get("/logout", (req, res) => {
  req.session.destroy();
  return res.redirect(res.locals.app_url);
});

router.get('/generatestocks', async (req, res) => {
  const moment = require('moment')
  const today = moment().format('YYYY-MM-DD')
  const Stock = require('../models/stocks')

  // await Stock.deleteMany({date:new Date(today)})
  let stock_exists = await Stock.find({date:new Date(today)}).countDocuments()
  
  if(stock_exists > 0){
    return res.json({
      status: false,
      message : "Stock already exists"
    })
  }

  let stocks = await Stock.aggregate([
    {
      $match: {
        delete_status: false,
        $expr:{
          $and:[
            {$eq:['$date',new Date(moment().add(-1, 'days').format('YYYY-MM-DD'))]}
          ]
        }
      }
    }
  ])

  insert_stocks = []
  stocks.forEach(stock=>{
    insert_stocks.push({
      boxes: stock.boxes,
      delete_status:false,
      suburb_id: stock.suburb_id,
      shift_id: stock.shift_id,
      type: stock.type,
      driver_id: stock.driver_id,
      vehicle_id : stock.vehicle_id,
      date: new Date(moment().format('YYYY-MM-DD')),
      products: stock.initial_stock,
      initial_stock: stock.initial_stock,
    })
  })

  await Stock.insertMany(insert_stocks)
  return res.json({
    status: true,
    message: "Stock added successfully",
    insert_stocks
  })

})

//transactions
router.get("/transactions",isAuth, userController.transactions);
router.post("/trasactions/process",isAuth, userController.processTransaction);
router.post("/trasactions/processpaypal",isAuth, userController.processTransactionPaypal);
router.post("/updatecredit",isAuth, userController.updateUserCredit);


router.post("/gettemplogs",isAuth, driverController.tempLogs);

router.get("/companies", isAuth, companyController.list);
router.get("/companies/new", isAuth, companyController.new);
router.get("/companies/edit/:company_id", isAuth, companyController.edit);
router.post("/companies/new", isAuth, companyController.save);
router.post("/companies/delete", isAuth, companyController.delete);
router.post("/companies/edit", isAuth, companyController.update);
router.get("/companies/list/:company_id", isAuth, companyController.employeelist);
router.get("/companies/downloadorderreport", isAuth, companyController.downloadOrderReport);
router.get("/companies/printorders",isAuth, companyController.printPdf)
//temp companies
router.get("/companies/pendinglist", isAuth, companyController.pendinglist);
router.post("/companies/delete_temp", isAuth, companyController.deleteTemp);
router.post("/companies/approve", isAuth, companyController.approveCompany);


router.get("*", (req, res) => {
  res.render("admin/notfound");
});
module.exports = router;
