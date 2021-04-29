const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const moment = require('moment');
const Order = mongoose.model('bookings')
const Driver = mongoose.model('drivers')
const CP = mongoose.model('collectionpoints')
const CpSale = mongoose.model('cp_sales')
const Stock = mongoose.model("stocks")
const Excel = require('exceljs');
const Products = mongoose.model("products")
const Users = mongoose.model("users")
const _lodash = require("lodash");
const Suburb = mongoose.model("suburbs")
const Setting = mongoose.model("settings")

//driversales reports
exports.driverSales = async (req, res) => {
	let { from_date, to_date, page, limit, search } = req.query

	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let query = [
		{
			$match: {
				delete_status: false,
				is_approved: true
			}
		},
		{
			$lookup: {
				from: "bookings",
				let: {
					driver_id: "$_id",
					from_date,
					to_date
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$delivered_by", "$$driver_id"] },
									{ $eq: ["$delete_status", false] },
									{ $eq: ["$redeemed", true] },
									{ $gte: ["$scheduled_date", "$$from_date"] },
									{ $lte: ["$scheduled_date", "$$to_date"] },
								]
							}
						}
					},
					{
						$lookup: {
							from: "payments",
							let: {
								payment_id: "$payment_id"
							},
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$payment_id"] }
											]
										}
									}
								},
								{
									$project: {
										total_price: 1
									}
								}
							],
							as: "payment"
						}
					},
					{
						$addFields: {
							price: {
								$arrayElemAt: ["$payment.total_price", 0]
							}
						}
					},
					{
						$project: {
							_id: 1,
							price: 1
						}
					}
				],
				as: "bookings"
			}
		},
		{
			$addFields: {
				booking_count: {
					$size: "$bookings"
				}
			}
		},
		{
			$lookup: {
				from: "driver_logs",
				let: {
					driver_id: "$_id",
					from_date,
					to_date
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$driver_id", "$$driver_id"] },
									{ $gte: ["$date", "$$from_date"] },
									{ $lte: ["$date", "$$to_date"] },
									{ $ne: ["$service_end_time", null] }
								]
							}
						}
					},
					{
						$addFields: {
							total_workhours: {
								$divide: [
									{ $subtract: ["$service_end_time", "$service_start_time"] },
									60 * 1000
								]

							},
							active_workhours: {
								$divide: [
									{ $subtract: ["$service_end_time", "$dedicated_start_time"] },
									60 * 1000
								]

							}
						}
					},
					{
						$addFields: {
							inactive_hrs: {
								$add: [
									{
										$divide: [
											{
												$subtract: ["$dedicated_start_time", "$service_start_time"],
											},
											60 * 1000,
										],
									},
									{
										$divide: [
											{
												$subtract: ["$service_end_time", "$callback_time"],
											},
											60 * 1000,
										],
									},
								]
							},
						}
					},
					{
						$group: {
							_id: "$driver_id",
							total_workhours: {
								$sum: "$total_workhours"
							},
							active_workhours: {
								$sum: "$active_workhours"
							},
							inactive_hours: {
								$sum: "$inactive_workhours"
							},
						}
					},
					{
						$addFields: {
							total_workhours: {
								$concat: [
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$divide: ["$total_workhours", 60]
														}
													}
												},
												"Hrs "
											]
										}
									},
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$mod: ["$total_workhours", 60]
														}
													}
												},
												"Mnts"
											]
										}
									}
								]
							},
							active_workhours: {
								$concat: [
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$divide: ["$active_workhours", 60]
														}
													}
												},
												"Hrs "
											]
										}
									},
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$mod: ["$active_workhours", 60]
														}
													}
												},
												"Mnts"
											]
										}
									}
								]
							},
							inactive_hours: {
								$concat: [
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$divide: ["$inactive_hours", 60]
														}
													}
												},
												"Hrs "
											]
										}
									},
									{
										$toString: {
											$concat: [
												{
													$toString: {
														$floor: {
															$mod: ["$inactive_hours", 60]
														}
													}
												},
												"Mnts"
											]
										}
									}
								]
							}
						}
					}
				],
				as: "workingtime"
			}
		},
		{
			$addFields: {
				workingtime: {
					$arrayElemAt: ["$workingtime", 0]
				}
			}
		},
		{
			$match: {
				$expr: {
					$and: [
						{ $gt: ['$booking_count', 0] }
					]
				}
			}
		}
	]

	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		query.push({
			$match: {
				$or: [
					{ 'name': regex },
					{ 'mobile': regex },
					{ 'email': regex },
				]
			}
		})
	}

	let itemCount = await Driver.aggregate([...query,
	{
		$count: "count"
	}])

	let drivers = await Driver.aggregate([...query, {
		$skip: skip
	}, {
		$limit: limit
	},
	{
		$project: {
			_id: 1,
			name: 1,
			mobile: 1,
			email: 1,
			bookings: 1,
			workingtime: 1,
		}
	},
	{
		$unwind: "$bookings"
	},
	{
		$group: {
			_id: "$_id",
			name: {
				$first: "$name"
			},
			email: {
				$first: "$email"
			},
			mobile: {
				$first: "$mobile"
			},
			workingtime: {
				$first: "$workingtime"
			},
			count: { $sum: 1 },
			total_price: {
				$sum: "$bookings.price"
			}
		}
	},
	{
		$sort: {
			count: -1
		}
	}])

	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);

	// return res.json(drivers)

	return res.render('admin/reports/driversales', {
		drivers,
		search,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	})
}

