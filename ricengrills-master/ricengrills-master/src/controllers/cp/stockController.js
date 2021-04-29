const mongoose = require("mongoose");
const Setting = mongoose.model("settings")
const Product = mongoose.model("products")
const Cpstocks = mongoose.model("cp_stocks")
const Cpsales = mongoose.model("cp_sales")
const ExcessStock = mongoose.model("stock_requests_cp")
const paginate = require('express-paginate')
const config = require("config")
const _ = require("underscore")
let { getComingShift } = require('./dashboardController');
let ObjectId = mongoose.Types.ObjectId;
let moment = require('moment');
const { object } = require("underscore");

const { sendCpFoodRequest } = require("../../jobs/notification")

exports.list = async (req, res) => {
    let { current_shift: shift_id } = await getComingShift()
    // let shift_id = "5f578a2a6c3b9f18f893e081"
    let id = req.session._id
    console.log(shift_id)
    let stocks = await Cpstocks.aggregate([
        {
            $match: {
                collectionpoint_id: ObjectId(id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD'))
            }
        },
        {
            $lookup: {
                from: "products",
                let: { products: "$products" },
                pipeline: [{
                    $addFields: {
                        products: "$$products",
                    },
                },
                {
                    $unwind: "$products",
                },
                {
                    $match: {
                        $expr: {
                            $and: [{ $eq: ["$_id", "$products.product_id"] }],
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
                        price: 1,
                        stock: "$products.stock",
                    },
                },
                ],
                as: "products",
            },
        },
        {
            $unwind: "$products",
        },
        {
            $project: {
                _id: "$products._id",
                name: "$products.name",
                cover_pic: "$products.cover_pic",
                type: "$products.type",
                image: "$products.image",
                stock: "$products.stock",
                price: "$products.price",
                shift_id: 1,
                date: 1,
                collectionpoint_id: 1,
            }
        },
        {
            $lookup: {
                from: "bookings",
                let: {
                    collectionpoint_id: "$collectionpoint_id",
                    shift_id: "$shift_id",
                    date: "$date",
                    product_id: "$_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$delivery_type', "COLLECTIONPOINT"] },
                                    { $eq: ['$redeemed', false] },
                                    { $eq: ['$collectionpoint_id', "$$collectionpoint_id"] },
                                    { $eq: ['$shift_id', "$$shift_id"] },
                                    { $eq: ['$scheduled_date', "$$date"] }
                                ]
                            }
                        }
                    },
                    {
                        $unwind: "$orders"
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$$product_id', "$orders.product_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$orders.product_id",
                            count: {
                                $sum: "$orders.quantity"
                            }
                        }
                    }
                ],
                as: "scheduledstock"
            }
        },
        {
            $addFields: {
                scheduledstock: {
                    $ifNull: [{ $arrayElemAt: ["$scheduledstock.count", 0] }, 0]
                }
            }
        },
        {
            $addFields: {
                available_stock: {
                    $ifNull: [{
                        $subtract: [
                            '$stock',
                            '$scheduledstock'
                        ]
                    }, 0]
                }

            }
        },
        {
            $addFields: {
                available_stock: {
                    $cond: { if: { $gte: [ "$available_stock", 0 ] }, then: "$available_stock", else: 0 }
                }
            }
        }
    ])

    // return res.json(stocks)
    // console.log(stocks)
    let products = stocks
    let can_request_excess_stock = 0;
    if(stocks.length > 0){
        can_request_excess_stock = 1;
    }
    return res.render("cp/stocks/list", { products, shift_id, can_request_excess_stock });
}

exports.newstock = async (req, res) => {
    let setting = await Setting.findOne()
    let { shift_times: shifts } = setting
    let products = await Product.find({ type: 'FOOD', is_regular: true, delete_status: false })

    return res.render('cp/stocks/new', { shifts, products });
}

exports.savestock = async (req, res) => {
    let { products } = req.body;
    let { current_shift: shift_id } = await getComingShift()
    let collectionpoint_id = req.session._id;
    console.log(shift_id)

    stock = new ExcessStock()
    stock.collectionpoint_id = collectionpoint_id
    stock.shift_id = shift_id
    await stock.save()

    console.log({ products })
    if (products) {
        var insert_products = []
        _.map(products, function (quantity, product_id) {
            if(quantity){
                insert_products.push({
                    product_id,
                    quantity
                })
            }
        })
        if(insert_products.length <= 0){
            return res.json({
                status: false,
                message: "Please add quantity to the required products"
            })
        }
        stock.products = insert_products
        await stock.save()

        sendCpFoodRequest.add({
            collectionpoint_id: req.session._id
        })
        
    }
    return res.json({
        status: true,
        message: "Stock request sent to admin"
    })
}

