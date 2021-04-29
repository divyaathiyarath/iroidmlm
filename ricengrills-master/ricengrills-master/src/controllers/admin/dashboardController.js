const mongoose = require("mongoose");
const moment = require("moment");
let ObjectId = mongoose.Types.ObjectId;
let Driver = mongoose.model('drivers')
let Stock = mongoose.model('stocks')
let Suburb = mongoose.model('suburbs')
let CP = mongoose.model('collectionpoints')
let Order = mongoose.model('bookings')
let { getComingShift } = require('./stockController');
let Booking = mongoose.model('bookings')
const Excel = require('exceljs');
let _ = require('lodash')

exports.getUpcomingScheduleDrivers = async (coming_shift, selected_driver, selected_suburb) => {
    let query = []

    if (typeof selected_driver != 'undefined' && selected_driver) {
        query.push(
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: ['$driver_id', ObjectId(selected_driver)] }
                        ]
                    }
                }
            },
        )
    }
    if (typeof selected_suburb != 'undefined' && selected_suburb) {
        query.push(
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: ['$suburb_id', ObjectId(selected_suburb)] }
                        ]
                    }
                }
            },
        )
    }

    query.push(...[{
        $match: {
            delete_status: false,
            shift_id: ObjectId(coming_shift),
            $expr: {
                $and: [
                    {
                        $gte: ["$date", new Date(moment().format("YYYY-MM-DD"))],
                    },
                    {
                        $lte: [
                            "$date",
                            new Date(moment().format("YYYY-MM-DD 23:59")),
                        ],
                    },
                ],
            }
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
                        email: 1,
                        mobile: 1,
                        name: 1,
                        location: 1
                    }
                }
            ],
            as: "driver"
        }
    },
    {
        $lookup: {
            from: 'suburbs',
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
                        name: 1
                    }
                }
            ],
            as: "suburb"
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
        $lookup: {
            from: 'boxes',
            let: {
                box_id: '$products.box_id'
            },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ['$_id', '$$box_id'] },
                                { $eq: ['$delete_status', false] }
                            ]
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'sensors',
                        let: {
                            sensor_id: '$sensor_id'
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$_id', '$$sensor_id'] }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    uid: 1
                                }
                            }
                        ],
                        as: 'sensor'
                    }
                },
                {
                    $addFields: {
                        sensor: {
                            $arrayElemAt: ["$sensor", 0]
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        uid: 1,
                        sensor_id: "$sensor._id",
                        sensor_uid: "$sensor.uid"
                    }
                }
            ],
            as: 'box'
        }
    },
    {
        $addFields: {
            box: {
                $arrayElemAt: ["$box", 0]
            }
        }
    },
    {
        $project: {
            _id: 1,
            date: 1,
            shift_id: 1,
            driver_id: 1,
            name: {
                $arrayElemAt: ["$driver.name", 0]
            },
            location: {
                $arrayElemAt: ["$driver.location", 0]
            },
            suburb: {
                $arrayElemAt: ["$suburb", 0]
            },
            product: {
                product_id: "$product._id",
                box_id: "$products.box_id",
                stock: "$products.stock",
                product_name: "$product.name",
                box: "$box",
                type: "$product.type",
            },
            stock: { $cond: [{ $eq: ['$product.type', "FOOD"] }, '$products.stock', 0] },
        }
    },
    {
        $group: {
            _id: "$driver_id",
            stock_ids: {
                $addToSet: "$_id"
            },
            date: {
                $first: "$date"
            },
            shift_id: {
                $first: "$shift_id"
            },
            name: {
                $first: "$name"
            },
            location: {
                $first: "$location"
            },
            suburbs: {
                $addToSet: "$suburb"
            },
            products: {
                $addToSet: "$product"
            },
            total_products: {
                $sum: "$stock"
            }
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
                    $match: {
                        delete_status: false
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1
                    }
                },
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
                            $and: [
                                { $eq: ["$_id", "$products.product_id"] }
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        stock: {
                            $sum: "$products.stock"
                        },
                        product_id: {
                            $first: "$_id"
                        },
                        product_name: {
                            $first: "$name"
                        },
                        box_id: {
                            $first: "$products.box_id"
                        },
                        box: {
                            $first: "$products.box"
                        },
                        type: {
                            $first: "$products.type"
                        }
                    }
                }
            ],
            as: "products"
        }
    },
    {
        $project: {
            _id: 1,
            stock_ids: 1,
            date: 1,
            shift_id: 1,
            name: 1,
            location: 1,
            suburbs: 1,
            stock: "$products",
            total_products: 1,
            low_stock: { $cond: [{ $lte: ['$total_products', 20] }, true, false] },
        }
    }
    ])
    let drivers = await Stock.aggregate(query)
    return drivers
}

