const mongoose = require("mongoose");
const moment = require("moment");
let ObjectId = mongoose.Types.ObjectId
let User = mongoose.model('users')
let Product = mongoose.model('products')
let Setting = mongoose.model('settings')
let Address = mongoose.model('addresses')
let Suburb = mongoose.model('suburbs')
let Coupon = mongoose.model("coupons")
let CP = mongoose.model('collectionpoints')
let TmpCredit = mongoose.model('tmp_credits')
let TmpBooking = mongoose.model('tmp_bookings')
let Booking = mongoose.model('bookings')
let Payment = mongoose.model('payments')
let Credit = mongoose.model('credits')
let QRCode = require('qrcode')

let config = require('config')
let _ = require('underscore')
const { session } = require("passport");
let { createCredit } = require('./paymentController');
let { getComingShift } = require('./cartController')
const { response } = require("express");

async function getDataUrl(str) {
    return QRCode.toDataURL(str, { errorCorrectionLevel: 'M' });
}

exports.bulkorder = async (req, res) => {
    let { shifts } = await getComingShift()
    let setting = await Setting.findOne()
    let gst = setting.gst
    let min_qty = setting.min_bulk_order_quantity
    let delivery_charge = setting.delivery_charge
    if (!req.session._id || !req.session.role == 'user') {
        return res.redirect(res.locals.app_url + '/login')
    }
    
    let products = await Product.aggregate([
        {
            $match: {
                type: "FOOD",
                delete_status: false
            }
        }
    ])
    let user = await User.findOne({ _id: ObjectId(req.session._id) })
    let food_credits = 0
    if (user && typeof user.credits != "undefined") {
        let { food } = user.credits
        if (typeof food != 'undefined' && food) {
            food_credits = food
        }
    }

    let delivery_address = req.session.delivery_address
    if (typeof delivery_address == 'undefined' || !delivery_address) {
        let active_address = await Address.findOne({
            user_id: ObjectId(req.session._id),
            delete_status: false
            // active_location: true
        })
        if (active_address) {
            delivery_address = active_address._id
        } else {
            delivery_address = null
        }

    }
    let addresses = await Address.find({
        user_id: ObjectId(req.session._id),
        delete_status: false
    })

    let suburbs = await Suburb.aggregate([
        {
            $match: {
                delete_status: false
            }
        }
    ])
    return res.render('web/bulk', {
        suburbs,
        delivery_address,
        gst,
        addresses,
        shifts,
        food_credits,
        delivery_charge,
        products,
        min_qty
    })
};

exports.bulkBooking = async (req, res) => {
    try {
        let { products, date, time, address_id } = req.body
        let orders = []
        for (i = 0; i < products.length; i++) {
            let prod = await Product.findOne({ _id: ObjectId(products[i].product_id) })
            products[i]['price'] = prod.price
        }
        let approximate_price = 0
        products.forEach((product) => {
            let details = {
                product_id: product.product_id,
                quantity: product.count,
                price: product.price
            }
            orders.push(details)
            approximate_price += product.count * product.price
        })
        let tmp_booking = new TmpBooking({
            user_id: req.session._id,
            booking_type: 'BULK',
            address_id: ObjectId(address_id),
            scheduled_date: new Date(moment(date).format('YYYY-MM-DD')),
            scheduled_time: time,
            orders: orders,
            approximate_price: approximate_price,
            created_at: new Date()
        })
        await tmp_booking.save()
        return res.json({
            status: true,
            message: 'Bulk order submitted, Please wait for RiceNGrills approval'
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.bulkorders = async (req, res) => {
    return res.render('web/bulkorders')
}

exports.getBulkOrderList = async (req, res) => {
    let user_id  = req.session._id
    try {
        let bookings = await TmpBooking.aggregate([
            {
                $match: {
                    delete_status: false,
                    redeemed: {
                        $ne: true
                    },
                    booking_type: 'BULK',
                    user_id: ObjectId(user_id)
                }
            },
            {
                $sort: {
                    created_at: -1
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
                                    $eq: ["$_id", "$$address_id"]
                                }
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
                                    $eq: ["$_id", "$$product_id"]
                                }
                            }
                        },
                        {
                            $project: {
                                type: "$type",
                                name: "$name",
                            }
                        }
                    ],
                    as: "product_detail"
                }
            },
            {
                $addFields: {
                    product_detail: {
                        $arrayElemAt: ["$product_detail", 0]
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    booking_type: 1,
                    scheduled_date: 1,
                    scheduled_time:1,
                    created_at: 1,
                    booking_id: 1,
                    user_id: 1,
                    address_id: 1,
                    address: 1,
                    shift_id: 1,
                    orders: {
                        product_id: 1,
                        product_name: "$product_detail.name",
                        quantity: 1,
                        type: "$product_detail.type"
                    },
                    qr_code: 1,
                    bulkorder_status:1,
                    bulkorder_review:1,
                }
            },
            {
                $group: {
                    _id: "$_id",
                    booking_type: {
                        $first: "$booking_type"
                    },
                    bulkorder_status: {
                        $first: "$bulkorder_status"
                    },
                    bulkorder_review: {
                        $first: "$bulkorder_review"
                    },
                    scheduled_date: {
                        $first: "$scheduled_date"
                    },
                    scheduled_time: {
                        $first: "$scheduled_time"
                    },
                    created_at: {
                        $first: "$created_at"
                    },
                    booking_id: {
                        $first: "$booking_id"
                    },
                    user_id: {
                        $first: "$user_id"
                    },
                    address_id: {
                        $first: "$address_id"
                    },
                    address: {
                        $first: "$address"
                    },
                    shift_id: {
                        $first: "$shift_id"
                    },
                    qr_code: {
                        $first: "$qr_code"
                    },
                    orders: {
                        $push: "$orders"
                    }
                }
            },
            {
                $sort:{
                    scheduled_date: -1
                }
            }
        ])
        return res.json({
            status: true,
            bookings
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: true,
            bookings: []
        })
    }
}