exports.driverSalesExport = async (req, res) => {
	let { driver_id, from_date, to_date } = req.query

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	//get notification
	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delivered_by", ObjectId(driver_id)] },
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: {
					user_id: "$user_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$user_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1,
							mobile: 1,
							email: 1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$unwind: "$orders"
		},
		{
			$lookup: {
				from: "products",
				let: {
					product_id: "$orders.product_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$product_id"] }
								]
							}
						}
					}
				],
				as: 'product'
			}
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0]
				}
			}
		},
		{
			$project: {
				_id: 1,
				user: 1,
				scheduled_date: 1,
				booking_id: 1,
				booking_type: 1,
				product: {
					_id: "$product._id",
					name: "$product.name",
					qunatity: "$orders.quantity"
				},
			}
		},
		{
			$group: {
				_id: "$_id",
				user: {
					$first: "$user"
				},
				booking_id: {
					$first: "$booking_id"
				},
				scheduled_date: {
					$first: "$scheduled_date"
				},
				booking_type: {
					$first: "$booking_type"
				},
				orders: {
					$addToSet: "$product"
				}
			}
		}
	])

	if (orders.length > 0) {

		const workbooks = new Excel.Workbook();
		const worksheet = workbooks.addWorksheet(`Orders`, {
			properties: { tabColor: { argb: "FFC0000" } },
		});
		worksheet.columns = [
			{ header: "Booking ID", key: "booking_id", width: 20 },
			{ header: "Name", key: "user_name", width: 20 },
			{ header: "Email", key: "user_email", width: 20 },
			{ header: "Mobile", key: "user_mobile", width: 20 },
			{ header: "Date", key: "scheuled_date", width: 20 },
			{ header: "Orders", key: "orders", width: 50 },
		];

		orders.forEach(order => {
			let { booking_id, user: { name: user_name, email: user_email, mobile: user_mobile }, scheduled_date, orders: products } = order
			let orders_string = ""
			products.forEach(order => {
				let { name, qunatity } = order
				orders_string += `${name} = ${qunatity},`
			})
			const rows = [
				booking_id,
				user_name,
				user_email,
				user_mobile,
				moment(scheduled_date).format('YYYY-MM-DD'),
				orders_string
			]
			worksheet.addRow(rows)
		})

		await workbooks.xlsx
			.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
			.then(() => {
				return res.redirect(
					res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
				);
			})
			.catch((err) => {
				return res.redirect(res.locals.app_url + `/dashboard`);
			});
	} else {
		return res.redirect(res.locals.app_url + `/reports/driversales`);
	}
}

//driversales reports
exports.cpSales = async (req, res) => {

	let { from_date, to_date, page, limit, search } = req.query

	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let query = [
		{
			$match: {
				delete_status: false,
				approved: true
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: {
					collectionpoint_id: "$_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$collectionpoint_id", "$$collectionpoint_id"] }
								]
							}
						}
					},
					{
						$lookup: {
							from: "suburbs",
							let: {
								suburb_id: "$suburb_id"
							},
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$suburb_id"] }
											]
										}
									}
								},
								{
									$project: {
										_id: 1,
										name: 1
									}
								}
							],
							as: "suburb"
						}
					},
					{
						$addFields: {
							suburb: {
								$arrayElemAt: ["$suburb", 0]
							}
						}
					},
					{
						$project: {
							_id: "$suburb._id",
							name: "$suburb.name"
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "bookings",
				let: {
					cp_id: "$_id",
					from_date,
					to_date
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$collectionpoint_id", "$$cp_id"] },
									{ $eq: ["$redeemed", true] },
									{ $gte: ["$scheduled_date", "$$from_date"] },
									{ $lte: ["$scheduled_date", "$$to_date"] },
								]
							}
						}
					},
					{
						$lookup: {
							from: "payments",
							let: {
								payment_id: "$payment_id"
							},
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$payment_id"] }
											]
										}
									}
								},
								{
									$project: {
										total_price: 1
									}
								}
							],
							as: "payment"
						}
					},
					{
						$addFields: {
							price: {
								$arrayElemAt: ["$payment.total_price", 0]
							}
						}
					},
					{
						$project: {
							_id: 1,
							redeemed: 1,
							price: 1
						}
					},
					{
						$group: {
							_id: "$redeemed",
							count: {
								$sum: 1
							},
							price: {
								$sum: "$price"
							}
						}
					}
				],
				as: "orders_byapp"
			}
		},
		{
			$addFields: {
				orders_from_app: {
					$arrayElemAt: ["$orders_byapp.count", 0]
				},
				orders_from_app_price: {
					$arrayElemAt: ["$orders_byapp.price", 0]
				}
			}
		},

		{
			$lookup: {
				from: "cp_sales",
				let: {
					cp_id: "$_id",
					from_date,
					to_date
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$collectionpoint_id", "$$cp_id"] },
									{ $gte: ["$date", "$$from_date"] },
									{ $lte: ["$date", "$$to_date"] },
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							collectionpoint_id: 1,
							total: 1
						}
					},
					{
						$group: {
							_id: "$collectionpoint_id",
							count: {
								$sum: 1
							},
							total: {
								$sum: "$total"
							}
						}
					}
				],
				as: "orders_direct"
			}
		},
		{
			$addFields: {
				orders_direct: {
					$arrayElemAt: ["$orders_direct.count", 0]
				},
				orders_direct_price: {
					$arrayElemAt: ["$orders_direct.total", 0]
				}
			}
		},
		{
			$project: {
				_id: 1,
				name: 1,
				orders_from_app: 1,
				orders_from_app_price: 1,
				orders_direct: 1,
				orders_direct_price: 1,
				suburb: 1
			}
		}
	]

	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		query.push({
			$match: {
				$or: [
					{ 'name': regex }
				]
			}
		})
	}


	let itemCount = await CP.aggregate([...query,
	{
		$count: "count"
	}])

	let collectionpoints = await CP.aggregate([...query, {
		$skip: skip
	}, {
		$limit: limit
	}])


	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);


	return res.render('admin/reports/cpsales', {
		collectionpoints,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		search,
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	})
}