//admin dashboard login
exports.dashboard = async (req, res) => {
    let { coming_shift, coming_shift_name, coming_shift_date, next_shift_date, next_shift, next_shift_name } = await getComingShift();
    let drivers = await this.getUpcomingScheduleDrivers(coming_shift)
    // return res.json(drivers)
    let suburbs = await Suburb.aggregate([
        {
            $match: {
                delete_status: false
            }
        }
    ])

    let current_orders = await Booking.aggregate([
        {
            $match: {
                scheduled_date: new Date(moment(coming_shift_date).format('YYYY-MM-DD')),
                shift_id: ObjectId(coming_shift),
                delete_status: false
            }
        },
        {
            $count: "count"
        }
    ])

    let scheduled_orders = await Booking.aggregate([
        {
            $match: {
                scheduled_date: new Date(moment(coming_shift_date).format('YYYY-MM-DD')),
                shift_id: ObjectId(coming_shift),
                delete_status: false,
                booking_type: "SCHEDULED"
            }
        }, {
            $count: "count"
        }
    ])

    let next_orders = await Booking.aggregate([
        {
            $match: {
                scheduled_date: new Date(moment(next_shift_date).format('YYYY-MM-DD')),
                shift_id: ObjectId(next_shift),
                delete_status: false
            }
        },
        {
            $count: "count"
        }
    ])

    let next_scheduled_orders = await Booking.aggregate([
        {
            $match: {
                scheduled_date: new Date(moment(next_shift_date).format('YYYY-MM-DD')),
                shift_id: ObjectId(next_shift),
                delete_status: false,
                booking_type: "SCHEDULED"
            }
        }, {
            $count: "count"
        }
    ])

    let current_order = current_orders[0] ? current_orders[0].count : 0
    let current_scheduled_order = scheduled_orders[0] ? scheduled_orders[0].count : 0
    let next_order = next_orders[0] ? next_orders[0].count : 0
    let next_scheduled_order = next_scheduled_orders[0] ? next_scheduled_orders[0].count : 0

    return res.render('admin/dashboard', {
        drivers,
        suburbs,
        coming_shift,
        coming_shift_name,
        next_shift,
        next_shift_name,
        current_order,
        current_scheduled_order,
        next_order,
        next_scheduled_order,
        coming_shift_date: moment(coming_shift_date).format('YYYY-MM-DD'),
        next_shift_date: moment(next_shift_date).format('YYYY-MM-DD')
    })
}

exports.getvanlocations = async (req, res) => {
    let { selected_driver, selected_suburb } = req.query
    let { shifts, coming_shift } = await getComingShift();
    let drivers = await this.getUpcomingScheduleDrivers(coming_shift, selected_driver, selected_suburb)
    return res.json({
        status: true,
        drivers
    })
}

