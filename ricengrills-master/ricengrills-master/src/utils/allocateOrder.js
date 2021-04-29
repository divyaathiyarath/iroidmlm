const mongoose = require("mongoose")
const ObjectId = mongoose.Types.ObjectId
const Booking = mongoose.model("bookings")

exports.allocateOrders = async(booking_id) => {
    let booking_details = await Booking.aggregate([
        {
            $match: {
                _id: ObjectId(booking_id)
            }
        },
        {
            $lookup: {
                from: 'addresses',
                let: {
                    address_id: '$address_id'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$_id", "$$address_id"]
                            }
                        }
                    },
                    {
                        $project: {
                            suburb_id: 1
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
            $addFields: {
                suburb_id: "$address.suburb_id"
            }
        },
        {
            $lookup: {
                from: 'stocks',
                let: {
                    suburb_id: "$suburb_id",
                    shift_id: "$shift_id",
                    date: "$scheduled_date"
                },
                pipeline: [
                    {
                        $match: {
                            type: 'DELIVERY',
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$suburb_id", "$$suburb_id"]
                                    },
                                    {
                                        $eq: ["$shift_id", "$$shift_id"]
                                    },
                                    {
                                        $eq: ["$date", "$$date"]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            driver_id: 1,
                            suburb_id: 1,
                            shift_id: 1,
                            date: 1,
                            initial_stock: 1,
                        }
                    },
                    {
                        $lookup: {
                            from: 'bookings',
                            let: {
                                driver_id: "$driver_id",
                                suburb_id: "$suburb_id",
                                shift_id: "$shift_id",
                                date: "$date",
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                {$eq: ["$driver_id", "$$driver_id"]},
                                                {$eq: ["$shift_id", "$$shift_id"]},
                                                {$eq: ["$scheduled_date", "$$date"]},
                                                // {$eq: ["$suburb_id", "$$suburb_id"]}
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        orders: 1
                                    }
                                },
                                {
                                    $unwind: "$orders"
                                },
                                {
                                    $project: {
                                        product_id: "$orders.product_id",
                                        quantity: "$orders.quantity"
                                    }
                                },
                                {
                                    $group: {
                                        _id: "$product_id",
                                        total_quantity: {
                                            $sum: "$quantity"
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        product_id: "$_id",
                                        al_stock: "$total_quantity"
                                    }
                                }
                            ],
                            as: "allocated_orders"
                        }
                    },
                ],
                as: 'stocks'
            }
        }
    ])
    return booking_details
}