exports.cpSalesExport = async (req, res) => {
	let { cp_id, from_date, to_date } = req.query

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	//get notification
	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$collectionpoint_id", ObjectId(cp_id)] },
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: {
					user_id: "$user_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$user_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1,
							mobile: 1,
							email: 1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$unwind: "$orders"
		},
		{
			$lookup: {
				from: "products",
				let: {
					product_id: "$orders.product_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$product_id"] }
								]
							}
						}
					}
				],
				as: 'product'
			}
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0]
				}
			}
		},
		{
			$project: {
				_id: 1,
				user: 1,
				scheduled_date: 1,
				booking_id: 1,
				booking_type: 1,
				product: {
					_id: "$product._id",
					name: "$product.name",
					qunatity: "$orders.quantity"
				},
			}
		},
		{
			$group: {
				_id: "$_id",
				user: {
					$first: "$user"
				},
				booking_id: {
					$first: "$booking_id"
				},
				scheduled_date: {
					$first: "$scheduled_date"
				},
				booking_type: {
					$first: "$booking_type"
				},
				orders: {
					$addToSet: "$product"
				}
			}
		}
	])

	let directsales = await CpSale.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$collectionpoint_id", ObjectId(cp_id)] },
						{ $eq: ["$delete_status", false] },
						{ $gte: ["$date", from_date] },
						{ $lte: ["$date", to_date] },
					]
				}
			}
		},
		{
			$unwind: "$products"
		},
		{
			$lookup: {
				from: "products",
				let: {
					product_id: "$products.product_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$product_id"] }
								]
							}
						}
					}
				],
				as: 'product'
			}
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0]
				}
			}
		},
		{
			$project: {
				_id: 1,
				date: 1,
				booking_id: 1,
				product: {
					_id: "$product._id",
					name: "$product.name",
					qunatity: "$products.stock"
				},
			}
		},
		{
			$group: {
				_id: "$_id",
				date: {
					$first: "$date"
				},
				booking_id: {
					$first: "$booking_id"
				},
				products: {
					$addToSet: "$product"
				}
			}
		}
	])

	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Orders`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet.columns = [
		{ header: "Booking ID", key: "booking_id", width: 20 },
		{ header: "Name", key: "user_name", width: 20 },
		{ header: "Email", key: "user_email", width: 20 },
		{ header: "Mobile", key: "user_mobile", width: 20 },
		{ header: "Date", key: "scheuled_date", width: 20 },
		{ header: "Orders", key: "orders", width: 50 },
	];

	if (orders.length > 0) {
		orders.forEach(order => {
			let { booking_id, user: { name: user_name, email: user_email, mobile: user_mobile }, scheduled_date, orders: products } = order
			let orders_string = ""
			products.forEach(order => {
				let { name, qunatity } = order
				orders_string += `${name} = ${qunatity},`
			})
			const rows = [
				booking_id,
				user_name,
				user_email,
				user_mobile,
				moment(scheduled_date).format('YYYY-MM-DD'),
				orders_string
			]
			worksheet.addRow(rows)
		})

	}

	const worksheet2 = workbooks.addWorksheet(`Direct Purchase`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});

	worksheet2.columns = [
		{ header: "Booking ID", key: "booking_id", width: 20 },
		{ header: "Date", key: "scheuled_date", width: 20 },
		{ header: "Orders", key: "orders", width: 50 },
	];

	if (directsales.length > 0) {
		directsales.forEach(order => {
			let { booking_id, date, products } = order
			let orders_string = ""
			products.forEach(order => {
				let { name, qunatity } = order
				orders_string += `${name} = ${qunatity},`
			})
			const rows = [
				booking_id,
				moment(date).format('YYYY-MM-DD'),
				orders_string
			]
			worksheet.addRow(rows)
		})
	}

	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.individualsales = async (req, res) => {
	let { driver_id, from_date, to_date } = req.params
	console.log(driver_id, from_date, to_date)

	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delivered_by", ObjectId(driver_id)] },
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$delivered_time", from_date] },
						{ $lte: ["$delivered_time", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: { driver_id: ObjectId(driver_id) },
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
							name: 1
						}
					}
				],
				as: "driver",
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
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$address_id"] }
								]
							}
						}
					},
					{
						$project: {
							address_line1: 1,
							house_flat_no: 1,
							appartment: 1,
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$suburb_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: {
					user_id: "$user_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$user_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1,
							mobile: 1,
							email: 1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$project: {
				_id: 1,
				user: 1,
				driver: 1,
				address: 1,
				suburb: 1,
				scheduled_date: 1,
				delivered_time: 1,
				booking_id: 1,
				booking_type: 1,
				products: 1
			}
		}
	])
	// return res.json({orders})
	return res.render("admin/reports/individualdriversales", { orders })
}

exports.orderSales = async (req, res) => {
	let { from_date, to_date, page, limit, search } = req.query

	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}
	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}
	let query = [
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			},
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: [
								{
									$eq: ["$_id", "$$user_id"]
								}
							]
						}
					},
				}, {
					$project: {
						_id: 1,
						name: 1
					}
				}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$address_id"] }
								]
							}
						}
					},
					{
						$project: {
							address_line1: 1,
							house_flat_no: 1,
							appartment: 1,
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$suburb_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: { driver_id: "$driver_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$driver_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
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
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$$shift_id", "$shift_times._id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			}
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$project: {
				redeemed: 1,
				booking_type: 1,
				booking_id: 1,
				delivered_time: 1,
				user: 1,
				address: 1,
				suburb: 1,
				driver: 1,
				shift: 1,
				products: 1
			}
		}
	]

	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		query.push({
			$match: {
				$or: [
					{ 'booking_id': regex },
					{ 'suburb.name': regex },
					{ 'driver.name': regex },
				]
			}
		})
	}

	let itemCount = await Order.aggregate([...query, {
		$count: "count"
	}])

	let orders = await Order.aggregate([...query,
	{
		$skip: skip
	},
	{
		$limit: limit
	}
	])
	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);
	// let products= await Products.find({delete_status:false})
	let bookings_cond = [
		{ $eq: ["$delete_status", false] },
		{ $eq: ["$redeemed", true] },
		{ $gte: ["$scheduled_date", from_date] },
		{ $lte: ["$scheduled_date", to_date] },
	]

	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		bookings_cond.push({
			$match: {
				$or: [
					{ 'booking_id': regex },
				]
			}
		})
	}
	let totalQuantity = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$unwind: "$products"
		},
		{
			$group: {
				_id: "$products._id",
				tot_qty: {
					$sum: "$products.quantity"
				},
				product_name: { "$first": "$products.name" }
			}
		},
	])
	// return res.json(totalQuantity)
	let data = {
		totalQuantity,
		orders,
		search,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	}
	// return res.json({orders})
	return res.render("admin/reports/orders", data)
}

exports.ordersExport = async (req, res) => {

	let { from_date, to_date } = req.query
	console.log(from_date, to_date)
	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			},
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: [
								{
									$eq: ["$_id", "$$user_id"]
								}
							]
						}
					},
				}, {
					$project: {
						_id: 1,
						name: 1
					}
				}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$address_id"] }
								]
							}
						}
					},
					{
						$project: {
							address_line1: 1,
							house_flat_no: 1,
							appartment: 1,
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$suburb_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "drivers",
				let: { driver_id: "$driver_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$driver_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
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
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$$shift_id", "$shift_times._id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			}
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$unwind: "$orders"
		},
		{
			$lookup: {
				from: "products",
				let: {
					product_id: "$orders.product_id"
				},
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$product_id"] }
								]
							}
						}
					}
				],
				as: 'product'
			}
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0]
				}
			}
		},
		{
			$project: {
				redeemed: 1,
				booking_type: 1,
				booking_id: 1,
				delivered_time: 1,
				user: 1,
				address: 1,
				suburb: 1,
				driver: 1,
				shift: 1,
				product: {
					_id: "$product._id",
					name: "$product.name",
					qunatity: "$orders.quantity"
				},
			}
		},
		{
			$group: {
				_id: "$_id",
				booking_type: {
					$first: "$booking_type"
				},
				booking_id: {
					$first: "$booking_id"
				},
				redeemed: {
					$first: "$redeemed"
				},
				delivered_time: {
					$first: "$delivered_time"
				},
				user: {
					$first: "$user"
				},
				suburb: {
					$first: "$suburb"
				},
				address: {
					$first: "$address"
				},
				driver: {
					$first: "$driver"
				},
				shift: {
					$first: "$shift"
				},
				product: {
					$addToSet: "$product"
				}
			}
		}
	])

	let totalQuantity = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$unwind: "$products"
		},
		{
			$group: {
				_id: "$products._id",
				tot_qty: {
					$sum: "$products.quantity"
				},
				product_name: { "$first": "$products.name" }
			}
		},
	])

	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Orders`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet.columns = [
		{ header: "Product Name", key: "product_name", width: 30 },
		{ header: "Quantity", key: "tot_qty", width: 20 }
	]
	if (totalQuantity) {
		totalQuantity.forEach((product) => {
			const rows = [
				product.product_name,
				product.tot_qty
			]
			worksheet.addRow(rows)
		})
	}

	const worksheet2 = workbooks.addWorksheet(`Individual Sales`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet2.columns = [
		{ header: "Order Id", key: "booking_id", width: 20 },
		{ header: "User Name", key: "user", width: 20 },
		{ header: "Order Type", key: "booking_type", width: 20 },
		{ header: "Delivery Driver", key: "driver", width: 20 },
		{ header: "Suburb", key: "suburb", width: 20 },
		{ header: "Address", key: "address", width: 40 },
		{ header: "Delviery Date", key: "delivered_time", width: 20 },
		{ header: "Deliver Time", key: "delivered_time", width: 20 },
		{ header: "Delivery Status", key: "redeemed", width: 10 },
		{ header: "Products", key: "products", width: 50 }
	]
	if (orders) {
		orders.forEach(order => {
			let { user, address, suburb, product, booking_id, booking_type, driver, delivered_time, redeemed } = order
			let orders_string = ""
			product.forEach(order => {
				let { name, qunatity } = order
				orders_string += `${name} = ${qunatity},`
			})
			if (redeemed == true) {
				deliverystatus = "Delivered"
			}
			if (user) {
				user_name = user.name
			}
			else {
				user_name = "-----"
			}
			if (driver) {
				driver_name = driver.name
			}
			else {
				driver_name = "-----"
			}
			if (suburb) {
				suburb_name = suburb.name
			}
			const rows = [
				booking_id,
				user_name,
				booking_type,
				driver_name,
				suburb_name,
				address.address_line1,
				moment(delivered_time).format('MMMM Do YYYY'),
				moment(delivered_time).format(' h:mm:ss a'),
				deliverystatus,
				orders_string
			]
			worksheet2.addRow(rows)
		})
	}
	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.paymentreports = async (req, res) => {

	let { from_date, to_date, page, limit, search } = req.query

	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}
	let query = [
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			},

		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: [
								{
									$eq: ["$_id", "$$user_id"]
								}
							]
						}
					},
				}, {
					$project: {
						_id: 1,
						name: 1
					}
				}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$address_id"] }
								]
							}
						}
					},
					{
						$project: {
							address_line1: 1,
							house_flat_no: 1,
							appartment: 1,
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "payments",
				let: { payment_id: "$payment_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$payment_id"] }
								]
							}
						}
					},
					{
						$project: {
							credit_used: 1,
							actual_price: 1,
							total_price: 1,
							delivery_charge: 1,
							discount_price: 1,
							transaction_id: 1,
							gst: 1
						}
					}
				],
				as: "payments",
			}
		},
		{
			$addFields: {
				payments: {
					$arrayElemAt: ["$payments", 0]
				}
			}
		},
		{
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$$shift_id", "$shift_times._id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			}
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$project: {
				redeemed: 1,
				booking_type: 1,
				coupon: 1,
				booking_id: 1,
				delivered_time: 1,
				delivery_type: 1,
				user: 1,
				address: 1,
				payments: 1,
				shift: 1,
			}
		}

	]
	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		query.push({
			$match: {
				$or: [
					{ 'user.name': regex },
					{ 'booking_id': regex },
				]
			}
		})
	}

	let itemCount = await Order.aggregate([...query,
	{
		$count: "count"
	}])

	let orders = await Order.aggregate([...query,
	{
		$skip: skip
	},
	{
		$limit: limit
	}

	])
	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);

	// return res.json({orders})
	let data = {
		orders,
		search,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	}
	return res.render("admin/reports/paymentreports", data)
}

