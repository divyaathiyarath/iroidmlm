const mongoose = require('mongoose')
const CP = mongoose.model('collectionpoints')
const Address = mongoose.model('addresses')
const Setting = mongoose.model('settings')
const Driver = mongoose.model('drivers')
const Stock = mongoose.model('stocks')
let ObjectId = mongoose.Types.ObjectId;
const moment = require('moment')

exports.getComingShift = async () => {
    let offset = Math.abs((new Date()).getTimezoneOffset())
    let today = moment().format("YYYY-MM-DD");
    let cur_date = moment().utcOffset(+offset).format("YYYY-MM-DD HH:mm");
    let current_slot = await Setting.aggregate([
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
                current_date: cur_date,
                duration: {
                    $add: ["$duration", 0.5]
                }
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
                start: {
                    $subtract: ["$start", {
                        $multiply: [0.5, 3600000]
                    }]
                },
                current_date: {
                    $toDate: "$current_date"
                }
            },
        },
        {
            $match: {
                $expr: {
                    $and: [
                        { $gte: ["$current_date", "$start"] },
                        { $lte: ["$current_date", "$end"] },
                    ],
                },
            },
        },
        {
            $sort: {
                start: 1,
            },
        }
    ]);

    let setting = await Setting.aggregate([
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
                    $and: [{ $gte: ["$start", new Date()] }],
                },
            },
        },
        {
            $sort: {
                start: 1,
            },
        },
    ]);

    let setting2 = await Setting.aggregate([
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
                today: { $toDate: { $concat: [today, " ", "$time"] } }
            },
        },
        {
            $sort: {
                today: 1,
            },
        },
    ]);

    if (current_slot.length > 0) {
        return {
            current_shift: current_slot[0]._id,
            shifts: setting2,
        };
    } else {
        return {
            current_shift: null,
            shifts: setting2,
        };
    }
};

exports.getCurrentStockDetails = async (req, res) => {
    let { shift_id } = req.query
    if (!shift_id) {
        return res.json({
            status: true,
            stocks: []
        })
    }
    let stocks = await Stock.aggregate([
        {
            $match: {
                delete_status: false,
                driver_id: ObjectId(req.session._id),
                shift_id: ObjectId(shift_id),
                date: new Date(moment().format('YYYY-MM-DD'))
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
                _id: "$product._id",
                name: "$product.name",
                stock: "$products.stock",
                suburb: "$suburb",
                suburb_id: "$suburb._id"
            }
        },
        {
            $group: {
                _id: {
                    product_id: "$_id",
                    suburb_id: "$suburb_id"
                },
                suburb_id: {
                    $first: "$suburb_id"
                },
                product_id: {
                    $first: "$_id"
                },
                suburb: {
                    $first: "$suburb"
                },
                name: {
                    $first: "$name"
                },
                quantity: {
                    $sum: "$stock"
                }
            }
        },
        {
            $project: {
                _id: 1,
                suburb_id: 1,
                product_id: 1,
                name: "$suburb.name",
                order:{
                    product_id:"$product_name",
                    name: "$name",
                    quantity:"$quantity"
                }
            }
        },
        {
            $group: {
                _id: "$suburb_id",
                name: {
                    $first:"$name"
                },
                orders:{
                    $addToSet:"$order"
                }
            }
        }
    ])

    return res.json({
        stocks,
        status: true
    })
}

exports.getUserLocation = async (user_id) => {
    let driver = await Driver.findOne({ _id: ObjectId(user_id) })
    let lat = 0
    let lng = 0
    if (driver) {
        let location = driver.location
        let { coordinates } = location
        if (coordinates) {
            if (coordinates.length >= 2) {
                lat = coordinates[1]
                lng = coordinates[0]
            }
        }
    }
    return {
        lat,
        lng
    }
}

exports.getCollectionPoints = async (req, res) => {
    let { shift_id } = req.query
    let { lat, lng } = await this.getUserLocation(req.session._id)
    console.log({
        lat,
        lng
    })
    if (!shift_id) {
        return res.json({
            status: true,
            stocks: []
        })
    }
    let stocks = await Stock.find({
        delete_status: false,
        driver_id: ObjectId(req.session._id),
        shift_id: ObjectId(shift_id),
        date: new Date(moment().format('YYYY-MM-DD'))
    })
    let suburbs = []
    stocks.forEach(stock => {
        suburbs.push(ObjectId(stock.suburb_id))
    })

    let collectionpoints = await Address.aggregate([
        {
            $geoNear: {
                near: {
                    type: "Point",
                    coordinates: [
                        parseFloat(lat),
                        parseFloat(lng)
                    ]
                },
                key: "location",
                spherical: true,
                distanceField: "distance",
                distanceMultiplier: 0.001,
                query: {
                    delete_status: false,
                },
            }
        },
        {
            $match: {
                $expr: {
                    $in: ["$suburb_id", suburbs]
                },
                delete_status: false,
                type: "COLLECTION_POINT"
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
                                    { $eq: ["$_id", "$$cp_id"] },
                                    { $eq: ["$delete_status", false] },
                                    { $eq: ["$approved", true] }
                                ]
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
            $match: {
                collectionpoint: {
                    $ne: null
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
                                    { $eq: ["$_id", "$$suburb_id"] },
                                    { $eq: ["$delete_status", false] }
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
            $sort: {
                distance: 1
            }
        },
        {
            $project: {
                _id: "$collectionpoint._id",
                name: "$collectionpoint.name",
                contact_name: "$collectionpoint.contact_name",
                email: "$collectionpoint.email",
                mobile: "$collectionpoint.mobile",
                image: "$collectionpoint.image",
                address_line1: 1,
                address_line2: 1,
                address_id: 1,
                location: 1,
                suburb_id: 1,
                suburb: "$suburb.name",
                distance: 1
            }
        }
    ])

    return res.json({
        cps: collectionpoints,
        status: false
    })
}

//driver dashboard
exports.dashboard = async (req, res) => {
    let { current_shift, shifts } = await this.getComingShift()
    return res.render('driver-panel/dashboard', {
        current_shift,
        shifts
    })
}