const mongoose = require("mongoose")
let ObjectId = mongoose.Types.ObjectId
const Driver = mongoose.model("drivers")
const DriverLog = mongoose.model("driver_logs")
const StockTransfer = mongoose.model("stock_transfers")
const Stock = mongoose.model('stocks')
const Product = mongoose.model("products")
const Suburb = mongoose.model("suburbs")
const CollectionPoint = mongoose.model("collectionpoints")
const DriverNotification = mongoose.model('driver_notifications')
const Booking = mongoose.model('bookings')
const { getComingShift } = require("../admin/stockController")
const _ = require("underscore")

const moment = require("moment")

let { ValidateDriverTransferRequest, ValidateDriverRefill, ValidateCollectionPointRefill } = require('../../validators/driverValidator')

const SendNotificaiton = require('../../jobs/driver_notification')
const driver_notifications = require("../../models/driver_notifications")

exports.getCallbackdriver = async (req, res) => {
	let drivers = await DriverLog.aggregate([
		{
			$match: {
				date: new Date(moment().format("YYYY-MM-DD")),
				service_end_time: {
					$eq: null
				}
			}
		},
		{
			$group: {
				_id: null,
				driver_ids: {
					$push: "$driver_id"
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: {
					driver_ids: "$driver_ids"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$driver_ids"]
							}
						}
					}
				],
				as: "drivers"
			}
		},
		{
			$project: {
				drivers: 1
			}
		}
	])
	let today_start = new Date();
	today_start.setHours(0, 0, 0, 0);

	let today_end = new Date();
	today_end.setHours(23, 59, 59, 999);
	let callbacked_drivers = await StockTransfer.aggregate(
		[
			{
				$match: {
					type: 'CALLBACK',
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
				$lookup: {
					from: "drivers",
					let: {
						driver_id: "$driver_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$_id", "$$driver_id"]
								}
							}
						},
						{
							$project: {
								name: 1,
								email: 1,
								mobile: 1,
								image: 1
							}
						}
					],
					as: "driver_details"
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
			}
		]
	)
	let data = {}
	if (drivers.length > 0) {
		data.drivers = drivers[0].drivers
	} else {
		data.drivers = []
	}
	data.drivers_lists = callbacked_drivers
	res.render("admin/transfers/callbackdriver", data)
}

exports.getDriversSuburb = async (req, res) => {
	let { suburb_id } = req.query
	try {
		let drivers = await Stock.aggregate([
			{
				$match: {
					delete_status: false,
					suburb_id: ObjectId(suburb_id),
					driver_id: {
						$ne: null
					},
					type: 'DELIVERY',
					date: new Date(moment().format('YYYY-MM-DD'))
				}
			},
			{
				$lookup: {
					from: 'drivers',
					let: {
						driver_id: "$driver_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$_id", "$$driver_id"] }
									]
								}
							}
						},
						{
							$project: {
								_id: 1,
								name: 1,
								email: 1,
								mobile: 1
							}
						}
					],
					as: "driver"
				}
			},
			{
				$addFields: {
					driver: {
						$arrayElemAt: ["$driver", 0]
					}
				}
			},
			{
				$project: {
					_id: "$driver._id",
					name: "$driver.name",
					email: "$driver.email",
					mobile: "$driver.mobile",
				}
			}
		])
		return res.json({
			status: true,
			drivers
		})
	} catch (err) {
		console.log(err)
		return res.json({
			status: true,
			drivers: []
		})
	}

}

