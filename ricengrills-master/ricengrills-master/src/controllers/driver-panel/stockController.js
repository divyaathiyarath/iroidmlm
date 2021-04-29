const mongoose = require("mongoose");
const { get } = require("../../routes/driver-panel");
const Stock = mongoose.model("stocks")
const CPStock = mongoose.model("cp_stocks")
const Setting = mongoose.model("settings")
const Product = mongoose.model("products")
const StockRequest = mongoose.model("stock_requests")
let ObjectId = mongoose.Types.ObjectId;
let moment = require('moment')
let { getComingShift } = require('./dashboardController');
const stock_transfers = require("../../models/stock_transfers");
const StockTransfer = mongoose.model("stock_transfers")
const _ = require('underscore');
const { collectionpoint } = require("../admin/transferController");
const DriverNotification = mongoose.model("driver_notifications")
const Driver = mongoose.model('drivers')


const SendNotificaiton = require('../../jobs/driver_notification')


exports.toCollection = function (obj) {
    return Object.keys(obj)
        .sort(function (x, y) {
            return +x - +y;
        })
        .map(function (k) {
            return {
                product_id: k,
                stock: obj[k].stock,
                box_id: obj[k].box_id,
                _id: obj[k]._id,
            };
        });
};

exports.getGroupedArrayMinus = async (data) => {
    let result = data.reduce(function (acc, x) {
        var id = acc[x.product_id];
        // console.log({acc,x,id})
        if (id) {
            id.stock = +id.stock - +x.stock;
        } else {
            acc[x.product_id] = x;
            delete x._id;
        }
        return acc;
    }, {});
    console.log(result)
    return this.toCollection(result);
};

exports.getGroupedArrayAdd = async (data) => {
    let result = data.reduce(function (acc, x) {
        var id = acc[x.product_id];
        // console.log({acc,x,id})
        if (id) {
            id.stock = +id.stock + +x.stock;
        } else {
            acc[x.product_id] = x;
            delete x._id;
        }
        return acc;
    }, {});
    console.log(result)
    return this.toCollection(result);
};

let getSuburbId = async (driver, shift) => {
    let stocks = await Stock.find({
        driver_id: ObjectId(driver),
        shift_id: ObjectId(shift),
        date: new Date(moment().format("YYYY-MM-DD"))
    })
    let stock_ids = []
    if (stocks.length > 0) {
        stocks.forEach(stock => {
            stock_ids.push(stock.suburb_id)
        })
    }
    return stock_ids
}

exports.activeStocks = async (req, res) => {
    let { current_shift } = await getComingShift()
    let active_shift = ""
    if (current_shift) {
        shifts = await Setting.aggregate([
            {
                $unwind: "$shift_times"
            },
            {
                $project: {
                    _id: "$shift_times._id",
                    name: "$shift_times.name",
                    duration: "$shift_times.duration",
                    time: "$shift_times.time"
                }
            },
            {
                $match: {
                    _id: ObjectId(current_shift)
                }
            }
        ])
        if (shifts.length > 0) {
            active_shift = shifts[0].name
        }
    }
    res.render("driver-panel/stocks/list", {
        current_shift,
        shift: active_shift
    })
}

exports.stockRequest = async (req, res) => {
    let { current_shift } = await getComingShift()
    let active_shift = ""
    if (current_shift) {
        shifts = await Setting.aggregate([
            {
                $unwind: "$shift_times"
            },
            {
                $project: {
                    _id: "$shift_times._id",
                    name: "$shift_times.name",
                    duration: "$shift_times.duration",
                    time: "$shift_times.time"
                }
            },
            {
                $match: {
                    _id: ObjectId(current_shift)
                }
            }
        ])
        if (shifts.length > 0) {
            active_shift = shifts[0].name
        }
    }
    res.render("driver-panel/stocks/new", {
        current_shift,
        shift: active_shift
    })
}

exports.saveRequest = async (req, res) => {
    try {
        let { shifts, current_shift } = await this.getComingShift();
        let { products } = req.body

        if (products.length <= 0) {
            return res.json({
                status: false,
                message: "Products are required"
            })
        }

        let requests = []
        for (var i = 0; i < products.length; i++) {
            let details = {
                product_id: products[i],
                quantity: quantities[i]
            }
            requests.push(details)
        }

        let food_request = new StockRequest({
            driver_id: req.session._id,
            date: new Date(moment().format('YYYY-MM-DD')),
            shift_id: ObjectId(current_shift),
            requests: requests,
            approve_status: true
        })
        await food_request.save()
        return res.json({
            status: true,
            message: "Food request submitted. Waiting for admin approval"
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Sorry something went wrong"
        })
    }
}


