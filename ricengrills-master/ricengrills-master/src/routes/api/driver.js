const express = require("express");
const router = express.Router();
const auth = require("../auth");
const moment = require('moment')
const Booking = require('../../models/bookings')

const driverController = require('../../controllers/api/driverController');
const generalController = require("../../controllers/api/generalController")
const { Router } = require("express");
const BookingSlot = require("../../models/booking_slots");
// const BookingSlot = mongoose.model("booking_slots")

router.post('/sign-up', auth.optional, driverController.signUp)
router.post('/sign-up/resend-otp', auth.optional, driverController.resendOtp)
router.post('/sign-up/verify-otp', auth.optional, driverController.verifyOtp)

// registration steps
router.post('/registration/step1', auth.required, driverController.basicDetails)
router.post('/registration/step2', auth.required, driverController.extraDetails)

// admin approved or rejected
router.get('/profile-status', auth.required, driverController.profileStatus)
router.get('/registration-details', auth.required, driverController.registrationDetails)

// resubmit driver registration
router.post('/registration/resubmit', auth.required, driverController.resubmitRegistration)

// login driver
router.post('/generate-otp', auth.optional, driverController.generateOtp)
router.post('/verify-otp', auth.optional, driverController.verifyLoginOtp)

// driver home page
router.get('/home', auth.required, driverController.driverHome)
router.get("/stock-updates/test", auth.required, driverController.stockUpdates)
router.get("/stock-updates", auth.required, driverController.stockUpdatesTest)

router.post('/request-stock', auth.required, driverController.requestFood)
router.post('/location', auth.required, driverController.fetchLocation)

router.get('/scheduled-orders', auth.required, driverController.scheduledOrders)

// Driver start service
router.post('/start-service', auth.required, driverController.startService)
router.post('/stop-service', auth.required, driverController.stopService)

router.post('/alert-admin', auth.required, driverController.alertAdmin)

// orders
router.get('/orders/test', auth.required, driverController.ordersTest)
router.get('/orders/old', auth.required, driverController.orders)

router.get('/orders', auth.required, driverController.OrderNew)

router.post('/order/mark-delivered', auth.required, driverController.deliverOrder)
// router.post('/order/mark-delivered-new', auth.required, driverController.deliverOrderNew)

router.get('/food-list', auth.required, driverController.foodList)

router.post('/firebase-token', auth.required, driverController.updateFireBaseToken)

router.post('/notification-test', auth.optional, driverController.sendPushTest)

// delivered orders
router.get('/orders/delivered', auth.required, driverController.deliveredOrders)
// scheduled orders
router.get('/orders/scheduled', auth.required, driverController.scheduledOrderList)

//list jobs
router.post('/jobconfirm', auth.required, driverController.confirmJob)
router.get('/joblist', auth.required, driverController.listjobs)

// trip details
router.get('/trip-details', auth.required, driverController.tripDetails)

// transfer orders
router.post('/orders/mark-transferred', auth.required, driverController.markTransferred)
router.post('/orders/mark-received', auth.required, driverController.markReceived)

// driver notifications
router.get('/notifications', auth.required, driverController.getNotifications)

router.get('/about-us', generalController.aboutUs)
router.get('/terms-and-conditions', generalController.termsConditions)
router.get('/privacy-policy', generalController.privacyPolicy)

router.post('/logout', auth.required, driverController.logoutDriver)

