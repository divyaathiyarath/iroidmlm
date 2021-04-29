const mongoose = require("mongoose")
const paginate = require("express-paginate")
let ObjectId = mongoose.Types.ObjectId;
const Order = mongoose.model("bookings")
const moment = require('moment')
const Bookingslot = mongoose.model("booking_slots")
const Address = mongoose.model("addresses")
const Stock = mongoose.model("stocks")
const Company = mongoose.model("companies")

const getOrderList = (data) => {
    return new Promise((resolve, reject) => {
        try {
            let { } = data

            let query = [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$delete_status", false] },
                                { $in: ["$booking_type", ['REALTIME', 'SCHEDULED']] },
                                { $gte: ["$created_at", from_date] },
                                { $lte: ["$created_at", to_date] },
                            ]
                        }
                    }
                },
                {
                    $lookup: {
                        from: "addresses",
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
                                                        { $eq: ["$$suburb_id", "$_id"] }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            $project: {
                                                _id: "$_id",
                                                name: "$name",
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
                            }
                        ],
                        as: 'address'
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
                        from: "collectionpoints",
                        let: {
                            cp_id: "$collectionpoint_id"
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$$cp_id", "$_id"] }
                                        ]
                                    }
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
                                                                    { $eq: ["$$suburb_id", "$_id"] }
                                                                ]
                                                            }
                                                        }
                                                    },
                                                    {
                                                        $project: {
                                                            _id: "$_id",
                                                            name: "$name",
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
                                        }
                                    ],
                                    as: 'address'
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
                                $project: {
                                    name: 1,
                                    email: 1,
                                    mobile: 1,
                                    address: 1
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
                        let: {
                            user_id: "$user_id"
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$_id", "$$user_id"] },
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: "$_id",
                                    name: "$name",
                                    email: "$email",
                                    mobile: "$mobile"
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
            ]
        } catch (err) {

        }
    })
}