exports.getCollectionPoints = async (req, res) => {
    let { coming_shift } = await getComingShift()

    collectionpoints = await CP.aggregate([{
        $match: {
            delete_status: false,
            approved: true
        }
    }, {
        $lookup: {
            from: "addresses",
            let: { cp_id: "$_id" },
            pipeline: [{
                $match: {
                    $expr: {
                        $and: [
                            { $eq: ["$collectionpoint_id", "$$cp_id"] },
                            { $eq: ["$type", "COLLECTION_POINT"] },
                            { $eq: ["$delete_status", false] },
                            // { $eq: ["$suburb_id", ObjectId(stock.suburb_id)] }
                        ]
                    }
                }
            },],
            as: "addresses"
        }
    },
    {
        $lookup: {
            from: "addresses",
            let: { cp_id: "$_id" },
            pipeline: [{
                $match: {
                    $expr: {
                        $and: [
                            { $eq: ["$collectionpoint_id", "$$cp_id"] },
                            { $eq: ["$type", "COLLECTION_POINT"] },
                            { $eq: ["$delete_status", false] }
                        ]
                    }
                }
            },],
            as: "addresses"
        }
    },
    {
        $lookup: {
            from: "cp_stocks",
            let: {
                cp_id: "$_id",
                shift_id: ObjectId(coming_shift)
            },
            pipeline: [
                {
                    $match:{
                        $expr: {
                            $and: [
                                {
                                    $eq: ['$collectionpoint_id', "$$cp_id"],
                                },
                                {
                                    $eq: ['$shift_id', "$$shift_id"],
                                },
                                {
                                    $eq: ['$date', new Date(moment().format('YYYY-MM-DD'))]
                                }
                            ]
                        }
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $lookup:{
                        from : "products",
                        let:{
                            product_id : "$products.product_id"
                        },
                        pipeline:[
                            {
                                $match:{
                                    $expr:{
                                        $and:[
                                            {$eq:['$$product_id','$_id']}
                                        ]
                                    }
                                }
                            }
                        ],
                        as:"product"
                    }
                },
                {
                    $addFields:{
                        product:{
                            $arrayElemAt:['$product',0]
                        }
                    }
                },
                {
                    $project:{
                        _id : "$product._id",
                        name: "$product.name",
                        stock: "$products.stock",
                        type: "$product.type"
                    }
                }
            ],
            as:"stock"
        }
    },
    {
        $project: {
            _id: 1,
            name: 1,
            image: 1,
            email: 1,
            mobile: 1,
            address: {
                address_line1: {
                    $arrayElemAt: ["$addresses.address_line1", 0]
                },
                address_line2: {
                    $arrayElemAt: ["$addresses.address_line2", 0]
                },
                location: {
                    $arrayElemAt: ["$addresses.location", 0]
                },
            },
            location: {
                $arrayElemAt: ["$addresses.location", 0]
            },
            stock:1
        }
    }
    ])
    return res.json({
        status: true,
        collectionpoints
    })
}

exports.driverExport = async (req, res) => {
    const { shift, date } = req.query
    let shift_date = new Date(moment(date).format('YYYY-MM-DD 00:00:000'))

    let stocks = await Stock.aggregate([{
        $match: {
            delete_status: false,
            $expr: {
                $and: [
                    { $gt: ['$date', shift_date] },
                    { $eq: ['$shift_id', ObjectId(shift)] },
                ]
            }
        }
    },
    {
        $lookup: {
            from: "settings",
            let: {
                date: {
                    $dateToString: { format: "%Y-%m-%d", date: "$date" }
                },
                shift_id: "$shift_id"
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
                                    $eq: ["$shift_times._id", "$$shift_id"]
                                }
                            ]
                        }
                    }
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
            from: "drivers",
            let: { driver_id: "$driver_id" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [{ $eq: ["$_id", "$$driver_id"] }],
                        }
                    },
                },
                {
                    $project: {
                        _id: "$_id",
                        name: "$name",
                        mobile: "$mobile",
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
                $arrayElemAt: ["$driver", 0]
            }
        }
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
                        }
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
                $arrayElemAt: ["$suburb", 0]
            }
        }
    },
    {
        $unwind: "$initial_stock"
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
                        }
                    },
                },
                {
                    $project: {
                        _id: "$_id",
                        name: "$name",
                        type: "$type"
                    },
                },
            ],
            as: "product",
        },
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
            suburb: 1,
            driver: 1,
            shift: 1,
            products: 1,
            initial_stock: {
                _id: "$initial_stock._id",
                product_id: "$initial_stock.product_id",
                stock: "$initial_stock.stock",
                box_id: "$initial_stock.box_id",
                product_name: "$product.name"
            },
            type: 1,
            date: 1
        }
    },
    {
        $group: {
            _id: "$_id",
            suburb: {
                $first: "$suburb"
            },
            driver: {
                $first: "$driver"
            },
            shift: {
                $first: "$shift"
            },
            type: {
                $first: "$type"
            },
            date: {
                $first: "$date"
            },
            final_stock: {
                $first: "$products"
            },
            products: {
                $addToSet: "$initial_stock"
            }
        }
    }, {
        $unwind: "$final_stock"
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
                        }
                    },
                },
                {
                    $project: {
                        _id: "$_id",
                        name: "$name",
                        type: "$type"
                    },
                },
            ],
            as: "product",
        },
    },
    {
        $addFields: {
            product: {
                $arrayElemAt: ["$product", 0]
            }
        }
    }, {
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
                product_name: "$product.name"
            }
        }
    }, {
        $group: {
            _id: "$_id",
            suburb: {
                $first: "$suburb"
            },
            driver: {
                $first: "$driver"
            },
            shift: {
                $first: "$shift"
            },
            type: {
                $first: "$type"
            },
            date: {
                $first: "$date"
            },
            final_stocks: {
                $addToSet: "$final_stock"
            },
            products: {
                $first: "$products"
            }
        }
    }, {
        $sort: {
            _id: -1
        }
    }
    ]);

    stocks = _.chain(stocks)
        .groupBy("suburb.name")
        .map((value, key) => ({ suburb: key, data: value }))
        .value()

    if (stocks.length > 0) {
        const workbooks = new Excel.Workbook();
        let worksheet = []
        stocks.forEach((stock, i) => {
            let { suburb, data } = stock
            worksheet[i] = workbooks.addWorksheet(`${suburb}`, {
                properties: { tabColor: { argb: "FFC0000" } },
            })
            worksheet[i].columns = [
                { header: "Suburb", key: "suburb_name", width: 20 },
                { header: "Driver", key: "driver_name", width: 20 },
                { header: "Mobile", key: "driver_mobile", width: 20 },
                { header: "Initial Stock", key: "products_string", width: 60 },
                { header: "Current Stock", key: "final_stocks_string", width: 60 },
            ]
            data.forEach(rec => {
                let { suburb, driver, shift, type, final_stocks, products } = rec
                let suburb_name = suburb ? suburb.name : ""
                let driver_name = driver ? driver.name : ""
                let driver_mobile = driver ? driver.mobile : ""
                let final_stocks_string = ""
                final_stocks.forEach(stock => {
                    let { product_name, stock: quantity } = stock
                    final_stocks_string += `${product_name}-${quantity},`
                })
                let products_string = ""
                products.forEach(stock => {
                    let { product_name, stock: quantity } = stock
                    products_string += `${product_name}-${quantity},`
                })
                worksheet[i].addRow([
                    suburb_name,
                    driver_name,
                    driver_mobile,
                    products_string,
                    final_stocks_string
                ])
            })
        })
        await workbooks.xlsx
            .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
            .then(() => {
                return res.redirect(
                    res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
                );
            })
            .catch((err) => {
                return res.redirect(res.locals.app_url + `/dashboard`);
            });
    } else {
        return res.redirect(res.locals.app_url + `/dashboard`);
    }
}