exports.checkStock = async (req, res) => {
    let { shift_id, stock } = req.query
    let product_id = null
    let qty = null
    for (var key in stock) {
        if(stock[key]){
            product_id = key
            qty = stock[key]
        }        
    }

    if(!qty){
        return res.send("true")
    }

    console.log({qty,product_id})
    var stockdet = await Cpstocks.aggregate([
        {
            $match: {
                delete_status: false,
                shift_id: ObjectId(shift_id),
                collectionpoint_id: ObjectId(req.session._id),
                date: new Date(moment().format("YYYY-MM-DD"))
            }
        },
        {
            $unwind: "$products"
        },
        {
            $lookup: {
                from: "bookings",
                let: {
                    collectionpoint_id: "$collectionpoint_id",
                    shift_id: "$shift_id",
                    date: "$date",
                    product_id: "$products.product_id"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$delivery_type', "COLLECTIONPOINT"] },
                                    { $eq: ['$redeemed', false] },
                                    { $eq: ['$collectionpoint_id', "$$collectionpoint_id"] },
                                    { $eq: ['$shift_id', "$$shift_id"] },
                                    { $eq: ['$scheduled_date', "$$date"] }
                                ]
                            }
                        }
                    },
                    {
                        $unwind: "$orders"
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$$product_id', "$orders.product_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$orders.product_id",
                            count: {
                                $sum: "$orders.quantity"
                            }
                        }
                    }
                ],
                as: "scheduledstock"
            }
        },
        {
            $addFields: {
                scheduledstock: {
                    $arrayElemAt: ["$scheduledstock.count", 0]
                }
            }
        },
        {
            $addFields: {
                scheduledstock: {
                    $ifNull: ["$scheduledstock", 0]
                }
            }
        },
        {
            $addFields: {
                available_stock: {
                    $ifNull: [{
                        $subtract: [
                            '$products.stock',
                            '$scheduledstock'
                        ]
                    }, 0]
                }

            }
        },
        {
            $match: {
                "products.product_id": ObjectId(product_id),
                "available_stock": {
                    $gte: +qty
                }
            }
        }
    ])
    console.log(stockdet)
    // return res.json(stockdet)
    if (stockdet && stockdet.length > 0) {
        return res.send("true")
    }
    return res.send("false")
}

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

exports.updateStock = async (req, res) => {
    let { stock } = req.body
    let collectionpoint_id = req.session._id
    let date = Date.now()
    let { current_shift: shift_id } = await getComingShift()

    orders = []
    let totalprice = 0
    for (product_id in stock) {
        if (stock[product_id] != "") {
            let product = await Product.findOne({ _id: ObjectId(product_id) })
            totalprice += +stock[product_id] * +product.price
            orders.push({
                product_id: product_id,
                stock: +stock[product_id]
            })
        }
    }
    if (orders.length <= 0) {
        return res.json({
            status: false,
            message: "Please enter product quantity to continue"
        })
    }

    // enter book
    let last_booking_id = await Cpsales.findOne({}, {
        _id: 0,
        booking_id: 1
    }).sort({
        _id: -1
    })
    if (last_booking_id) {
        bokid = last_booking_id.booking_id.split("-")
        bk_id = bokid[2]
    } else {
        bk_id = config.COLLECTIONPOINT_BOOKING_ID_START
    }
    booking_id = `${config.COLLECTIONPOINT_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1}`
    try {
        let newStock = await Cpsales()
        newStock.collectionpoint_id = collectionpoint_id
        newStock.date = date
        newStock.booking_id = booking_id
        newStock.shift_id = shift_id
        newStock.total = totalprice
        newStock.products = orders
        await newStock.save()

        let cp_stock = await Cpstocks.findOne({
            collectionpoint_id: ObjectId(collectionpoint_id),
            date: new Date(moment().format('YYYY-MM-DD')),
            shift_id: ObjectId(shift_id)
        })

        let products = cp_stock.products;
        products = products.concat(orders);
        products = await this.getGroupedArrayMinus(products);
        cp_stock.products = products
        await cp_stock.save()

        return res.json({
            status: true,
            message: "stock updated"
        })
    } catch (error) {
        console.log(error)
        return res.json({
            status: false,
            message: "something went wrong"
        })
    }
}