exports.paymentsexport = async (req, res) => {
	let { from_date, to_date } = req.query
	console.log(from_date, to_date)
	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}
	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$redeemed", true] },
						{ $gte: ["$created_at", from_date] },
						{ $lte: ["$created_at", to_date] },
					]
				}
			},

		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: [
								{
									$eq: ["$_id", "$$user_id"]
								}
							]
						}
					},
				}, {
					$project: {
						_id: 1,
						name: 1
					}
				}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$address_id"] }
								]
							}
						}
					},
					{
						$project: {
							address_line1: 1,
							house_flat_no: 1,
							appartment: 1,
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "payments",
				let: { payment_id: "$payment_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$payment_id"] }
								]
							}
						}
					},
					{
						$project: {
							credit_used: 1,
							actual_price: 1,
							total_price: 1,
							delivery_charge: 1,
							discount_price: 1,
							transaction_id: 1,
							gst: 1
						}
					}
				],
				as: "payments",
			}
		},
		{
			$addFields: {
				payments: {
					$arrayElemAt: ["$payments", 0]
				}
			}
		},
		{
			$project: {
				redeemed: 1,
				booking_type: 1,
				booking_id: 1,
				delivered_time: 1,
				delivery_type: 1,
				user: 1,
				address: 1,
				payments: 1
			}
		}
	])
	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Payments`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet.columns = [
		{ header: "Booking ID", key: "booking_id", width: 20 },
		{ header: "Name", key: "user_name", width: 20 },
		{ header: "Order Type", key: "booking_type", width: 20 },
		{ header: "Address", key: "address_line1", width: 50 },
		{ header: "Date", key: "scheuled_date", width: 20 },
		{ header: "Order Style", key: "delivery_type", width: 20 },
		{ header: "Delivery charge", key: "delivery_charge", width: 20 },
		{ header: "GST", key: "gst", width: 10 },
		{ header: "Credit Used", key: "credit_used", width: 20 },
		{ header: "Total Amount", key: "total_price", width: 20 },
		{ header: "Transcation Id", key: "transaction_id", width: 40 }
	];

	worksheet.getRow(1).fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'b0ffff' }
	}

	if (orders.length > 0) {
		orders.forEach(order => {
			let { booking_id, user: { name: user_name }, address: { address_line1 }, scheduled_date, booking_type, delivery_type, payments: { delivery_charge, gst, credit_used, total_price, transaction_id } } = order

			const rows = [
				booking_id,
				user_name,
				booking_type,
				address_line1,
				moment(scheduled_date).format('YYYY-MM-DD'),
				delivery_type,
				delivery_charge,
				gst.toFixed(2),
				credit_used,
				total_price,
				transaction_id
			]
			worksheet.addRow(rows)
		})

	}
	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.userExports = async (req, res) => {

	let users = await Users.aggregate([
		{
			$lookup: {
				from: "addresses",
				let: { user_id: "$_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$delete_status", false] },
									{ $eq: ["$active_location", true] },
									{ $eq: ["$user_id", "$$user_id"] }
								]
							}
						}
					},
					{
						$project: {
							suburb_id: 1
						}
					}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$suburb_id"] }
								]
							}
						}
					},
					{
						$project: {
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$sort: {
				_id: -1
			}
		}
	])
	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Users`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet.columns = [
		{ header: "Name", key: "name", width: 20 },
		{ header: "Suburb", key: "suburb", width: 30 },
		{ header: "Email", key: "email", width: 40 },
		{ header: "Mobile", key: "mobile", width: 30 },
		{ header: "Created at", key: "created_at", width: 30 }
	]

	worksheet.getRow(1).fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'b0ffff' }
	}
	users.forEach(user => {
		if (user.suburb) {
			suburb_name = user.suburb.name
		}
		else {
			suburb_name = "----"
		}
		const rows = [
			user.name,
			suburb_name,
			user.email,
			user.mobile,
			moment(user.created_at).format('YYYY-MM-DD'),
		]
		worksheet.addRow(rows)
	})

	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.scheduledOrders = async (req, res) => {
	let { from_date, to_date, limit, search, page } = req.query
	console.log(from_date, to_date)
	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let query = [
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$booking_type", "SCHEDULED"] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$user_id"]
								}
							}
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							mobile:1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: {
								$eq: ["$_id", "$$address_id"]
							}
						}
					},
				}, {
					$project: {
						address_line1: 1,
						house_flat_no: 1,
						appartment: 1,
						suburb_id: 1
					}
				}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$user_id"]
								}
							}
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							mobile:1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "collectionpoints",
				let: { cp_id: "$collectionpoint_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: {
								$eq: ["$_id", "$$cp_id"]
							}
						}
					},
				}, {
					$project: {
						name: 1,
						email: 1,
						mobile: 1
					}
				}
				],
				as: "collectionpoint"
			}
		},
		{
			$addFields: {
				collectionpoint: {
					$arrayElemAt: ["$collectionpoint", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$suburb_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$$shift_id", "$shift_times._id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			},
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$project: {
				booking_type: 1,
				redeemed: 1,
				created_at: 1,
				scheduled_date: 1,
				booking_id: 1,
				delivery_type: 1,
				user: 1,
				shift: 1,
				suburb: 1,
				products: 1,
				collectionpoint: 1,
				address:1
			}
		},
	]

	if (search) {
		let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
		query.push({
			$match: {
				$or: [
					{ 'booking_id': regex },
					{ 'suburb.name': regex },
					{ 'driver.name': regex },
				]
			}
		})
	}

	let itemCount = await Order.aggregate([...query, {
		$count: "count"
	}])

	let orders = await Order.aggregate([...query,
	{
		$skip: skip
	},
	{
		$limit: limit
	}
	])
	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);

	let total_quantity = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$booking_type", "SCHEDULED"] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$unwind: "$products"
		},
		{
			$group: {
				_id: "$products._id",
				tot_qty: {
					$sum: "$products.quantity"
				},
				product_name: { "$first": "$products.name" }
			}
		},
	])
	// return res.json(orders)
	return res.render("admin/reports/scheduledorders", {
		total_quantity,
		orders,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		search,
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	})
}