exports.callbackdrivers = async (req, res) => {
	try {
		let { driver_ids } = req.body
		if (typeof driver_ids === "undefined") {
			return res.json({
				status: false,
				message: "Driver ids is required"
			})
		}
		if (driver_ids.length <= 0) {
			return res.json({
				status: false,
				message: "Driver ids is required"
			})
		}
		let drivers = []
		let insert_data = []
		for (var i = 0; i < driver_ids.length; i++) {
			drivers.push(ObjectId(driver_ids[i]))
			stock_transfer = {
				driver_id: ObjectId(driver_ids[i]),
				type: 'CALLBACK',
			},
				insert_data.push(stock_transfer)
		}
		await DriverLog.updateMany({
			driver_id: {
				$in: drivers
			},
			date: new Date(moment().format('YYYY-MM-DD'))
		}, {
			$set: {
				service_end_time: new Date()
			}
		})
		await StockTransfer.insertMany(insert_data)
		let stopped_drivers = await Driver.find({
			_id: {
				$in: drivers
			}
		}, {
			device_token: 1
		})
		for (var i = 0; i < stopped_drivers.length; i++) {
			title = "Service has been stopped"
			message = "Your service has been stopped by admin. For more details contact admin"
			token = stopped_drivers[i].device_token
			await SendNotificaiton(title, message, "high", token)
			let driver_notification = new DriverNotification({
				title: 'Service has been stopped',
				description: 'Your service has been stopped by admin. For more details contact admin',
				type: 'RETURN_TO_FACTORY',
				driver_id: stopped_drivers[i]._id
			})
			await driver_notification.save()
		}
		return res.json({
			status: true,
			message: "Drivers has been callbacked"
		})
	} catch (err) {
		console.log(err)
		return res.json({
			status: false,
			message: "Sorry something went wrong"
		})
	}
}

exports.getTransferDriver = async (req, res) => {
	let drivers = await DriverLog.aggregate([
		{
			$match: {
				date: new Date(moment().format("YYYY-MM-DD")),
				service_end_time: {
					$eq: null
				}
			}
		},
		{
			$group: {
				_id: null,
				driver_ids: {
					$push: "$driver_id"
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: {
					driver_ids: "$driver_ids"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$driver_ids"]
							}
						}
					}
				],
				as: "drivers"
			}
		},
		{
			$project: {
				drivers: 1
			}
		}
	])
	let today_start = new Date();
	today_start.setHours(0, 0, 0, 0);

	let today_end = new Date();
	today_end.setHours(23, 59, 59, 999);
	let lists = await StockTransfer.aggregate(
		[
			{
				$match: {
					type: 'STOCKOUT',
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
				$lookup: {
					from: 'drivers',
					let: {
						driver_id: "$driver_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$_id", "$$driver_id"]
								}
							}
						},
						{
							$project: {
								name: 1,
								email: 1,
								mobile: 1,
								image: 1
							}
						}
					],
					as: "from_driver"
				}
			},
			{
				$addFields: {
					from_driver: {
						$arrayElemAt: ["$from_driver", 0]
					}
				}
			},
			{
				$lookup: {
					from: 'drivers',
					let: {
						to_driver_id: "$to_driver_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$_id", "$$to_driver_id"]
								}
							}
						},
						{
							$project: {
								name: 1,
								email: 1,
								mobile: 1,
								image: 1
							}
						}
					],
					as: "to_driver"
				}
			},
			{
				$addFields: {
					to_driver: {
						$arrayElemAt: ["$to_driver", 0]
					}
				}
			},
			{
				$sort: {
					_id: -1
				}
			}
		]
	)
	let data = {}
	if (drivers.length > 0) {
		data.drivers = drivers[0].drivers
	} else {
		data.drivers = []
	}
	data.lists = lists
	res.render("admin/transfers/transferdriver", data)
}