exports.list = async (req, res) => {
    let { search, page, limit, status, company } = req.query
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

    if (typeof limit == 'undefined') {
        limit = 20
    }
    if (typeof page == 'undefined') {
        page = 1
    }

    let skip = 0
    if (page > 1) {
        skip = (page - 1) * limit
    }

    let query = [
        {
            $match: {
                $expr: {
                    $and: [
                        { $eq: ["$delete_status", false] },
                        { $in: ["$booking_type", ['REALTIME', 'SCHEDULED']] },
                        { $gte: ["$created_at", from_date] },
                        { $lte: ["$created_at", to_date] },
                    ]
                }
            }
        },
        {
            $lookup: {
                from: "addresses",
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
                                                { $eq: ["$$suburb_id", "$_id"] }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id: "$_id",
                                        name: "$name",
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
                    }
                ],
                as: 'address'
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
                from: "collectionpoints",
                let: {
                    cp_id: "$collectionpoint_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$$cp_id", "$_id"] }
                                ]
                            }
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
                                                            { $eq: ["$$suburb_id", "$_id"] }
                                                        ]
                                                    }
                                                }
                                            },
                                            {
                                                $project: {
                                                    _id: "$_id",
                                                    name: "$name",
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
                                }
                            ],
                            as: 'address'
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
                        $project: {
                            name: 1,
                            email: 1,
                            mobile: 1,
                            address: 1
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
                let: {
                    user_id: "$user_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$user_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: "$_id",
                            name: "$name",
                            email: "$email",
                            mobile: "$mobile"
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
    ]

    if (search) {
        let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
        query.push({
            $match: {
                $or: [
                    {
                        'user.name': regex
                    }, {
                        'user.mobile': regex,

                    }, { 'user.email': regex },
                    { 'address.suburb.name': regex }
                ]
            }
        })
    }

    if(company){
        query.push({
            $match: {
                company_id: ObjectId(company)
            }
        })
    }

    if (status === "0" || status == "1") {
        let redeemed = false
        if (status === "1") {
            redeemed = true
        }
        query.push({
            $match: {
                $and: [
                    {
                        'redeemed': redeemed
                    }
                ]
            }
        })
    }

    query.push({
        $lookup: {
            from: "settings",
            let: {
                shift_id: "$shift_id"
            },
            pipeline: [
                {
                    $unwind: "$shift_times"
                },
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$$shift_id", "$shift_times._id"] },
                            ]
                        }
                    }
                },
                {
                    $project: {
                        _id: "$shift_times._id",
                        name: "$shift_times.name",
                        duration: "$shift_times.duration",
                        time: "$shift_times.time"
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
            $sort: {
                created_at: -1
            }
        })

    let orders = await Order.aggregate([...query, {
        $skip: skip
    }, {
        $limit: limit
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
                                { $eq: ["$_id", "$$product_id"] },
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
            from: "companies",
            let: {
                company_id: "$company_id"
            },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$_id", "$$company_id"] },
                            ]
                        }
                    }
                }
            ],
            as: "company"
        }
    },
    {
        $addFields: {
            company: {
                $arrayElemAt: ["$company", 0]
            }
        }
    },
    {
        $project: {
            _id: 1,
            booking_type: 1,
            redeemed: 1,
            booking_id: 1,
            user: 1,
            shift: 1,
            created_at: 1,
            scheduled_date: 1,
            product: {
                product_id: "$product._id",
                name: "$product.name",
                quantity: "$orders.quantity",
                price: "$orders.price"
            },
            address: 1,
            driver_id: 1,
            address_id: 1,
            shift_id: 1,
            delivered_time: 1,
            driver: 1,
            collectionpoint: 1,
            delivery_type: 1,
            company_id : 1,
            company : 1,
            break_time: 1
        }
    },
    {
        $group: {
            _id: "$_id",
            delivery_type: {
                $first: "$delivery_type"
            },
            booking_type: {
                $first: "$booking_type"
            },
            type: {
                $first: "$type"
            },
            collectionpoint: {
                $first: "$collectionpoint"
            },
            redeemed: {
                $first: "$redeemed"
            },
            booking_id: {
                $first: "$booking_id"
            },
            created_at: {
                $first: "$created_at"
            },
            scheduled_date: {
                $first: "$scheduled_date"
            },
            user: {
                $first: "$user"
            },
            shift: {
                $first: "$shift"
            },
            orders: {
                $addToSet: "$product"
            },
            address: {
                $first: "$address"
            },
            driver_id: {
                $first: "$driver_id"
            },
            address_id: {
                $first: "$address_id"
            },
            shift_id: {
                $first: "$shift_id"
            },
            driver: {
                $first: "$driver"
            },
            delivered_time: {
                $first: "$delivered_time"
            },
            company_id:{
                $first: "$company_id"
            },
            company:{
                $first: "$company"
            },
            break_time: {
                $first: "$break_time"
            }
        }
    },
    {
        $sort: {
            created_at: -1
        }
    }])

    let itemCount = await Order.aggregate([...query, {
        $count: "count"
    }])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }
    const pageCount = Math.ceil(itemCount / limit);
    // return res.json({orders})

    let companies = await Company.find({ delete_status: false })

    // return res.json(orders);

    res.render("admin/orders/list", {
        orders,
        from_date: moment(from_date).format('YYYY-MM-DD'),
        to_date: moment(to_date).format('YYYY-MM-DD'),
        search,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
        status,
        companies,
        company
    })
}

exports.getOrder = async (req, res) => {
    let { order_id } = req.query
    let orders = await Order.aggregate(
        [
            {
                $match: {
                    booking_type: "BULK",
                    _id: ObjectId(order_id)
                },
            },
            {
                $lookup:
                {
                    from: "users",
                    let: { user_id: "$user_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$_id", "$$user_id"] },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                            },
                        },
                    ],
                    as: "users",
                },
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
                                        // { $eq: ["$is_regular", true] },
                                    ],
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                cover_pic: 1,
                                type: 1,
                                image: 1,
                                quantity: "$orders.quantity",
                                approve_status: 1
                            },
                        },
                    ],
                    as: "products"
                }
            }
        ]
    )
    let order = null
    if (orders.length > 0) {
        order = orders[0]
    }
    if (order) {
        return res.json({
            status: true,
            order
        })
    } else {
        return res.json({
            status: false,
            message: "Order not found"
        })
    }
}