exports.myRequests = async (req, res) => {
    let { shifts, current_shift } = await getComingShift();
    let stock_requests = await StockRequest.aggregate([
        {
            $match: {
                approve_status: false,
                driver_id: ObjectId(req.session._id)
            }
        }
    ])
    return res.json({
        stock_requests
    })
    return res.render('driver-panel/stockrequests/myrequests')
}

exports.toCps = async (req, res) => {
    return res.render('driver-panel/stockrequests/cps')
}

exports.toDrivers = async (req, res) => {
    return res.render("driver-panel/stockrequests/drivers")
}

exports.toDriversRequest = async (req, res) => {
    let { req_id } = req.params
    let { current_shift: shift_id } = await getComingShift()
    let active_shift = ""
    if (shift_id) {
        shifts = await Setting.aggregate([
            {
                $unwind: "$shift_times"
            },
            {
                $project: {
                    _id: "$shift_times._id",
                    name: "$shift_times.name",
                    duration: "$shift_times.duration",
                    time: "$shift_times.time"
                }
            },
            {
                $match: {
                    _id: ObjectId(shift_id)
                }
            }
        ])
        if (shifts.length > 0) {
            active_shift = shifts[0].name
        }
    } else {
        return res.redirect(res.locals.app_url + '/to_drivers')
    }

    let request = await StockTransfer.aggregate([
        {
            $match: {
                _id: ObjectId(req_id)
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
            $project: {
                _id: 1,
                suburb_id: 1,
                driver: {
                    _id: 1,
                    name: 1,
                    location: 1,
                    email: 1,
                    mobile: 1
                },
                product: {
                    _id: "$product._id",
                    name: "$product.name",
                    stock: "$products.stock",
                    image: "$product.image"
                },
                shift: 1,
                created_at: 1,
                approve_status: 1,
                type: 1
            }
        },
        {
            $group: {
                _id: "$_id",
                suburb_id: {
                    $first: "$suburb_id"
                },
                driver: {
                    $first: "$driver"
                },
                shift: {
                    $first: "$shift"
                },
                created_at: {
                    $first: "$created_at"
                },
                approve_status: {
                    $first: "$approve_status"
                },
                type: {
                    $first: "$type"
                },
                products: {
                    $addToSet: "$product"
                }
            }
        }
    ])
    let suburb_id = null
    if (request.length > 0) {
        request = request[0]
        suburb_id = request.suburb_id
    } else {
        return res.redirect(res.locals.app_url + '/to_drivers')
    }
    // return res.json(request)
    return res.render("driver-panel/stockrequests/driver-delivery", { request, shift_id, suburb_id })
}


exports.getDriverRequests = async (req, res) => {
    let { current_shift, shifts } = await getComingShift()
    if (!current_shift) {
        return res.json({
            status: false,
            requests: []
        })
    }

    let offset = Math.abs(new Date().getTimezoneOffset());
    let cur_date = moment()
        .utcOffset(+offset)
        .format("YYYY-MM-DD HH:mm");

    let requests = await StockTransfer.aggregate([
        {
            $lookup: {
                from: "settings",
                let: {
                    today: moment().format("YYYY-MM-DD"),
                    created_at: "$date",
                    current_time: cur_date
                },
                pipeline: [
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
                            start: { $toDate: { $concat: ["$$today", " ", "$time"] } },
                            end: { $toDate: { $concat: ["$$today", " ", "$time"] } },
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
                                    { $gte: ["$_id", ObjectId(current_shift)] },
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            expired: {
                                $cond: {
                                    if: {
                                        $and: [
                                            {
                                                $gte: ["$end", "$$current_time"]
                                            },
                                            {
                                                $eq: ["$created_at", new Date(moment().format("YYYY-MM-DD"))]
                                            }
                                        ]
                                    }, then: false, else: true
                                }
                            }
                        }
                    },
                    {
                        $sort: {
                            start: 1,
                        }
                    },
                    {
                        $limit: 1
                    }
                ],
                as: "shift"
            }
        },
        {
            $addFields: {
                current_shift_id: {
                    $arrayElemAt: ["$shift._id", 0]
                },
                expired: {
                    $arrayElemAt: ["$shift.expired", 0]
                }
            }
        },
        {
            $match: {
                type: "REFILLING",
                driver_id: {
                    $ne: null
                },
                current_shift_id: {
                    $ne: null
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
                                $eq: ["$_id", "$$driver_id"]
                            }
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
            $project: {
                _id: 1,
                driver: {
                    _id: 1,
                    name: 1,
                    location: 1,
                    email: 1,
                    mobile: 1
                },
                product: {
                    _id: "$product._id",
                    name: "$product.name",
                    stock: "$products.stock",
                    image: "$product.image"
                },
                shift: 1,
                created_at: 1,
                approve_status: 1,
                type: 1,
                expired: 1
            }
        },
        {
            $group: {
                _id: "$_id",
                driver: {
                    $first: "$driver"
                },
                shift: {
                    $first: "$shift"
                },
                created_at: {
                    $first: "$created_at"
                },
                approve_status: {
                    $first: "$approve_status"
                },
                type: {
                    $first: "$type"
                },
                expired: {
                    $first: "$expired"
                },
                products: {
                    $addToSet: "$product"
                }
            }
        },
        {
            $sort: {
                type: 1,
            }
        }
    ])
    return res.json({
        status: true,
        requests
    })
}