exports.transferDriver = async (req, res) => {
	try {
		let { errors, isValid } = ValidateDriverTransferRequest(req.body)
		if (!isValid) {
			return res.json({
				status: false,
				message: errors[0]
			})
		}
		let { shifts, coming_shift } = await getComingShift();
		let { from_driver, to_driver } = req.body
		if (from_driver == to_driver) {
			return res.json({
				status: false,
				message: "From and to driver are same"
			})
		}

		let driver_bookings = await Booking.countDocuments({
			redeemed: false,
			delete_status: false,
			// delivery_type: "ONLINE",
			driver_id: from_driver,
			scheduled_date: new Date(moment().format('YYYY-MM-DD'))
		})
		if(driver_bookings) {
			return res.json({
				status: false,
				message: "The Driver to transfer food already have orders assigned."
			})
		}

		let checkStockAssign = await StockTransfer.countDocuments({
			driver_id: from_driver,
			// to_driver_id: to_driver,
			date: new Date(moment().format('YYYY-MM-DD')),
			type: "STOCKOUT",
			shift_id: coming_shift
		})
		if(checkStockAssign) {
			return res.json({
				status: false,
				message: "Transfer request already assigned"
			})
		}
///////////////////////////////////////////////////////////////////////////////////////////



let stock_updates = await Stock.aggregate([
	{
		$match: {
			shift_id: ObjectId(coming_shift),
			driver_id: ObjectId(from_driver),
			date: new Date(moment().format('YYYY-MM-DD')),
			type: 'DELIVERY',
			delete_status: false,
		}
	},
	{
		$group: {
			_id: "$driver_id",
			products: {
				$push: "$products"
			}
		}
	},
	{
		$unwind: "$products"
	},
	{
		$unwind: "$products"
	},
	{
		$lookup: {
			from: 'products',
			let: {
				product_id: '$products.product_id'
			},
			pipeline: [
				{
					$match: {
						$expr: {
							$eq: ["$_id", "$$product_id"]
						}
					}
				}
			],
			as: 'product_details'
		}
	},
	{
		$addFields: {
			product_details: {
				$arrayElemAt: ["$product_details", 0]
			}
		}
	},
	{
		$group: {
			_id: {
				_id: "$_id",
				product_id: "$products.product_id"
			},
			stock_total: {
				$sum: "$products.stock"
			},
			products: {
				$push: "$product_details"
			}
		}
	},
	{
		$addFields: {
			products: {
				$arrayElemAt: ["$products", 0]
			}
		}
	},
	{
		$project: {
			driver_id: "$_id._id",
			_id: "$products._id",
			cover_pic: "$products.cover_pic",
			type: "$products.type",
			name: "$products.name",
			price: "$products.price",
			description: "$products.description",
			image: "$products.image",
			is_veg: "$products.is_veg",
			allergen_contents: "$products.allergen_contents",
			ingredients: "$products.ingredients",
			container_size: "$products.container_size",
			stock: "$stock_total",
		}
	},
	{
		$group: {
			_id: "$driver_id",
			products: {
				$push: {
					product_id: "$_id",
					stock: "$stock",
				}
			},
		}
	},
	{
		$project: {
			_id: 0
		}
	}
])

// return res.json({
// 	stock_updates: stock_updates[0].products
// })

///////////////////////////////////////////////////////////////////////////////////////////
		let stock_transfer = new StockTransfer({
			driver_id: from_driver,
			type: 'STOCKOUT',
			to_driver_id: to_driver,
			shift_id: coming_shift,
			products: stock_updates[0].products,
			created_at : new Date(),
			date: new Date(moment().format('YYYY-MM-DD'))
		})
// ////////////////////////////////////////////////////////////////////////

		await Stock.updateMany({
			delete_status: false,
			type: 'DELIVERY',
			date: new Date(moment().format('YYYY-MM-DD')),
			driver_id: from_driver,
			shif_id: coming_shift
		}, {
			$set: {
				transfer_status: true
			}
		})

// ////////////////////////////////////////////////////////////////////////


		await stock_transfer.save()
		let to_driver_details = await Driver.findOne({
			_id: to_driver
		})
		let driver_notification = new DriverNotification({
			title: 'Transfer your stock',
			description: `Transfer your complete stock to driver ${to_driver_details.name}`,
			type: 'NOTIFICATION',
			driver_id: from_driver,
			stock_transfer_id: stock_transfer._id
		})
		await driver_notification.save()
		let from_driver_details = await Driver.findOne({
			_id: from_driver
		}, {
			device_token: 1
		})
		title = "Transfer your stock"
		message =`Transfer your complete stock to driver ${to_driver_details.name}`
		token = from_driver_details.device_token
		await SendNotificaiton(title, message, "high", token)
		title = "More stocks coming"
		message = "Another driver is transfering stocks to you"
		token = to_driver_details.device_token
		await SendNotificaiton(title, message, "high", token)

		return res.json({
			status: true,
			message: "Transfer request sended"
		})
	} catch (err) {
		console.log(err)
		return res.json({
			status: false,
			message: "Sorry something went wrong"
		})
	}
}