router.get('/logout-driver', async (req, res) => {
	const moment = require('moment')
	const Setting = require('../../models/settings')
	const DriverLog = require('../../models/driver_logs')
	let today = moment().format("YYYY-MM-DD");
	let offset = Math.abs(new Date().getTimezoneOffset());
	let cur_date = moment().utcOffset(+offset).format("YYYY-MM-DD HH:mm");
	let prev_shift = await Setting.aggregate([
		{
			$unwind: "$shift_times",
		},
		{
			$project: {
				_id: "$shift_times._id",
				name: "$shift_times.name",
				duration: "$shift_times.duration",
				time: "$shift_times.time",
			},
		},
		{
			$addFields: {
				start: { $toDate: { $concat: [today, " ", "$time"] } },
				end: { $toDate: { $concat: [today, " ", "$time"] } },
			},
		},
		{
			$addFields: {
				end: {
					$add: [
						"$end",
						{
							$multiply: ["$duration", 3600000],
						},
					],
				},
			},
		},
		{
			$match: {
				$expr: {
					$and: [
						// { $gte: ["$start", new Date(moment().format('YYYY-MM-DD hh:mm a'))] },
						{ $lte: [new Date(moment().format('YYYY-MM-DD hh:mm a')), "$end"] },
					],
				},
			},
		},
		{
			$sort: {
				end: -1,
			},
		},
		{
			$addFields: {
				curr_date: cur_date
			}
		},
		{
			$addFields: {
				curr_date: {
					$toDate: "$curr_date",
				  },
			}
		},
		{
			$addFields: {
				date_diff: {
					$divide: [
						{
							$subtract: ["$curr_date", "$end"]
						}, 3600000
					]
				}
			}
		},
		{
			$match: {
				date_diff: {
					$gte: 0.15
				}
			}
		}
	]);
	// console.log(prev_shift)
	// return res.json({
	// 	prev_shift
	// })
	if(prev_shift.length > 0 && prev_shift[0].date_diff > 0.15) {
		await DriverLog.updateMany({
			service_end_time: null,
			shift_id: prev_shift[0]._id
		}, {
			$set: {
				service_end_time: Date.now()
			}
		})
	}

	console.log("*****************************cron worked**********************************************");

	return res.json({
		status: true,
		message: 'Service time of prev shift drivers has ended'
	})
})

router.post('/templog', auth.required, generalController.tempLog)

router.get('/update-booking-order', async(req, res) => {
	let slots = await BookingSlot.aggregate([
		{
			$match: {
				date: new Date(moment().format('YYYY-MM-DD'))
			}
		},
		{
			$lookup: {
				from: 'bookings',
				let: {
					booking_id: "$booking_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$_id", "$$booking_id"]
							}
						}
					}
				],
				as: "booking"
			}
		},
		{
			$addFields: {
				booking: {
					$arrayElemAt: ["$booking", 0]
				}
			}
		},
		{
			$project: {
				_id: 1,
				booking_id: 1,
				date: 1,
				shift_id: 1,
				driver_id: 1,
				booked_date: "$booking.created_at",
				curr_date : new Date(moment().format('YYYY-MM-DD hh:mm a'))
			}
		},
		{
			$addFields: {
				date_diff: {
					$divide: [
						{
							$subtract: ["$curr_date", "$booked_date"]
						}, 3600000
					]
				}
			}
		},
		{
			$sort: {
				booked_date: 1
			}
		}
	])

	slots.forEach(async (slot) => {
		let {_id, date_diff} = slot
		if(_id && date_diff) {
			if(date_diff > 0.30) {
				await BookingSlot.updateOne({
					_id
				}, {
					$inc: {
						order: 1
					}
				})
			}
		}
	})
	return res.json({slots})
})

router.get('/logout/return-factory', async(req, res) => {
	const StockTransfer = require('../../models/stock_transfers')
	const DriverLog = require('../../models/driver_logs')
	try {
		let today_start = new Date();
		today_start.setHours(0, 0, 0, 0);
	
		let today_end = new Date();
		today_end.setHours(23, 59, 59, 999);
		let callbacked_drivers = await StockTransfer.aggregate(
			[
				{
					$match: {
						type: 'RETURNFACTORY',
						$and: [
							{
								created_at: {
									$gte: new Date(today_start)
								},
							},
							{
								created_at: {
									$lte: new Date(today_end)
								}
							}
						]
					}
				},
				{
					$addFields: {
						driver_details: {
							$arrayElemAt: ["$driver_details", 0]
						}
					}
				},
				{
					$sort: {
						_id: -1
					}
				},
			]
		)
		callbacked_drivers.forEach(async(drivers) => {
			let driver_log = await DriverLog.findOne({
				date: new Date(moment().format('YYYY-MM-DD')),
				service_end_time: null,
				// driver_id: drivers.driver_id
			}).sort({_id: -1})
			if(driver_log) {
				console.log("_____________________________________________________________________")
				date_diff = (new Date() - driver_log.callback_time) / 3600000
				console.log(date_diff)
				if(date_diff > 0.30){
					driver_log.service_end_time = new Date()
					await driver_log.save()
				}
			}
		})
		return res.json({
			status: true,
			message: "logout updated"
		})
	} catch(err) {
		console.log(err)
		return res.json({
			status: false,
			message: err.message
		})
	}
})
module.exports = router