exports.scheduledOrderexport = async (req, res) => {
	let { from_date, to_date } = req.query
	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}
	let total_quantity = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$booking_type", "SCHEDULED"] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$unwind: "$products"
		},
		{
			$group: {
				_id: "$products._id",
				tot_qty: {
					$sum: "$products.quantity"
				},
				product_name: { "$first": "$products.name" }
			}
		},
	])

	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Scheduled Orders`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});
	worksheet.columns = [
		{ header: "ID", key: "index", width: 5 },
		{ header: "Product", key: "product_name", width: 30 },
		{ header: "Quantity", key: "tot_qty", width: 20 }
	]

	worksheet.getRow(1).fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: { argb: 'b0ffff' }
	}
	total_quantity.forEach((product, index) => {
		++index
		const rows = [
			index,
			product.product_name,
			product.tot_qty
		]
		worksheet.addRow(rows)
	})

	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.collectionpointorders = async (req, res) => {
	let { from_date, to_date, limit, search, page } = req.query
	console.log(from_date, to_date)
	if (typeof limit == 'undefined') {
		limit = 10
	}
	if (typeof page == 'undefined') {
		page = 1
	}

	let skip = 0
	if (page > 1) {
		skip = (page - 1) * limit
	}

	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let query = [
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$delivery_type", "COLLECTIONPOINT"] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] },
					]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$user_id"]
								}
							}
						},
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "addresses",
				let: { address_id: "$address_id" },
				pipeline: [{
					$match: {
						$expr: {
							$and: {
								$eq: ["$_id", "$$address_id"]
							}
						}
					},
				}, {
					$project: {
						suburb_id: 1,
						address_line1: 1,
						house_flat_no: 1,
						appartment: 1,
						landmark: 1,
						to_reach: 1
					}
				}
				],
				as: "address"
			}
		},
		{
			$addFields: {
				address: {
					$arrayElemAt: ["$address", 0]
				}
			}
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$address.suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$suburb_id"]
								}
							}
						}
					},
					{
						$project: {
							name: 1
						}
					}
				],
				as: "suburb"
			}
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0]
				}
			}
		},
		{
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$$shift_id", "$shift_times._id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			},
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$lookup: {
				from: "collectionpoints",
				let: { collectionpoint_id: "$collectionpoint_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: {
									$eq: ["$_id", "$$collectionpoint_id"]
								}
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "collectionpoint"
			}
		},
		{
			$addFields: {
				collectionpoint: {
					$arrayElemAt: ["$collectionpoint", 0]
				}
			}
		},
		{
			$lookup: {
				from: "products",
				let: { orders: "$orders" },
				pipeline: [
					{
						$addFields: {
							orders: "$$orders",
						},
					},
					{
						$unwind: "$orders",
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$orders.product_id"] },
								],
							},
						},
					},
					{
						$project: {
							_id: 1,
							name: 1,
							quantity: "$orders.quantity",
						},
					},
				],
				as: "products"
			}
		},
		{
			$sort: {
				scheduled_date: -1
			}
		},
		{
			$project: {
				booking_type: 1,
				redeemed: 1,
				created_at: 1,
				scheduled_date: 1,
				booking_id: 1,
				delivery_type: 1,
				user: 1,
				shift: 1,
				suburb: 1,
				products: 1,
				collectionpoint: 1,
				address: 1
			}
		},
	]

	let itemCount = await Order.aggregate([...query,
	{
		$count: "count"
	}
	])

	let orders = await Order.aggregate([...query,
	{
		$skip: skip
	},
	{
		$limit: limit
	}
	])
	if (itemCount.length > 0) {
		itemCount = itemCount[0].count
	} else {
		itemCount = 0
	}

	const pageCount = Math.ceil(itemCount / limit);
	// return res.json(orders)
	return res.render("admin/reports/collectionpointorders", {
		orders,
		search,
		from_date: moment(from_date).format('YYYY-MM-DD'),
		to_date: moment(to_date).format('YYYY-MM-DD'),
		itemCount,
		pageCount,
		pages: paginate.getArrayPages(req)(5, pageCount, page),
		activePage: page,
	})
}

exports.collectionpointexports = async (req, res) => {
	let { from_date, to_date } = req.query
	if (from_date) {
		from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
	} else {
		from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
	} else {
		to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
	}

	let orders = await Order.aggregate([
		{
			$match: {
				$expr: {
					$and: [
						{ $eq: ["$delete_status", false] },
						{ $eq: ["$delivery_type", "COLLECTIONPOINT"] },
						{ $gte: ["$scheduled_date", from_date] },
						{ $lte: ["$scheduled_date", to_date] }
					]
				}
			}
		},
		{
			$lookup: {
				from: "collectionpoints",
				let: { collectionpoint_id: "$collectionpoint_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$delete_status", false] },
									{ $eq: ["$_id", "$$collectionpoint_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "collectionpoint"
			}
		},
		{
			$addFields: {
				collectionpoint: {
					$arrayElemAt: ["$collectionpoint", 0]
				}
			}
		},
		{
			$lookup: {
				from: "users",
				let: { user_id: "$user_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$user_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: 1
						}
					}
				],
				as: "user"
			}
		},
		{
			$addFields: {
				user: {
					$arrayElemAt: ["$user", 0]
				}
			}
		},
		{
			$lookup: {
				from: "settings",
				let: { shift_id: "$shift_id" },
				pipeline: [
					{
						$unwind: "$shift_times"
					},
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$shift_times._id", "$$shift_id"] }
								]
							}
						}
					},
					{
						$project: {
							_id: 1,
							name: "$shift_times.name"
						}
					}
				],
				as: "shift"
			}
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0]
				}
			}
		},
		{
			$unwind: "$orders"
		},
		{
			$lookup: {
				from: "products",
				let: { product_id: "$orders.product_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$_id", "$$product_id"] }
								]
							}
						}
					}
				],
				as: "product"
			}
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0]
				}
			}
		},
		{
			$project: {
				booking_type: 1,
				booking_id: 1,
				user: 1,
				shift: 1,
				created_at: 1,
				scheduled_date: 1,
				collectionpoint: 1,
				product: {
					_id: "$product._id",
					name: "$product.name",
					quantity: "$orders.quantity"
				}
			}
		},
		{
			$group: {
				_id: "$_id",
				booking_type: {
					$first: "$booking_type"
				},
				collectionpoint: {
					$first: "$collectionpoint"
				},
				booking_id: {
					$first: "$booking_id"
				},
				user: {
					$first: "$user"
				},
				shift: {
					$first: "$shift"
				},
				scheduled_date: {
					$first: "$scheduled_date"
				},
				created_at: {
					$first: "$created_at"
				},
				product: {
					$addToSet: "$product"
				}
			}
		}
	])
	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Collection Point orders`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});

	worksheet.columns = [
		{ header: "Collection Point", key: "collectionpoint", width: 30 },
		{ header: "Order Id", key: "booking_id", width: 30 },
		{ header: "User Name", key: "user", width: 30 },
		{ header: "Created At", key: "created_at", width: 20 },
		{ header: "Scheduled Date/Time", key: "scheduled_date", width: 30 },
		{ header: "Delivery Type", key: "booking_type", width: 30 },
		{ header: "Shift", key: "shift", width: 20 },
		{ header: "Products", key: "product", width: 50 }
	]
	orders.forEach(order => {
		let { user, shift, created_at, scheduled_date, booking_id, collectionpoint, product, booking_type } = order
		let orders_string = ""
		product.forEach(order => {
			let { name, quantity } = order
			orders_string += `${name} = ${quantity},`
		})
		if (collectionpoint) {
			collectionpoint_name = collectionpoint.name
		}
		else {
			collectionpoint_name = "-----"
		}
		if (user) {
			user_name = user.name
		}
		else {
			user_name = "------"
		}
		if (shift) {
			shift_name = shift.name
		}
		else {
			shift_name = "-----"
		}
		const rows = [
			collectionpoint_name,
			booking_id,
			user_name,
			moment(created_at).format('MMMM Do YYYY'),
			moment(scheduled_date).format('MMMM Do YYYY h:mm:ss a'),
			booking_type,
			shift_name,
			orders_string
		]

		worksheet.addRow(rows)
	})
	await workbooks.xlsx
		.writeFile(`public/reports/admin-${req.session._id}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/admin-${req.session._id}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.stockreportexport = async (req, res) => {
	let { from_date, to_date } = req.query;

	if (from_date) {
		from_date = new Date(moment(from_date).format("YYYY-MM-DD 00:00:000"));
	} else {
		from_date = new Date(moment().format("YYYY-MM-DD 00:00:000"));
	}

	if (to_date) {
		to_date = new Date(moment(to_date).format("YYYY-MM-DD 23:59"));
	} else {
		to_date = new Date(moment().format("YYYY-MM-DD 23:59"));
	}

	let query = [
		{
			$match: {
				delete_status: false,
				$expr: {
					$and: [{ $gte: ["$date", from_date] }, { $lte: ["$date", to_date] }],
				},
			},
		},
		{
			$lookup: {
				from: "settings",
				let: {
					date: {
						$dateToString: { format: "%Y-%m-%d", date: "$date" },
					},
					shift_id: "$shift_id",
				},
				pipeline: [
					{
						$unwind: "$shift_times",
					},
					{
						$match: {
							$expr: {
								$and: [
									{
										$eq: ["$shift_times._id", "$$shift_id"],
									},
								],
							},
						},
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
							start: { $toDate: { $concat: ["$$date", " ", "$time"] } },
							end: { $toDate: { $concat: ["$$date", " ", "$time"] } },
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
				],
				as: "shift",
			},
		},
		{
			$addFields: {
				shift: {
					$arrayElemAt: ["$shift", 0],
				},
			},
		},
		{
			$lookup: {
				from: "drivers",
				let: { driver_id: "$driver_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$driver_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
							mobile: "mobile",
							email: "$type",
						},
					},
				],
				as: "driver",
			},
		},
		{
			$addFields: {
				driver: {
					$arrayElemAt: ["$driver", 0],
				},
			},
		},
		{
			$lookup: {
				from: "suburbs",
				let: { suburb_id: "$suburb_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$suburb_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
						},
					},
				],
				as: "suburb",
			},
		},
		{
			$addFields: {
				suburb: {
					$arrayElemAt: ["$suburb", 0],
				},
			},
		},
	];


	let stocks = await Stock.aggregate([
		...query,
		{
			$unwind: "$initial_stock",
		},
		{
			$lookup: {
				from: "products",
				let: { product_id: "$initial_stock.product_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$product_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
							type: "$type",
						},
					},
				],
				as: "product",
			},
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0],
				},
			},
		},
		{
			$project: {
				_id: 1,
				suburb: 1,
				driver: 1,
				shift: 1,
				products: 1,
				initial_stock: {
					_id: "$initial_stock._id",
					product_id: "$initial_stock.product_id",
					stock: "$initial_stock.stock",
					box_id: "$initial_stock.box_id",
					product_name: "$product.name",
				},
				type: 1,
				date: 1,
			},
		},
		{
			$group: {
				_id: "$_id",
				suburb: {
					$first: "$suburb",
				},
				driver: {
					$first: "$driver",
				},
				shift: {
					$first: "$shift",
				},
				type: {
					$first: "$type",
				},
				date: {
					$first: "$date",
				},
				final_stock: {
					$first: "$products",
				},
				products: {
					$addToSet: "$initial_stock",
				},
			},
		},
		{
			$unwind: "$final_stock",
		},
		{
			$lookup: {
				from: "products",
				let: { product_id: "$final_stock.product_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$product_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
							type: "$type",
						},
					},
				],
				as: "product",
			},
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0],
				},
			},
		},
		{
			$project: {
				_id: 1,
				suburb: 1,
				driver: 1,
				shift: 1,
				products: 1,
				type: 1,
				date: 1,
				final_stock: {
					_id: "$final_stock._id",
					product_id: "$final_stock.product_id",
					stock: "$final_stock.stock",
					box_id: "$final_stock.box_id",
					product_name: "$product.name",
				},
			},
		},
		{
			$group: {
				_id: "$_id",
				suburb: {
					$first: "$suburb",
				},
				driver: {
					$first: "$driver",
				},
				shift: {
					$first: "$shift",
				},
				type: {
					$first: "$type",
				},
				date: {
					$first: "$date",
				},
				final_stocks: {
					$addToSet: "$final_stock",
				},
				products: {
					$first: "$products",
				},
			},
		},
		{
			$sort: {
				_id: -1,
			},
		},
	]);

	//   return res.json({stocks})

	let total_product_stocks = await Stock.aggregate([
		...query,
		{
			$unwind: "$initial_stock",
		},
		{
			$lookup: {
				from: "products",
				let: { product_id: "$initial_stock.product_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$product_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
							type: "$type",
						},
					},
				],
				as: "product",
			},
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0],
				},
			},
		},
		{
			$project: {
				_id: 1,
				suburb: 1,
				driver: 1,
				shift: 1,
				products: 1,
				initial_stock: {
					_id: "$initial_stock._id",
					product_id: "$initial_stock.product_id",
					stock: "$initial_stock.stock",
					box_id: "$initial_stock.box_id",
					product_name: "$product.name",
				},
				type: 1,
				date: 1,
			},
		},
		{
			$group: {
				_id: "$initial_stock.product_id",
				name: {
					$first: "$initial_stock.product_name",
				},
				stock: {
					$sum: "$initial_stock.stock",
				},
			},
		},
	]);

	let total_final_stocks = await Stock.aggregate([
		...query,
		{
			$unwind: "$products",
		},
		{
			$lookup: {
				from: "products",
				let: { product_id: "$products.product_id" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [{ $eq: ["$_id", "$$product_id"] }],
							},
						},
					},
					{
						$project: {
							_id: "$_id",
							name: "$name",
							type: "$type",
						},
					},
				],
				as: "product",
			},
		},
		{
			$addFields: {
				product: {
					$arrayElemAt: ["$product", 0],
				},
			},
		},
		{
			$project: {
				_id: "$product._id",
				name: "$product.name",
				stock: "$products.stock",
			},
		},
		{
			$group: {
				_id: "$_id",
				name: {
					$first: "$name",
				},
				final_stock: {
					$sum: "$stock",
				},
			},
		},
	]);

	var merged = _lodash.merge(
		_lodash.keyBy(total_final_stocks, "_id"),
		_lodash.keyBy(total_product_stocks, "_id")
	);
	total_product_stocks = _lodash.values(merged);

	//   return res.json({
	//    stocks
	//   })

	const workbooks = new Excel.Workbook();
	const worksheet = workbooks.addWorksheet(`Stock Report`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});

	worksheet.columns = [
		{ header: "Product", key: "product", width: 50 },
		{ header: "Total Stock", key: "total_stock", width: 30 },
		{ header: "Final Stock", key: "total_product_stock", width: 30 }
	]

	total_product_stocks.forEach(product => {
		let { name, final_stock, stock } = product
		const rows = [
			name,
			stock,
			final_stock,
		]
		worksheet.addRow(rows)
	})

	const worksheet2 = workbooks.addWorksheet(`Detailed Report`, {
		properties: { tabColor: { argb: "FFC0000" } },
	});

	worksheet2.columns = [
		{ header: "Driver", key: "driver", width: 30 },
		{ header: "Type", key: "type", width: 30 },
		{ header: "Suburb", key: "suburb", width: 30 },
		{ header: "Date", key: "date", width: 20 },
		{ header: "Shift", key: "shift", width: 20 },
		{ header: "Initial Stock", key: "products", width: 150 },
		{ header: "Final Stock", key: "final_stocks", width: 150 }
	]
	stocks.forEach(stock => {
		let { suburb, driver, shift, type, date, final_stocks, products } = stock
		let orders_string = ""
		let orders_string2 = ""
		products.forEach(product => {
			let { product_name, stock } = product
			orders_string += `${product_name} = ${stock},`
		})
		final_stocks.forEach(product => {
			let { product_name, stock } = product
			orders_string2 += `${product_name} = ${stock},`
		})
		if (shift) {
			shift_name = shift.name
		}
		else {
			shift_name = "-----"
		}
		if (suburb) {
			suburb_name = suburb.name
		}
		else {
			suburb_name = "-------"
		}
		if (driver) {
			driver_name = driver.name
		}
		else {
			driver_name = "------"
		}
		const rows = [
			driver_name,
			type,
			suburb_name,
			moment(date).format('MMM Do YY'),
			shift_name,
			orders_string,
			orders_string2
		]
		worksheet2.addRow(rows)
	})
	await workbooks.xlsx
		.writeFile(`public/reports/stockreports-${req.query.from_date}-${req.query.to_date}.xlsx`)
		.then(() => {
			return res.redirect(
				res.locals.asset_url + `/public/reports/stockreports-${req.query.from_date}-${req.query.to_date}.xlsx`
			);
		})
		.catch((err) => {
			return res.redirect(res.locals.app_url + `/dashboard`);
		});
}

exports.collectionPointCommission = async(req, res) => {
	try {

		let { from_date, to_date, page, limit, search } = req.query

		let commission = await Setting.findOne({}, {
			cp_commission_per_item: 1
		})
	
		if (typeof limit == 'undefined') {
			limit = 10
		}
		if (typeof page == 'undefined') {
			page = 1
		}
	
		let skip = 0
		if (page > 1) {
			skip = (page - 1) * limit
		}
	
		if (from_date) {
			from_date = new Date(moment(from_date).format('YYYY-MM-DD 00:00:000'))
		} else {
			from_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
		}
	
		if (to_date) {
			to_date = new Date(moment(to_date).format('YYYY-MM-DD 23:59'))
		} else {
			to_date = new Date(moment().format('YYYY-MM-DD 23:59'))
		}
	
		let query = [
			{
				$match: {
					delete_status: false,
					approved: true,
					rejected: false,
				}
			},
			{
				$lookup: {
					from: "addresses",
					let: {
						collectionpoint_id: "$_id"
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$collectionpoint_id", "$$collectionpoint_id"] }
									]
								}
							}
						},
						{
							$lookup: {
								from: "suburbs",
								let: {
									suburb_id: "$suburb_id"
								},
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $eq: ["$_id", "$$suburb_id"] }
												]
											}
										}
									},
									{
										$project: {
											_id: 1,
											name: 1
										}
									}
								],
								as: "suburb"
							}
						},
						{
							$addFields: {
								suburb: {
									$arrayElemAt: ["$suburb", 0]
								}
							}
						},
						{
							$project: {
								_id: "$suburb._id",
								name: "$suburb.name"
							}
						}
					],
					as: "suburb"
				}
			},
			{
				$addFields: {
					suburb: {
						$arrayElemAt: ["$suburb", 0]
					}
				}
			},
			{
				$lookup: {
					from: "bookings",
					let: {
						cp_id: "$_id",
						from_date,
						to_date
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$collectionpoint_id", "$$cp_id"] },
										{ $eq: ["$redeemed", true] },
										{ $gte: ["$scheduled_date", "$$from_date"] },
										{ $lte: ["$scheduled_date", "$$to_date"] },
									]
								}
							}
						},
						{
							$lookup: {
								from: "payments",
								let: {
									payment_id: "$payment_id"
								},
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $eq: ["$_id", "$$payment_id"] }
												]
											}
										}
									},
									{
										$project: {
											total_price: 1
										}
									}
								],
								as: "payment"
							}
						},
						{
							$addFields: {
								price: {
									$arrayElemAt: ["$payment.total_price", 0]
								}
							}
						},
						{
							$project: {
								_id: 1,
								redeemed: 1,
								orders: 1,
								price: 1
							}
						},
						{
							$group: {
								_id: "$redeemed",
								count: {
									$sum: 1
								},
								price: {
									$sum: "$price"
								}
							}
						}
					],
					as: "orders_byapp"
				}
			},
			{
				$addFields: {
					orders_from_app: {
						$arrayElemAt: ["$orders_byapp.count", 0]
					},
					orders_from_app_price: {
						$arrayElemAt: ["$orders_byapp.price", 0]
					}
				}
			},
	
			{
				$lookup: {
					from: "cp_sales",
					let: {
						cp_id: "$_id",
						from_date,
						to_date
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$collectionpoint_id", "$$cp_id"] },
										{ $gte: ["$date", "$$from_date"] },
										{ $lte: ["$date", "$$to_date"] },
									]
								}
							}
						},
						{
							$project: {
								_id: 1,
								collectionpoint_id: 1,
								total: 1
							}
						},
						{
							$group: {
								_id: "$collectionpoint_id",
								count: {
									$sum: 1
								},
								total: {
									$sum: "$total"
								}
							}
						}
					],
					as: "orders_direct"
				}
			},
			{
				$addFields: {
					orders_direct: {
						$arrayElemAt: ["$orders_direct.count", 0]
					},
					orders_direct_price: {
						$arrayElemAt: ["$orders_direct.total", 0]
					}
				}
			},
			{
				$project: {
					_id: 1,
					name: 1,
					orders_from_app: 1,
					orders_from_app_price: 1,
					orders_direct: 1,
					orders_direct_price: 1,
					suburb: 1,
					total_price: {
						$sum: ["$orders_from_app_price", "$orders_direct_price"]
					},
					final_commission: {
						$divide: [
							{
								$multiply: [
									{
										$sum: ["$orders_from_app_price", "$orders_direct_price"]
									},
									commission.cp_commission_per_item
								]
							},
							100
						]
					}
				}
			}
		]
	
		if (search) {
			let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
			query.push({
				$match: {
					$or: [
						{ 'name': regex }
					]
				}
			})
		}
	
	
		let itemCount = await CP.aggregate([...query,
		{
			$count: "count"
		}])
	
		let collectionpoints = await CP.aggregate([...query, 
			{
			$skip: skip
		}, {
			$limit: limit
		}
	])
	
	// return res.json({
	// 	collectionpoints
	// })
		if (itemCount.length > 0) {
			itemCount = itemCount[0].count
		} else {
			itemCount = 0
		}
	
		const pageCount = Math.ceil(itemCount / limit);
		
		let data = {
			collectionpoints,
			from_date: moment(from_date).format('YYYY-MM-DD'),
			to_date: moment(to_date).format('YYYY-MM-DD'),
			search,
			itemCount,
			pageCount,
			pages: paginate.getArrayPages(req)(5, pageCount, page),
			activePage: page
		}
		return res.render('admin/reports/cpcommissions', data)
	} catch(err) {
		console.log(err)
		return res.json({
			status: false,
			message: "Sorry something went wrong"
		})
	}
}