exports.refillingdriver = async (req, res) => {
	let suburbs = await Suburb.aggregate([
		{
			$match: {
				delete_status: false,
				active: true
			}
		},
		{
			$project: {
				_id: 1,
				name: 1
			}
		}
	])

	let products = await Product.aggregate([
		{
			$match: {
				delete_status: false,
				$expr: {
					$or: [
						{ $eq: ["$is_regular", true] },
						{ $eq: ["$type", "ACCESSORIES"] },
					],
				},
			},
		},
		{
			$sort: {
				type: -1,
			},
		},
	]);
	let today_start = new Date();
	today_start.setHours(0, 0, 0, 0);

	let today_end = new Date();
	today_end.setHours(23, 59, 59, 999);
	let lists = await StockTransfer.aggregate([
		{
			$match: {
				type: 'REFILLING',
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
			},
		},
		{
			$lookup: {
				from: "products",
				let: {
					products: "$products"
				},
				pipeline: [
					{
						$addFields: {
							products: "$$products"
						}
					},
					{
						$unwind: "$products"
					},
					{
						$match: {
							$expr: {
								$eq: ["$_id", "$products.product_id"]
							}
						}
					},
					{
						$project: {
							name: 1,
							type: 1,
							stock: "$products.stock"
						}
					}
				],
				as: "products"
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: {
					driver_id: "$driver_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$_id", "$$driver_id"]
							}
						}
					},
					{
						$project: {
							name: 1,
							email: 1,
							mobile: 1
						}
					}
				],
				as: "driver"
			}
		},
		{
			$addFields: {
				driver: {
					$arrayElemAt: ["$driver", 0]
				}
			}
		}
	])
	// return res.json({
	//   lists
	// })
	let data = {}
	data.drivers = []
	data.products = products
	data.lists = lists,
		data.suburbs = suburbs
	res.render("admin/transfers/refillingdriver", data)
}

exports.refillDriver = async (req, res) => {
	try {
		let { errors, isValid } = ValidateDriverRefill(req.body)
		if (!isValid) {
			return res.json({
				status: false,
				message: errors[0]
			})
		}
		let { driver, products, suburb_id } = req.body
		let insert_products = []
		if (products) {
			_.map(products, (stock, product_id) => {
				if (stock) {
					insert_products.push({
						product_id,
						stock
					})
				}
			})
		} else {
			return res.json({
				status: false,
				message: 'Count is required'
			})
		}
		if (insert_products.length == 0) {
			return res.json({
				status: false,
				message: "Count is required"
			})
		}
		let stock_transfer = new StockTransfer({
			suburb_id: ObjectId(suburb_id),
			driver_id: driver,
			type: 'REFILLING',
			products: insert_products,
			created_at : new Date()
		})
		await stock_transfer.save()
		return res.json({
			status: true,
			message: 'Refill details have been saved'
		})
	} catch (err) {
		console.log(err)
		return res.json({
			status: false,
			message: 'Sorry something went wrong'
		})
	}
}

exports.collectionpoint = async (req, res) => {
	let collection_points = await CollectionPoint.find({
		approved: true,
		delete_status: false
	})
	let products = await Product.aggregate([
		{
			$match: {
				delete_status: false,
				$expr: {
					$or: [
						{ $eq: ["$is_regular", true] },
						{ $eq: ["$type", "ACCESSORIES"] },
					],
				},
			},
		},
		{
			$sort: {
				type: -1,
			},
		},
	]);
	let today_start = new Date();
	today_start.setHours(0, 0, 0, 0);

	let today_end = new Date();
	today_end.setHours(23, 59, 59, 999);
	let lists = await StockTransfer.aggregate([
		{
			$match: {
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
				],
				type: 'COLLECTIONPOINT'
			}
		},
		{
			$lookup: {
				from: "products",
				let: {
					products: "$products"
				},
				pipeline: [
					{
						$addFields: {
							products: "$$products"
						}
					},
					{
						$unwind: "$products"
					},
					{
						$match: {
							$expr: {
								$eq: ["$_id", "$products.product_id"]
							}
						}
					},
					{
						$project: {
							name: 1,
							type: 1,
							stock: "$products.stock"
						}
					}
				],
				as: "products"
			}
		},
		{
			$lookup: {
				from: 'collectionpoints',
				let: {
					cp_id: "$collectionpoint_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$eq: ["$_id", "$$cp_id"]
							}
						}
					}
				],
				as: "collection_point"
			}
		},
		{
			$addFields: {
				collection_point: {
					$arrayElemAt: ["$collection_point", 0]
				}
			}
		},
		{
			$sort:{
				created_at : -1
			}
		}
	])

	// return res.json(lists);
	let data = {
		collection_points,
		products,
		lists,
		suburbs
	}
	res.render("admin/transfers/collectionpoint", data)
}