exports.rejectOrder = async (req, res) => {
    let { order_id, admin_review } = req.body
    let order = await Order.findOne({ _id: ObjectId(order_id) })
    if (order) {
        try {
            order.bulkorder_status = "REJECTED"
            order.bulkorder_review = admin_review
            await order.save()
            return res.json({
                status: true,
                message: "Order rejected successfully"
            })
        } catch (err) {
            console.log(err)
            return res.json({
                status: false,
                message: "Some thing went wrong"
            })
        }
    } else {
        return res.json({
            status: false,
            message: "Could not find order",
            order_id
        })
    }
}

exports.approvedOrder = async (req, res) => {
    let { order_id, price } = req.body
    let order = await Order.findOne({ _id: ObjectId(order_id) })
    if (order) {
        try {
            order.bulkorder_status = "APPROVED"
            order.price = price
            await order.save()
            return res.json({
                status: true,
                message: "Order approved successfully"
            })
        } catch (err) {
            console.log(err)
            return res.json({
                status: false,
                message: "Some thing went wrong"
            })
        }
    } else {
        return res.json({
            status: false,
            message: "Could not find order",
            order_id
        })
    }
}

exports.markdelivered = async (req, res) => {
    let { id, redeemed, driver_id } = req.body

    try {

        let booking = await Order.findOne({
            _id: id,
            redeemed: false,
        }).populate("address_id");
        let { scheduled_date } = booking

        await Order.updateOne({
            _id: id
        }, {
            $set: {
                redeemed: true,
                delivered_by: driver_id ? driver_id : null,
                delivered_time: Date.now()
            }
        })


        if (!driver_id) {
            return res.json({
                status: true,
                message: "Order has been marked delivered"
            })
        }

        let driver_stock = await Stock.findOne({
            suburb_id: booking.address_id.suburb_id,
            driver_id,
            shift_id: booking.shift_id,
            type: "DELIVERY",
            date: new Date(scheduled_date)
        });

        if (driver_stock) {
            for (var i = 0; i < booking.orders.length; i++) {
                await Stock.updateOne(
                    {
                        _id: driver_stock._id,
                        products: {
                            $elemMatch: {
                                product_id: ObjectId(booking.orders[i].product_id),
                            },
                        },
                    },
                    {
                        $inc: {
                            "products.$.stock": -booking.orders[i].quantity,
                        },
                    }
                );
            }
        }

        await Bookingslot.deleteOne({
            booking_id: ObjectId(id)
        })
        return res.json({
            status: true,
            message: "Order has been marked delivered"
        })
    } catch (error) {
        console.log(error)
        return res.json({
            status: false,
            message: "something went wrong"
        })
    }


}

exports.markUndelivered = async (req, res) => {
    let { id, redeemed, driver_id, address_id, shift_id } = req.body
    await Order.updateOne({
        _id: id
    }, {
        $set: {
            redeemed: false
        }
    })

    if (!driver_id) {
        return res.json({
            status: true,
            message: "Order marked undelivered"
        })
    }
    const address = await Address.findOne({ _id: address_id }, { location: 1, _id: 0 })
    let bookingslot = new Bookingslot()
    bookingslot.location = address.location,
        bookingslot.address_id = address_id,
        bookingslot.shift_id = shift_id,
        bookingslot.driver_id = driver_id,
        bookingslot.booking_id = id,
        bookingslot.date = new Date(moment().format('YYYY-MM-DD')),
        bookingslot.distance = 1500,
        bookingslot.order = 1
    await bookingslot.save()
    try {
        let booking = await Order.findOne({
            _id: id,
            redeemed: false,
        }).populate("address_id");
        console.log(booking)
        let driver_stock = await Stock.findOne({
            suburb_id: booking.address_id.suburb_id,
            driver_id,
            shift_id: booking.shift_id,
            type: "DELIVERY",
        });
        console.log(driver_stock)
        if (driver_stock) {
            for (var i = 0; i < booking.orders.length; i++) {
                await Stock.updateOne(
                    {
                        _id: driver_stock._id,
                        products: {
                            $elemMatch: {
                                product_id: ObjectId(booking.orders[i].product_id),
                            },
                        },
                    },
                    {
                        $inc: {
                            "products.$.stock": booking.orders[i].quantity,
                        },
                    }
                );
            }
        }
    } catch (error) {
        console.log(error)
        return res.json({
            status: false,
            message: "something went wrong"
        })
    }
    return res.json({
        status: true,
        message: "Order marked undelivered"
    })
}