exports.getCPRequests = async (req, res) => {
    let { current_shift, shifts } = await getComingShift()
    if (!current_shift) {
        return res.json({
            status: false,
            requests: []
        })
    }
    let offset = Math.abs(new Date().getTimezoneOffset());
    let cur_date = moment()
        .utcOffset(+offset)
        .format("YYYY-MM-DD HH:mm");

    let stocks = await Stock.find({
        delete_status: false,
        driver_id: ObjectId(req.session._id),
        shift_id: ObjectId(current_shift),
        date: new Date(moment().format("YYYY-MM-DD")),
    });
    let suburb_ids = [];
    stocks.forEach((stock) => {
        suburb_ids.push(ObjectId(stock.suburb_id));
    });


    let requests = await StockTransfer.aggregate([
        {
            $lookup: {
                from: "settings",
                let: {
                    today: moment().format("YYYY-MM-DD"),
                    created_at: "$date",
                    current_time: cur_date
                },
                pipeline: [
                    {
                        $unwind: "$shift_times",
                    },
                    {
                        $project: {
                            _id: "$shift_times._id",
                            name: "$shift_times.name",
                            duration: "$shift_times.duration",
                            time: "$shift_times.time",
                            created_at: "$$created_at"
                        },
                    },
                    {
                        $addFields: {
                            start: { $toDate: { $concat: ["$$today", " ", "$time"] } },
                            end: { $toDate: { $concat: ["$$today", " ", "$time"] } },
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
                                    { $eq: ["$_id", ObjectId(current_shift)] }
                                ],
                            },
                        },
                    },
                    {
                        $addFields: {
                            expired: {
                                $cond: {
                                    if: {
                                        $and: [
                                            {
                                                $gte: ["$end", "$$current_time"]
                                            },
                                            {
                                                $eq: ["$created_at", new Date(moment().format("YYYY-MM-DD"))]
                                            }
                                        ]
                                    }, then: false, else: true
                                }
                            }
                        }
                    },
                    {
                        $sort: {
                            start: 1,
                        }
                    },
                    {
                        $limit: 1
                    }
                ],
                as: "shift"
            }
        },
        {
            $addFields: {
                current_shift_id: {
                    $arrayElemAt: ["$shift._id", 0]
                },
                expired: {
                    $arrayElemAt: ["$shift.expired", 0]
                }
            }
        },
        {
            $match: {
                type: "COLLECTIONPOINT",
                current_shift_id: {
                    $ne: null
                }
            }
        },
        {
            $lookup: {
                from: "collectionpoints",
                let: {
                    cp_id: "$collectionpoint_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$cp_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            contact_name: 1,
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
                from: "addresses",
                let: {
                    cp_id: "$collectionpoint._id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$collectionpoint_id", "$$cp_id"]
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
                                            $eq: ["$_id", "$$suburb_id"]
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
                    $arrayElemAt: ["$suburb.name", 0]
                },
                suburb_id: {
                    $arrayElemAt: ["$suburb._id", 0]
                }
            }
        },
        {
            $match: {
                $expr: {
                    $in: ['$suburb_id',suburb_ids]
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
                _id: 1,
                collectionpoint: 1,
                product: {
                    _id: "$product._id",
                    name: "$product.name",
                    stock: "$products.stock",
                    image: "$product.image"
                },
                shift: {
                    $arrayElemAt: ["$shift", 0]
                },
                created_at: 1,
                approve_status: 1,
                type: 1,
                expired: 1,
                suburb: 1
            }
        },
        {
            $group: {
                _id: "$_id",
                collectionpoint: {
                    $first: "$collectionpoint"
                },
                shift: {
                    $first: "$shift"
                },
                created_at: {
                    $first: "$created_at"
                },
                approve_status: {
                    $first: "$approve_status"
                },
                type: {
                    $first: "$type"
                },
                expired: {
                    $first: "$expired"
                },
                products: {
                    $addToSet: "$product"
                },
                suburb: {
                    $first: "$suburb"
                }
            }

        },
        {
            $sort: {
                approve_status: 1,
                _id: -1
            }
        }
    ])
    return res.json({
        status: true,
        requests
    })
}