exports.collectionpoints = async (req, res) => {
	try {
		let { errors, isValid } = ValidateCollectionPointRefill(req.body)
		if (!isValid) {
			return res.json({
				status: false,
				message: errors[0]
			})
		}
		let { collection_point, products } = req.body
		let insert_products = []
		if (products) {
			_.map(products, (stock, product_id) => {
				if (stock) {
					insert_products.push({
						product_id,
						stock
					})
				}
			})
		} else {
			return res.json({
				status: false,
				message: 'Count is required'
			})
		}
		if (insert_products.length == 0) {
			return res.json({
				status: false,
				message: "Count is required"
			})
		}
		let stock_transfer = new StockTransfer({
			collectionpoint_id: collection_point,
			type: 'COLLECTIONPOINT',
			products: insert_products,
			created_at : new Date()
		})
		await stock_transfer.save()
		return res.json({
			status: true,
			message: 'Refill details have been saved'
		})
	} catch (err) {
		console.log(err)
		return res.json({
			status: false,
			message: 'Sorry something went wrong'
		})
	}
}

exports.getDriversBySuburb = async (req, res) => {
	let { suburb_id } = req.query
	let drivers = await Stock.aggregate([
		{
			$match: {
				date: new Date(moment().format("YYYY-MM-DD")),
				service_end_time: {
					$eq: null
				}
			}
		},
		{
			$group: {
				_id: null,
				driver_ids: {
					$push: "$driver_id"
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: {
					driver_ids: "$driver_ids"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$driver_ids"]
							}
						}
					}
				],
				as: "drivers"
			}
		},
		{
			$project: {
				drivers: 1
			}
		}
	])
}

exports.returnToFactory = async(req, res) => {
	let drivers = await DriverLog.aggregate([
		{
			$match: {
				date: new Date(moment().format("YYYY-MM-DD")),
				service_end_time: {
					$eq: null
				},
				callback_time: {
					$eq: null
				}
			}
		},
		{
			$group: {
				_id: null,
				driver_ids: {
					$push: "$driver_id"
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: {
					driver_ids: "$driver_ids"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$in: ["$_id", "$$driver_ids"]
							}
						}
					}
				],
				as: "drivers"
			}
		},
		{
			$project: {
				drivers: 1
			}
		}
	])
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
				$lookup: {
					from: "drivers",
					let: {
						driver_id: "$driver_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$_id", "$$driver_id"]
								}
							}
						},
						{
							$project: {
								name: 1,
								email: 1,
								mobile: 1,
								image: 1
							}
						}
					],
					as: "driver_details"
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
			}
		]
	)

	let data = {}
	if (drivers.length > 0) {
		data.drivers = drivers[0].drivers
	} else {
		data.drivers = []
	}
	data.drivers_lists = callbacked_drivers
	res.render("admin/transfers/returntofactory", data)
}

exports.returnFactory = async(req, res) => {
	try {
		let { driver_ids } = req.body
		if (typeof driver_ids === "undefined") {
			return res.json({
				status: false,
				message: "Driver ids is required"
			})
		}
		if (driver_ids.length <= 0) {
			return res.json({
				status: false,
				message: "Driver ids is required"
			})
		}
		let drivers = []
		let insert_data = []
		for (var i = 0; i < driver_ids.length; i++) {
			drivers.push(ObjectId(driver_ids[i]))
			stock_transfer = {
				driver_id: ObjectId(driver_ids[i]),
				type: 'RETURNFACTORY',
			},
				insert_data.push(stock_transfer)
		}
		await DriverLog.updateMany({
			driver_id: {
				$in: drivers
			},
			date: new Date(moment().format('YYYY-MM-DD'))
		}, {
			$set: {
				callback_time: new Date()
			}
		})
		await StockTransfer.insertMany(insert_data)
		let stopped_drivers = await Driver.find({
			_id: {
				$in: drivers
			}
		}, {
			device_token: 1
		})
		for (var i = 0; i < stopped_drivers.length; i++) {
			title = "Return To Factory"
			message = "Your service has been stopped by admin. For more details contact admin"
			token = stopped_drivers[i].device_token
			await SendNotificaiton(title, message, "high", token)
		}
		return res.json({
			status: true,
			message: "Drivers has been callbacked"
		})
	} catch(err) {
		console.log(err)
		return res.json({
			status: false,
			message: "Sorry something went wrong"
		})
	}
}