exports.orderExport = async (req, res) => {
    const { shift, date } = req.query

    let orders = await Order.aggregate([
        {
            $match: {
                $expr: {
                    $and: [
                        { $eq: ["$delete_status", false] },
                        // { $eq: ["$redeemed", true] },
                        { $eq: ["$shift_id", ObjectId(shift)] },
                        {
                            $and: [
                                {
                                    $gte: ["$scheduled_date", new Date(moment().format("YYYY-MM-DD"))],
                                },
                                {
                                    $lte: [
                                        "$scheduled_date",
                                        new Date(moment().format("YYYY-MM-DD 23:59")),
                                    ],
                                },
                            ],
                        }
                    ]
                }
            }
        },
        {
            $lookup: {
                from: 'addresses',
                let: {
                    address_id: "$address_id"
                },
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
            $match: {
                suburb: {
                    $exists: true
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
                suburb: 1,
                scheduled_date: 1,
                booking_id: 1,
                booking_type: 1,
                product: {
                    _id: "$product._id",
                    name: "$product.name",
                    quantity: "$orders.quantity"
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
                suburb: {
                    $first: "$suburb"
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

    orders = _.chain(orders)
        .groupBy("suburb.name")
        .map((value, key) => ({ suburb: key, data: value }))
        .value()

    if (orders.length > 0) {
        const workbooks = new Excel.Workbook();
        let worksheet = []
        orders.forEach((order, i) => {
            let { suburb, data } = order
            worksheet[i] = workbooks.addWorksheet(`${suburb}`, {
                properties: { tabColor: { argb: "FFC0000" } },
            })
            worksheet[i].columns = [
                { header: "Suburb", key: "suburb_name", width: 20 },
                { header: "Booking ID", key: "booking_id", width: 20 },
                { header: "User", key: "user_name", width: 20 },
                { header: "Mobile", key: "user_mobile", width: 20 },
                { header: "Booking Type", key: "booking_type", width: 30 },
                { header: "Date", key: "scheduled_date", width: 30 },
                { header: "Orders", key: "orders", width: 60 }
            ]
            data.forEach(rec => {
                let { suburb, user, booking_id, booking_type, scheduled_date, orders } = rec
                let suburb_name = suburb ? suburb.name : ""
                let user_name = user ? user.name : ""
                let user_mobile = user ? user.mobile : ""
                let orders_string = ""
                orders.forEach(stock => {
                    let { name, quantity } = stock
                    orders_string += `${name}-${quantity},`
                })
                scheduled_date = moment(scheduled_date).format('YYYY-MM-DD')
                worksheet[i].addRow([
                    suburb_name,
                    booking_id,
                    user_name,
                    user_mobile,
                    booking_type,
                    scheduled_date,
                    orders_string
                ])
            })
        })
        await workbooks.xlsx
            .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
            .then(() => {
                return res.redirect(
                    res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
                );
            })
            .catch((err) => {
                return res.redirect(res.locals.app_url + `/dashboard`);
            });
    } else {
        return res.redirect(res.locals.app_url + `/dashboard`);
    }
}