exports.transferStockToDriver = async (req, res) => {
    try {
        let { stock, shift_id, req_id, suburb_id } = req.body

        let stock_transfer = await StockTransfer.findOne({ _id: ObjectId(req_id), approve_status: false })
        if (!stock_transfer) {
            throw new Error("Request not found")
        }

        let insert_products = [];
        if (stock) {
            _.map(stock, function (quantity, product_id) {
                if (quantity) {
                    insert_products.push({
                        product_id,
                        stock: quantity,
                    });
                }
            });
        } else {
            res.json({
                status: false,
                message: "No products selected"
            })
        }
        if (insert_products && insert_products.length > 0) {

            const sessions = await mongoose.startSession()
            const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }

            let stock = await Stock.findOne({
                suburb_id: ObjectId(suburb_id),
                driver_id: ObjectId(req.session._id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD')),
            })

            if (!stock) {
                return res.json({
                    status: false,
                    message: "No stock for this suburb",
                    suburb_id,
                    driver_id: req.session._id,
                    shift_id,
                    date: new Date(moment().format('YYYY-MM-DD')),
                })
            }
            let products = stock.products
            products = products.concat(insert_products);
            products = await this.getGroupedArrayMinus(products);

            let initial_stock = stock.initial_stock
            initial_stock = initial_stock.concat(insert_products);
            initial_stock = await this.getGroupedArrayMinus(initial_stock);

            sessions.startTransaction(transactionOptions);

            stock.products = products
            stock.initial_stock = initial_stock
            await stock.save()

            console.log(stock_transfer.driver_id)

            driver_stock = await Stock.findOne({
                suburb_id: ObjectId(suburb_id),
                driver_id: ObjectId(stock_transfer.driver_id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD')),
            })

            let driver_products = driver_stock.products
            driver_products = driver_products.concat(insert_products);
            driver_products = await this.getGroupedArrayAdd(driver_products);

            let driver_initial_stock = driver_stock.initial_stock
            driver_initial_stock = driver_initial_stock.concat(insert_products);
            driver_initial_stock = await this.getGroupedArrayAdd(driver_initial_stock);

            driver_stock.products = driver_products
            driver_stock.initial_stock = driver_initial_stock
            await driver_stock.save()

            let to_driver_details = await Driver.findOne({
                _id: stock_transfer.driver_id
            })
            title = "Products received",
                description = "Products has been received from refilling driver",
                token = to_driver_details.device_token
            await SendNotificaiton(title, description, 'high', token)

            let driver_notification = new DriverNotification({
                title: 'Products received',
                description: 'Products has been received from refilling driver',
                type: 'REFILLING',
                driver_id: stock_transfer.driver_id,
                stock_transfer_id: stock_transfer._id
            })
            await driver_notification.save()

            stock_transfer.approve_status = true
            await stock_transfer.save()

            sessions.commitTransaction();
            return res.json({
                status: true,
                message: "Stock updated"
            })
        } else {
            return res.json({
                status: false,
                message: "Stock update failed"
            })
        }
    } catch (err) {
        console.log(err)
        if (typeof sessions != 'undefined') {
            sessions.abortTransaction();
        }
        return res.json({
            status: false,
            message: "Stock update failed"
        })
    }
}

exports.toCPRequest = async (req, res) => {
    let { req_id } = req.params
    let { current_shift: shift_id } = await getComingShift()
    let active_shift = ""
    if (shift_id) {
        shifts = await Setting.aggregate([
            {
                $unwind: "$shift_times"
            },
            {
                $project: {
                    _id: "$shift_times._id",
                    name: "$shift_times.name",
                    duration: "$shift_times.duration",
                    time: "$shift_times.time"
                }
            },
            {
                $match: {
                    _id: ObjectId(shift_id)
                }
            }
        ])
        if (shifts.length > 0) {
            active_shift = shifts[0].name
        }
    } else {
        return res.redirect(res.locals.app_url + '/to_collectionpoints')
    }


    let request = await StockTransfer.aggregate([
        {
            $match: {
                _id: ObjectId(req_id)
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
                    },
                    {
                        $lookup: {
                            from: "addresses",
                            let: {
                                cp_id: "$_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$collectionpoint_id", "$$cp_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        address_line1: 1,
                                        address_line2: 1,
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
            $project: {
                _id: 1,
                collectionpoint: {
                    _id: 1,
                    name: 1,
                    contact_name: 1,
                    email: 1,
                    mobile: 1,
                    address: 1
                },
                product: {
                    _id: "$product._id",
                    name: "$product.name",
                    stock: "$products.stock",
                    image: "$product.image"
                },
                shift: 1,
                created_at: 1,
                approve_status: 1,
                type: 1
            }
        },
        {
            $group: {
                _id: "$_id",
                suburb_id: {
                    $first: "$suburb_id"
                },
                collectionpoint: {
                    $first: "$collectionpoint"
                },
                shift: {
                    $first: "$shift"
                },
                created_at: {
                    $first: "$created_at"
                },
                approve_status: {
                    $first: "$approve_status"
                },
                type: {
                    $first: "$type"
                },
                products: {
                    $addToSet: "$product"
                }
            }
        }
    ])

    let suburb_id = null
    if (request.length > 0) {
        request = request[0]
        let { collectionpoint: { address: { suburb_id: suburb } } } = request
        suburb_id = suburb
    } else {
        return res.redirect(res.locals.app_url + '/to_collectionpoints')
    }
    // return res.json(request)
    return res.render("driver-panel/stockrequests/cp-delivery", { request, shift_id, suburb_id })
}


exports.transferStockToCollectionPoint = async (req, res) => {
    try {
        let { stock, shift_id, req_id, cp_id, suburb_id } = req.body

        let stock_transfer = await StockTransfer.findOne({ _id: ObjectId(req_id), approve_status: false })
        if (!stock_transfer) {
            throw new Error("Request not found")
        }

        let insert_products = [];
        if (stock) {
            _.map(stock, function (quantity, product_id) {
                if (quantity && quantity > 0) {
                    insert_products.push({
                        product_id,
                        stock: quantity,
                    });
                }
            });
        } else {
            res.json({
                status: false,
                message: "No products selected"
            })
        }
        if (insert_products && insert_products.length > 0) {

            const sessions = await mongoose.startSession()
            const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }

            let stock = await Stock.findOne({
                suburb_id: ObjectId(suburb_id),
                driver_id: ObjectId(req.session._id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD')),
            })

            if (!stock) {
                return res.json({
                    status: false,
                    message: "No stock for this suburb",
                    suburb_id,
                    driver_id: req.session._id,
                    shift_id,
                    date: new Date(moment().format('YYYY-MM-DD')),
                })
            }
            let products = stock.products
            products = products.concat(insert_products);
            products = await this.getGroupedArrayMinus(products);

            cp_stock = await CPStock.findOne({
                collectionpoint_id: ObjectId(cp_id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD')),
            })

            if (!cp_stock) {
                return res.json({
                    status: false,
                    message: "No stock is assigned to this collection point, please assign stock first"
                })
            }


            sessions.startTransaction(transactionOptions);

            stock.products = products
            await stock.save()

            let cp_products = cp_stock.products
            cp_products = cp_products.concat(insert_products);
            cp_products = await this.getGroupedArrayAdd(cp_products);
            cp_stock.products = cp_products
            await cp_stock.save()

            stock_transfer.approve_status = true
            await stock_transfer.save()

            sessions.commitTransaction();
            return res.json({
                status: true,
                message: "Stock updated"
            })
        } else {
            sessions.abortTransaction();
            return res.json({
                status: false,
                message: "Stock update failed"
            })
        }
    } catch (err) {
        console.log(err)
        if (typeof sessions != 'undefined') {
            sessions.abortTransaction();
        }
        return res.json({
            status: false,
            message: "Stock update failed"
        })
    }
}