const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const moment = require("moment");
const config = require("config");
const QRCode = require("qrcode");

const Product = mongoose.model("products");
const Address = mongoose.model("addresses");
const TmpBooking = mongoose.model("tmp_bookings");
const Booking = mongoose.model("bookings");
const Coupon = mongoose.model("coupons");
const TmpPayment = mongoose.model("tmp_payments");
const Payment = mongoose.model("payments");
const Setting = mongoose.model("settings");
const User = mongoose.model("users");
const Stock = mongoose.model("stocks");
const Driver = mongoose.model("drivers");
const BookingSlot = mongoose.model("booking_slots");
const CP_STOCK = mongoose.model("cp_stocks");
const CollectionPoint = mongoose.model("collectionpoints")
const Transaction = mongoose.model("transactions")
const StockTransfer = mongoose.model("stock_transfers")
const SendUserNotification = require("../../jobs/user_notification");
const {
  addCreditByReferal,
  sendOrderConfirm,
} = require("../../jobs/notification");

const {
  ValidateUserRealtimeCart,
  ValidateUserCouponVerify,
  ValidateUserRealTimeBookingConfirm,
} = require("../../validators/usersValidator");
const { checkStockLimit } = require("../../utils/stock_limit_check");

async function getDataUrl(str) {
  return QRCode.toDataURL(str, { errorCorrectionLevel: "M" });
}

exports.getComingShift = async () => {
  let offset = Math.abs(new Date().getTimezoneOffset());
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
        current_date: {
          $toDate: "$current_date",
        },
      },
    },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ["$current_date", "$start"] },
            { $lte: ["$current_date","$end"] },
          ],
        },
      },
    },
    {
      $sort: {
        start: 1,
      },
    },
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
        today: { $toDate: { $concat: [today, " ", "$time"] } },
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
      coming_shift: current_slot[0]._id,
      shifts: setting2,
    };
  } else if (setting.length > 0) {
    return {
      coming_shift: setting[0]._id,
      shifts: setting2,
    };
  } else {
    return {
      coming_shift: null,
      shifts: setting2,
    };
  }
};

exports.products = async (req, res) => {
  try {
    let { shifts, coming_shift } = await this.getComingShift();
    // let { shift_id } = req.query
    let shift_id = coming_shift;
    let query = [
      {
        $match: {
          is_regular: true,
          delete_status: false,
          type: "FOOD",
        },
      },
    ];
    if (req.payload) {
      let active_address = await Address.findOne({
        user_id: req.payload._id,
        delete_status: false,
        active_location: true,
      });
      query.push(
        {
          $lookup: {
            from: "stocks",
            let: {
              shift_id: ObjectId(shift_id),
              product_id: "$_id",
              suburb_id: active_address.suburb_id,
            },
            pipeline: [
              {
                $match: {
                  type: "DELIVERY",
                  date: new Date(moment().format("YYYY-MM-DD")),
                  $expr: {
                    $and: [
                      {
                        $eq: ["$$shift_id", "$shift_id"],
                      },
                      {
                        $in: ["$$product_id", "$products.product_id"],
                      },
                      {
                        $eq: ["$suburb_id", "$$suburb_id"],
                      },
                    ],
                  },
                },
              },
            ],
            as: "stocks",
          },
        },
        {
          $unwind: {
            path: "$stocks",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            stocks: 1,
            is_veg: 1,
            allergen_contents: 1,
            stock_details: {
              $filter: {
                input: "$stocks.products",
                as: "stock",
                cond: {
                  $eq: ["$$stock.product_id", "$_id"],
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            is_veg: 1,
            allergen_contents: 1,
            delivery_stock: {
              $arrayElemAt: ["$stock_details", 0],
            },
          },
        },
        {
          $group: {
            _id: {
              _id: "$_id",
              cover_pic: "$cover_pic",
              name: "$name",
              price: "$price",
              description: "$description",
              image: "$image",
            },
            details: {
              $push: {
                is_veg: "$is_veg",
                allergen_contents: "$allergen_contents",
              },
            },
            total_delivery_stock: {
              $sum: "$delivery_stock.stock",
            },
          },
        },
        {
          $project: {
            _id: "$_id._id",
            cover_pic: "$_id.cover_pic",
            name: "$_id.name",
            price: "$_id.price",
            description: "$_id.description",
            image: "$_id.image",
            is_veg: {
              $arrayElemAt: ["$details", 0],
            },
            total_delivery_stock: "$total_delivery_stock",
          },
        },
        {
          $project: {
            _id: 1,
            cover_pic: 1,
            name: 1,
            price: 1,
            description: 1,
            image: 1,
            is_veg: "$is_veg.is_veg",
            total_delivery_stock: 1,
            allergen_contents: "$is_veg.allergen_contents",
          },
        }
      );
    }
    let products = await Product.aggregate(query);
    return res.json({
      status: true,
      data: products,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.verifyCoupon = async (req, res) => {
  try {
    let { errors, isValid } = ValidateUserCouponVerify(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { delivery_type, coupon, address_id, collectionpoint_id } = req.body;
    if (delivery_type == "ONLINE") {
      address = await Address.findOne({
        _id: address_id,
      });
    } else {
      address = await Address.findOne({
        collectionpoint_id: collectionpoint_id,
      });
    }
    let coupon_code = await Coupon.findOne({
      suburbs: address.suburb_id,
      code: coupon,
      delete_status: false,
      active_status: true,
      count: {
        $gt: 0,
      },
    });
    if (coupon_code) {
      let is_used = await Booking.countDocuments({
        user_id: req.payload._id,
        coupon: coupon
      })
      if(is_used) {
        return res.json({
          status: false,
          message: "Coupon code already used"
        })
      } else {
        let data = {
          coupon: coupon_code.code,
          discount: coupon_code.val,
        };
        return res.json({
          status: true,
          data,
        });
      }
    } else {
      return res.json({
        status: false,
        message: "Invalid coupon code",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.checkStockAvailability = async (data) => {
  let {
    products,
    quantities,
    current_shift,
    address: {
      suburb_id,
      _id: address_id,
      collectionpoint_id,
      user_id,
      type,
      location,
    },
    driverArray
  } = data;
  console.log(products);
  let products_array = [];
  for (var i = 0; i < products.length; i++) {
    products_array.push({
      product_id: ObjectId(products[i]),
      count: parseInt(quantities[i]),
    });
  }
  // products = products.map((product) => {
  //   return {
  // 	product_id: ObjectId(product.product_id),
  // 	count: parseInt(product.count),
  //   };
  // });
  console.log("driversssss", driverArray)
  let stock_check = false;
  if (type == "USER") {


    let active_drivers = []

    let drivers_rec = await Stock.aggregate([
      {
        $match: {
          delete_status: false,
          suburb_id: ObjectId(suburb_id),
          shift_id: ObjectId(current_shift),
          $expr: {
            $and: [
              {
                $gte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 00:00:000")),
                ],
              },
              {
                $lte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 23:59:000")),
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$driver_id"
        }
      }
    ]);

    drivers_rec.forEach(driver => {
      active_drivers.push(ObjectId(driver._id))
    })

    // let stock_status_check = await Stock.aggregate([
    //   {
    //     $match: {
    //       delete_status: false,
    //       shift_id: ObjectId(current_shift),
    //       driver_id: {
    //         $in: active_drivers
    //       },
    //       $expr: {
    //         $and: [
    //           {
    //             $gte: [
    //               "$date",
    //               new Date(moment().format("YYYY-MM-DD 00:00:000")),
    //             ],
    //           },
    //           {
    //             $lte: [
    //               "$date",
    //               new Date(moment().format("YYYY-MM-DD 23:59:000")),
    //             ],
    //           },
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "drivers",
    //       let: {
    //         driver_id: "$driver_id",
    //       },
    //       pipeline: [
    //         {
    //           $geoNear: {
    //             near: location,
    //             key: "location",
    //             spherical: true,
    //             distanceField: "distance",
    //             distanceMultiplier: 0.001,
    //           },
    //         },
    //         {
    //           $match: {
    //             type: "DELIVERY",
    //             $expr: {
    //               $and: [{ $eq: ["$_id", "$$driver_id"] }],
    //             },
    //           },
    //         },
    //         {
    //           $sort: {
    //             distance: 1
    //           }
    //         },
    //         {
    //           $lookup: {
    //             from: 'driver_logs',
    //             let: {
    //               driver_id: "$_id",
    //               shift_id: ObjectId(current_shift),
    //               date: new Date(moment().format('YYYY-MM-DD'))
    //             },
    //             pipeline: [
    //               {
    //                 $match: {
    //                   $expr: {
    //                     $and: [
    //                       {$eq: ["$driver_id", "$$driver_id"]},
    //                       {$eq: ["$shift_id", "$$shift_id"]},
    //                       {$eq: ["$date", "$$date"]}
    //                     ]
    //                   }
    //                 }
    //               }
    //             ],
    //             as: "driver_log"
    //           }
    //         },
    //         {
    //           $addFields: {
    //             driver_log: {
    //               $arrayElemAt: ["$driver_log", 0]
    //             }
    //           }
    //         },
    //         {
    //           $addFields: {
    //             service_started: {
    //               $cond: {
    //                 if: {
    //                   $or: [
    //                     {$ne: ["$driver_log.callback_time", null]},
    //                     {$ne: ["$driver_log.service_end_time", null]}
    //                   ]
    //                 },
    //                 then: false,
    //                 else: true
    //               }
    //             }
    //           }
    //         }
    //       ],
    //       as: "driver",
    //     },
    //   },
    //   {
    //     $addFields: {
    //       distance: {
    //         $arrayElemAt: ["$driver.distance", 0],
    //       },
    //       service_started: {
    //         $arrayElemAt: ["$driver.service_started", 0],
    //       },
    //     },
    //   },
    //   {
    //     $sort: {
    //       distance: 1
    //     }
    //   },
    //   {
    //     $match: {
    //       service_started: true
    //     }
    //   },
    //   {
    //     $unwind: "$products",
    //   },
    //   {
    //     $addFields: {
    //       required_product: {
    //         $filter: {
    //           input: products_array,
    //           as: "product",
    //           cond: {
    //             $eq: ["$$product.product_id", "$products.product_id"],
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       required_product: {
    //         $arrayElemAt: ["$required_product", 0],
    //       },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "bookings",
    //       let: {
    //         product_id: "$products.product_id",
    //         shift_id: "$shift_id",
    //         suburb_id: "$suburb_id",
    //         driver_id: "$driver_id",
    //       },
    //       pipeline: [
    //         {
    //           $match: {
    //             scheduled_date: new Date(moment().format("YYYY-MM-DD")),
    //             $expr: {
    //               $and: [
    //                 { $eq: ["$redeemed", false] },
    //                 { $eq: ["$shift_id", "$$shift_id"] },
    //                 { $eq: ["$delete_status", false] },
    //                 { $eq: ["$delivery_type", "ONLINE"] },
    //                 { $eq: ["$driver_id", "$$driver_id"] },
    //                 //   {
    //                 // 	$and: [
    //                 // 	  {
    //                 // 		$gte: [
    //                 // 		  "$scheduled_date",
    //                 // 		  new Date(moment().format("YYYY-MM-DD 00:00:000")),
    //                 // 		],
    //                 // 	  },
    //                 // 	  {
    //                 // 		$lte: [
    //                 // 		  "$scheduled_date",
    //                 // 		  new Date(moment().format("YYYY-MM-DD 23:59:000")),
    //                 // 		],
    //                 // 	  },
    //                 // 	],
    //                 //   },
    //               ],
    //             },
    //           },
    //         },
    //         {
    //           $unwind: "$orders",
    //         },
    //         {
    //           $project: {
    //             product_id: "$orders.product_id",
    //             quantity: "$orders.quantity",
    //           },
    //         },
    //         {
    //           $group: {
    //             _id: "$product_id",
    //             quantity: {
    //               $sum: "$quantity",
    //             },
    //           },
    //         },
    //       ],
    //       as: "booking_products",
    //     },
    //   },
    //   {
    //     $addFields: {
    //       booking_product: {
    //         $filter: {
    //           input: "$booking_products",
    //           as: "product",
    //           cond: {
    //             $eq: ["$$product._id", "$products.product_id"],
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       booking_stock: {
    //         $arrayElemAt: ["$booking_product.quantity", 0],
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       booking_stock: {
    //         $cond: {
    //           if: { $gt: ["$booking_stock", null] },
    //           then: "$booking_stock",
    //           else: 0,
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       "products.stock": {
    //         $subtract: ["$products.stock", "$booking_stock"],
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       required_product: {
    //         $filter: {
    //           input: products_array,
    //           as: "product",
    //           cond: {
    //             $eq: ["$$product.product_id", "$products.product_id"],
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $match: {
    //       $expr: {
    //         $gte: [{ $size: "$required_product" }, 1],
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       required_product: {
    //         $arrayElemAt: ["$required_product", 0],
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 1,
    //       booking_stock: 1,
    //       driver_id: 1,
    //       product: {
    //         _id: "$products.product_id",
    //         stock: "$products.stock",
    //         count: "$required_product.count",
    //       },
    //       booking_product: 1,
    //     },
    //   },
    //   {
    //     $addFields: {
    //       has_stock: {
    //         $cond: {
    //           if: { $lte: ["$product.count", "$product.stock"] },
    //           then: true,
    //           else: false,
    //         },
    //       },
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: "$_id",
    //       driver_id: {
    //         $first: "$driver_id",
    //       },
    //       insufficient_products: {
    //         $push: {
    //           $cond: [
    //             {
    //               $eq: ["$has_stock", false],
    //             },
    //             { id: "$product._id", stock: "$product.stock" },
    //             null,
    //           ],
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       insufficient_products: {
    //         $filter: {
    //           input: "$insufficient_products",
    //           as: "product",
    //           cond: {
    //             $ne: ["$$product", null],
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $addFields: {
    //       insufficient_stock: {
    //         $cond: {
    //           if: { $gte: [{ $size: "$insufficient_products" }, 1] },
    //           then: true,
    //           else: false,
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $match: {
    //       insufficient_stock: false,
    //     },
    //   },
    // ]);


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    
    let stock_status_check = await Stock.aggregate([
      {
        $match: {
          delete_status: false,
          shift_id: ObjectId(current_shift),
          driver_id: {
            $in: active_drivers
          },
          $expr: {
            $and: [
              {
                $gte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 00:00:000")),
                ],
              },
              {
                $lte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 23:59:000")),
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "drivers",
          let: {
            driver_id: "$driver_id",
          },
          pipeline: [
            {
              $geoNear: {
                near: location,
                key: "location",
                spherical: true,
                distanceField: "distance",
                distanceMultiplier: 0.001,
              },
            },
            {
              $match: {
                type: "DELIVERY",
                $expr: {
                  $and: [{ $eq: ["$_id", "$$driver_id"] }],
                },
              },
            },
            {
              $sort: {
                distance: 1
              }
            },
            {
              $lookup: {
                from: 'driver_logs',
                let: {
                  driver_id: "$_id",
                  shift_id: ObjectId(current_shift),
                  date: new Date(moment().format('YYYY-MM-DD'))
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {$eq: ["$driver_id", "$$driver_id"]},
                          {$eq: ["$shift_id", "$$shift_id"]},
                          {$eq: ["$date", "$$date"]}
                        ]
                      }
                    }
                  }
                ],
                as: "driver_log"
              }
            },
            {
              $addFields: {
                driver_log: {
                  $arrayElemAt: ["$driver_log", 0]
                }
              }
            },
            {
              $addFields: {
                service_started: {
                  $cond: {
                    if: {
                      $or: [
                        {$ne: ["$driver_log.callback_time", null]},
                        {$ne: ["$driver_log.service_end_time", null]}
                      ]
                    },
                    then: false,
                    else: true
                  }
                }
              }
            }
          ],
          as: "driver",
        },
      },
      {
        $addFields: {
          distance: {
            $arrayElemAt: ["$driver.distance", 0],
          },
          service_started: {
            $arrayElemAt: ["$driver.service_started", 0],
          },
        },
      },
      {
        $sort: {
          distance: 1
        }
      },
      {
        $match: {
          service_started: true
        }
      },
      {
        $unwind: "$products",
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products_array,
              as: "product",
              cond: {
                $eq: ["$$product.product_id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $arrayElemAt: ["$required_product", 0],
          },
        },
      },
      {
        $lookup: {
          from: "bookings",
          let: {
            product_id: "$products.product_id",
            shift_id: "$shift_id",
            suburb_id: "$suburb_id",
            driver_id: "$driver_id",
          },
          pipeline: [
            {
              $match: {
                scheduled_date: new Date(moment().format("YYYY-MM-DD")),
                $expr: {
                  $and: [
                    { $eq: ["$redeemed", false] },
                    { $eq: ["$shift_id", "$$shift_id"] },
                    { $eq: ["$delete_status", false] },
                    { $eq: ["$delivery_type", "ONLINE"] },
                    { $eq: ["$driver_id", "$$driver_id"] },
                    //   {
                    // 	$and: [
                    // 	  {
                    // 		$gte: [
                    // 		  "$scheduled_date",
                    // 		  new Date(moment().format("YYYY-MM-DD 00:00:000")),
                    // 		],
                    // 	  },
                    // 	  {
                    // 		$lte: [
                    // 		  "$scheduled_date",
                    // 		  new Date(moment().format("YYYY-MM-DD 23:59:000")),
                    // 		],
                    // 	  },
                    // 	],
                    //   },
                  ],
                },
              },
            },
            {
              $unwind: "$orders",
            },
            {
              $project: {
                product_id: "$orders.product_id",
                quantity: "$orders.quantity",
              },
            },
            {
              $group: {
                _id: "$product_id",
                quantity: {
                  $sum: "$quantity",
                },
              },
            },
          ],
          as: "booking_products",
        },
      },
      {
        $addFields: {
          booking_product: {
            $filter: {
              input: "$booking_products",
              as: "product",
              cond: {
                $eq: ["$$product._id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          booking_stock: {
            $arrayElemAt: ["$booking_product.quantity", 0],
          },
        },
      },
      {
        $addFields: {
          booking_stock: {
            $cond: {
              if: { $gt: ["$booking_stock", null] },
              then: "$booking_stock",
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          "products.stock": {
            $subtract: ["$products.stock", "$booking_stock"],
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products_array,
              as: "product",
              cond: {
                $eq: ["$$product.product_id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $gte: [{ $size: "$required_product" }, 1],
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $arrayElemAt: ["$required_product", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          booking_stock: 1,
          driver_id: 1,
          product_id: "$products.product_id",
          product_count: "$products.stock",
          required_count: "$required_product.count",
          booking_product: 1,
        }
      },
      {
        $group: {
          _id: {
            driver_id: "$driver_id",
            product_id: "$product_id"
          },
          product_count: {
            $sum: "$product_count"
          },
          required_count: {
            $first: "$required_count"
          },
        }
      },
      {
        $project: {
          _id: 0,
          driver_id: "$_id.driver_id",
          product: {
            _id: "$_id.product_id",
            stock: "$product_count",
            count: "$required_count"
          }
        }
      },
      {
        $addFields: {
          has_stock: {
            $cond: {
              if: { $lte: ["$product.count", "$product.stock"] },
              then: true,
              else: false,
            },
          },
        }
      },
      {
        $group: {
          _id: "$driver_id",
          insufficient_products: {
            $push: {
              $cond: [
                {
                  $eq: ["$has_stock", false],
                },
                { id: "$product._id", stock: "$product.stock" },
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          insufficient_products: {
            $filter: {
              input: "$insufficient_products",
              as: "product",
              cond: {
                $ne: ["$$product", null],
              },
            },
          },
        },
      },
      {
        $addFields: {
          insufficient_stock: {
            $cond: {
              if: { $gte: [{ $size: "$insufficient_products" }, 1] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $match: {
          insufficient_stock: false,
        },
      },
    ]);

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // return {
    //   asdf: stock_status_check
    // }

    let drivers = [];
    if (stock_status_check.length > 0) {
      stock_check = true;
      stock_status_check.forEach((rec) => {
        let { _id } = rec;
        drivers.push(_id);
        // drivers.push(driver_id);
      });
    }

    return {
      status: true,
      stock_check,
      drivers,
      stock_status_check,
    };
  } else if (type == "COLLECTION_POINT") {
    let stocks = await CP_STOCK.aggregate([
      {
        $match: {
          delete_status: false,
          collectionpoint_id: ObjectId(collectionpoint_id),
          $expr: {
            $and: [
              {
                $gte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 00:00:000")),
                ],
              },
              {
                $lte: [
                  "$date",
                  new Date(moment().format("YYYY-MM-DD 23:59:000")),
                ],
              },
            ],
          },
        },
      },
      {
        $unwind: "$products",
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products_array,
              as: "product",
              cond: {
                $eq: ["$$product.product_id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $arrayElemAt: ["$required_product", 0],
          },
        },
      },
      {
        $lookup: {
          from: "bookings",
          let: {
            product_id: "$products.product_id",
            shift_id: "$shift_id",
            suburb_id: "$suburb_id",
            collectionpoint_id: collectionpoint_id,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$redeemed", false] },
                    { $eq: ["$shift_id", "$$shift_id"] },
                    { $eq: ["$delete_status", false] },
                    { $eq: ["$delivery_type", "COLLECTIONPOINT"] },
                    { $eq: ["$collectionpoint_id", "$$collectionpoint_id"] },
                    {
                      $and: [
                        {
                          $gte: [
                            "$scheduled_date",
                            new Date(moment().format("YYYY-MM-DD 00:00:000")),
                          ],
                        },
                        {
                          $lte: [
                            "$scheduled_date",
                            new Date(moment().format("YYYY-MM-DD 23:59:000")),
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $unwind: "$orders",
            },
            {
              $project: {
                product_id: "$orders.product_id",
                quantity: "$orders.quantity",
              },
            },
            {
              $group: {
                _id: "$product_id",
                quantity: {
                  $sum: "$quantity",
                },
              },
            },
          ],
          as: "booking_products",
        },
      },
      {
        $addFields: {
          booking_product: {
            $filter: {
              input: "$booking_products",
              as: "product",
              cond: {
                $eq: ["$$product._id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $addFields: {
          booking_stock: {
            $arrayElemAt: ["$booking_product.quantity", 0],
          },
        },
      },
      {
        $addFields: {
          booking_stock: {
            $cond: {
              if: { $gt: ["$booking_stock", null] },
              then: "$booking_stock",
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          "products.stock": {
            $subtract: ["$products.stock", "$booking_stock"],
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products_array,
              as: "product",
              cond: {
                $eq: ["$$product.product_id", "$products.product_id"],
              },
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $gte: [{ $size: "$required_product" }, 1],
          },
        },
      },
      {
        $addFields: {
          required_product: {
            $arrayElemAt: ["$required_product", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          booking_stock: 1,
          product: {
            _id: "$required_product.product_id",
            stock: "$products.stock",
            count: "$required_product.count",
          },
          booking_product: 1,
          has_stock: {
            $cond: {
              if: { $gte: ["$required_product.count", "$products.stock"] },
              then: false,
              else: true,
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          insufficient_products: {
            $push: {
              $cond: [
                {
                  $eq: ["$has_stock", false],
                },
                { id: "$product._id", stock: "$product.stock" },
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          insufficient_products: {
            $filter: {
              input: "$insufficient_products",
              as: "product",
              cond: {
                $ne: ["$$product", null],
              },
            },
          },
        },
      },
      {
        $addFields: {
          insufficient_stock: {
            $cond: {
              if: { $gte: [{ $size: "$insufficient_products" }, 1] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $match: {
          insufficient_stock: false,
        },
      },
    ]);
    if (stocks.length > 0) {
      stock_check = true;
    }
    return {
      status: true,
      stock_check: stock_check,
      collectionpoint: collectionpoint_id,
    };
  } else {
    return {
      status: true,
      stock_check,
      collectionpoint: null,
    };
  }
};

exports.allocateSlot = async (data) => {
  let { shift_id, driver_id, booking_id, address_id, date } = data;
  let address = await Address.findOne({ _id: ObjectId(address_id) });
  let driver = await Driver.findOne({ _id: ObjectId(driver_id) });
  let { location } = driver;

  // slots = await BookingSlot.aggregate([
  //   {
  // 	$geoNear: {
  // 	  near: location,
  // 	  key: "location",
  // 	  spherical: true,
  // 	  distanceField: "distance",
  // 	  distanceMultiplier: 0.001,
  // 	  query: {
  // 		shift_id: ObjectId(shift_id),
  // 		driver_id: ObjectId(driver_id),
  // 	  },
  // 	},
  //   },
  //   {
  // 	$match: {
  // 	  shift_id: ObjectId(shift_id),
  // 	  date: new Date(moment().format("YYYY-MM-DD")),
  // 	  driver_id: ObjectId(driver_id),
  // 	},
  //   }
  // ]);

  // slots.forEach(async(slot)=>{
  //   let {_id, distance} = slot
  //   if(_id && distance){
  // 	await BookingSlot.updateOne({
  // 	  _id: ObjectId(_id),
  // 	}, {
  // 		distance: parseFloat(distance)
  // 	})
  //   }
  // })

  let booking_slot = new BookingSlot({
    shift_id: ObjectId(shift_id),
    driver_id: ObjectId(driver_id),
    booking_id: ObjectId(booking_id),
    address_id: ObjectId(address_id),
    date: date,
    location: address.location,
    distance: 1500,
  });

  await booking_slot.save();
  return true;
};

exports.realtimeSaveToCart = async (req, res) => {
  console.log(req.body)
  try {
    // return res.json({
    //   status: false,
    //   message: "No drivers available now"
    // })
    let { errors, isValid } = ValidateUserRealtimeCart(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let {
      products,
      quantities,
      prices,
      delivery_type,
      address_id,
      collectionpoint_id,
      coupon,
      actual_price,
      discount_price,
      gst,
      total_price,
    } = req.body;
    // return res.json({
    // 	status: false,
    // 	message: 'Order limit has been reached for today'
    // })
    let { shifts, coming_shift } = await this.getComingShift();
    if (typeof prices === "undefined") {
      return res.json({
        status: false,
        message: "Prices is required",
      });
    }
    if (typeof products === "undefined") {
      return res.json({
        status: false,
        message: "Products is required",
      });
    }
    if (typeof quantities === "undefined") {
      return res.json({
        status: false,
        message: "Quantities is required",
      });
    }
    if (
      products.length != quantities.length &&
      quantities.length != prices.length
    ) {
      return res.json({
        status: false,
        message: "products, quantities and prices are required",
      });
    }
    if (delivery_type == "ONLINE") {
      let total_quantity = 0;
      for (var i = 0; i < quantities.length; i++) {
        total_quantity += parseInt(quantities[i]);
      }
      if (total_quantity < 3) {
        return res.json({
          status: false,
          message: "For delivery select atleast 3 products",
        });
      }
    }
    var address = null;
    if (delivery_type == "ONLINE") {
      address = await Address.findOne({
        _id: address_id,
      });
    } else {
      address = await Address.findOne({
        collectionpoint_id: collectionpoint_id,
        delete_status: false,
      });
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let addressDetails = await Address.findOne({
      _id: address_id
    })
    let driverStocks = await Stock.aggregate([
      {
        $match: {
          suburb_id: addressDetails.suburb_id,
          shift_id: ObjectId(coming_shift),
          type: 'DELIVERY',
          date: new Date(moment().format('YYYY-MM-DD')),
          delete_status: false
        }
      },
      {
        $project: {
          driver_id: 1
        }
      },
      {
        $group: {
          _id: null,
          drivers: {
            $push: "$driver_id"
          }
        }
      }
    ])
    let driverArray = []
    if(driverStocks.length) {
      driverArray = driverStocks[0].drivers
    }
    console.log("driver_arry : ", driverArray)
    //check driver\ collectionpoint availability
    let {
      stock_check,
      drivers,
      collectionpoint,
      stock_status_check,
      stocks,
    } = await this.checkStockAvailability({
      products,
      quantities,
      current_shift: coming_shift,
      address,
      driverArray
    });
    console.log(drivers)
    let driver_id = null;
    if (!stock_check) {
      if (collectionpoint) {
        return res.json({
          status: false,
          message: "The selected collection point has not enough stock to supply",
        });
      } 
      else {
        return res.json({
          status: false,
          message: "We dont have delivery partner with these stock. Please choose pickup option.",
        });
      }
    } else {
      if (!collectionpoint) {
        let av_drivers = await Driver.aggregate([
          {
            $geoNear: {
              near: address.location,
              key: "location",
              spherical: true,
              distanceField: "distance",
              distanceMultiplier: 0.001,
            },
          },
          {
            $sort: {
              distance: 1
            }
          },
          {
            $match: {
              _id: {
                $in: drivers
              }
            }
          }
        ])
        if(av_drivers.length) {
          driver_id = av_drivers[0]._id
        } else {
          return res.json({
            status: false,
            message: "We dont have delivery partner with these stock. Please choose pickup option.",
          })
        }
        // driver_id = drivers.shift();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let orders = [];
    for (var i = 0; i < products.length; i++) {
      let details = {
        product_id: products[i],
        quantity: quantities[i],
        price: prices[i],
      };
      orders.push(details);
    }
    let delivery_charge = await Setting.findOne(
      {},
      {
        delivery_charge: 1,
      }
    );
    // return res.json({
    // 	delivery_charge
    // })
    let tmp_payment = new TmpPayment({
      user_id: req.payload._id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price,
      discount_price,
      gst,
      delivery_charge: products.length * delivery_charge.delivery_charge,
      total_price,
    });
    let saved_tmp_payment = await tmp_payment.save();

    let tmp_booking = new TmpBooking({
      tmp_payment_id: saved_tmp_payment._id,
      user_id: req.payload._id,
      booking_type: "REALTIME",
      delivery_type,
      shift_id: coming_shift,
      date: new Date(moment().format("YYYY-MM-DD")),
      orders,
      // address_id: address_id
    });
    if (delivery_type == "ONLINE") {
      tmp_booking.address_id = address_id;
      tmp_booking.driver_id = ObjectId(driver_id);
    } else {
      tmp_booking.collectionpoint_id = collectionpoint_id;
    }

    let coupon_code = await Coupon.findOne({
      suburbs: address.suburb_id,
      code: coupon,
      delete_status: false,
      active_status: true,
      count: {
        $gt: 0,
      },
    });

    if (coupon_code) {
      coupon_code.count = coupon_code.count - 1;
      await coupon_code.save();
      tmp_booking.coupon = coupon;
    }

    let save_tmp_booking = await tmp_booking.save();

    return res.json({
      status: true,
      message: "Booking has been saved",
      tmp_booking_id: save_tmp_booking._id,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.confirmRealtimeBooking = async (req, res) => {
  try {
    const { order_confirmed } = require("../../utils/emails/user/orders");
    const { neworder_confirmed } = require("../../utils/emails/user/orders")
    const { allocateOrder } = require("../../utils/allocateOrder");
    const { errors, isValid } = ValidateUserRealTimeBookingConfirm(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { shifts, coming_shift } = await this.getComingShift();
    let { transaction_id, tmp_booking_id, credit_used, amount, type } = req.body;
    let tmp_booking = await TmpBooking.findOne({
      _id: tmp_booking_id,
    }).populate({
      path: "tmp_payment_id",
    });
    if (tmp_booking && tmp_booking.tmp_payment_id) {
      var total_amount = 0;
      // save details to payment table
      if (credit_used == 0) {
        var payment = new Payment({
          user_id: req.payload._id,
          transaction_id,
          date: tmp_booking.tmp_payment_id.date,
          actual_price: tmp_booking.tmp_payment_id.actual_price,
          discount_price: tmp_booking.tmp_payment_id.discount_price,
          delivery_charge: tmp_booking.tmp_payment_id.delivery_charge,
          gst: tmp_booking.tmp_payment_id.gst,
          total_price: tmp_booking.tmp_payment_id.total_price,
          payment_type: tmp_booking.tmp_payment_id.payment_type,
        });
        total_amount = tmp_booking.tmp_payment_id.total_price;
      } else {
        let org_amnt = parseFloat(amount) - parseFloat(credit_used);
        var payment = new Payment({
          user_id: req.payload._id,
          transaction_id,
          date: new Date(moment().format("YYYY-MM-DD")),
          actual_price: tmp_booking.tmp_payment_id.actual_price,
          discount_price: tmp_booking.tmp_payment_id.discount_price,
          delivery_charge: tmp_booking.tmp_payment_id.delivery_charge,
          gst: tmp_booking.tmp_payment_id.gst,
          total_price: tmp_booking.tmp_payment_id.total_price,
          payment_type: tmp_booking.tmp_payment_id.payment_type,
          credit_used: credit_used,
        });
        // var payment = new Payment({
        // 	user_id: req.payload._id,
        // 	transaction_id,
        // 	date: new Date(moment().format('YYYY-MM-DD')),
        // 	actual_price: org_amnt,
        // 	total_price: org_amnt,
        // 	is_credit: true
        // })
        let user = await User.findOne(
          {
            _id: req.payload._id,
          },
          {
            credits: 1,
          }
        );
        user.credits.food =
          parseFloat(user.credits.food) - parseFloat(credit_used);
        await user.save();
        total_amount = tmp_booking.tmp_payment_id.total_price;
      }
      // await payment.save()

      let save_payment = await payment.save();

      if (save_payment) {
        let booking = new Booking();
        let last_booking_id = await Booking.findOne(
          {},
          {
            _id: 0,
            booking_id: 1,
          }
        ).sort({
          _id: -1,
        });

        if (last_booking_id) {
          bokid = last_booking_id.booking_id.split("-");
          bk_id = bokid[2];
        } else {
          bk_id = config.SCHEDULED_BOOKING_ID_START;
        }
        booking_id = `${config.REALTIME_BOOKING_ID_PREFIX}${
          parseInt(bk_id) + 1
        }`;
        booking.booking_id = booking_id;
        booking.payment_id = save_payment._id;
        booking.user_id = req.payload._id;
        booking.booking_type = tmp_booking.booking_type;
        booking.delivery_type = tmp_booking.delivery_type;
        tmp_booking.delivery_type == "ONLINE"
          ? (booking.address_id = tmp_booking.address_id)
          : (booking.collectionpoint_id = tmp_booking.collectionpoint_id);
        if (tmp_booking.delivery_type == "ONLINE") {
          booking.address_id = tmp_booking.address_id;
        }
        booking.shift_id = coming_shift;
        booking.orders = tmp_booking.orders;
        booking.qrcode = await getDataUrl(booking_id);
        booking.scheduled_date = new Date(moment().format("YYYY-MM-DD"));
        booking.driver_id = tmp_booking.driver_id;
        booking.created_at = new Date()
        booking.coupon = tmp_booking.coupon


        if(tmp_booking.delivery_type == 'COLLECTIONPOINT') {
          cp_address = await Address.findOne({
            delete_status: false,
            collectionpoint_id: tmp_booking.collectionpoint_id
          })
          if(cp_address) {
            booking.address_id = cp_address._id
          }
        }



        let saved_booking = await booking.save();
        if(transaction_id != '') {
          let transaction = new Transaction({
            user_id: req.payload._id,
            payment_id: transaction_id,
            amount: parseFloat(save_payment.total_price) - parseFloat(credit_used),
            type: "ORDER",
            gateway: type,
            date: new Date(moment().format('YYYY-MM-DD HH:mm:ss'))
          })
          transaction.booking_id = saved_booking.booking_id;
          await transaction.save();
        }
        if (booking.delivery_type == "ONLINE") {
          await this.allocateSlot({
            shift_id: booking.shift_id,
            driver_id: booking.driver_id,
            booking_id: booking._id,
            address_id: booking.address_id,
            date: new Date(moment().format("YYYY-MM-DD")),
          });
        }
        await TmpPayment.deleteOne({ _id: tmp_booking.tmp_payment_id._id });
        await TmpBooking.deleteOne({ _id: tmp_booking._id });
        let user = await User.findOne({
          _id: req.payload._id,
        });
        if (user.first_order == false) {
          if (user.reffered_by) {
            let reffered_user = await User.findOne({
              _id: user.reffered_by,
            });
            reffered_user.credits.food =
              parseFloat(reffered_user.credits.food) +
              parseFloat(tmp_booking.orders[0].price);
            await reffered_user.save();
            await SendUserNotification(
              "Your account is credited",
              `${tmp_booking.orders[0].price} $ credited to your account from your referee on his first purchase`,
              "high",
              user.device_token
            );
          }
          if (tmp_booking.delivery_type == "ONLINE") {
            // user.credits.food = parseFloat(user.credits.food) + parseFloat(tmp_booking.orders[0].price)
            user.first_order = true;
            await user.save();
            // await SendUserNotification(
            // 	"Your account is credited",
            // 	"Your account has been credited with " + tmp_booking.orders[0].price + " for your first order",
            // 	"high",
            // 	user.device_token
            // )
          } else {
            user.first_order = true;
            await user.save();
          }
        }
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        await SendUserNotification(
          "Your Order Placed",
          "Your order has been placed",
          "high",
          user.device_token
        );

        // sendOrderConfirm.add({
        //   booking_id: saved_booking._id,
        //   total: total_amount,
        //   name: user.name,
        //   email: user.email,
        // });

        await neworder_confirmed({
          name: user.name,
          to_email: user.email,
          order_id: saved_booking._id
        })
        // await order_confirmed({
        // 	name: user.name,
        // 	email: user.email,
        // 	amount: total_amount
        // })
        let b_id = saved_booking._id;
        // let allocated_details = await allocateOrder(b_id)
        // return res.json({
        // 	allocated_details
        // })
        return res.json({
          status: true,
          message: "Booking has been confirmed",
          data: {
            booking_id: saved_booking.booking_id,
          },
        });
      } else {
        return res.json({
          status: false,
          message: "Payment details failed to save.!, Please contact admin",
        });
      }
    } else {
      return res.json({
        status: false,
        message: "Sorrry something went wrong",
      });
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.getAccessories = async (req, res) => {
  try {
    // let accessories = await Product.find({
    // 	type: 'ACCESSORIES',
    // 	delete_status: false,
    // }, {
    // 	name: 1,
    // 	image: 1,
    // 	cover_pic: 1,
    // 	description: 1,
    // 	price: 1,
    // })
    // return res.json({
    // 	status: true,
    // 	data: accessories
    // })
    let { shifts, coming_shift } = await this.getComingShift();
    let active_address = await Address.findOne(
      {
        user_id: req.payload._id,
        delete_status: false,
        active_location: true,
      },
      {
        created_at: 0,
        updates_at: 0,
        delete_status: 0,
        __v: 0,
      }
    );
    let accessories = await Product.aggregate([
      {
        $match: {
          type: "ACCESSORIES",
          delete_status: false,
        },
      },
      {
        $lookup: {
          from: "stocks",
          let: {
            shift_id: ObjectId(coming_shift),
            product_id: "$_id",
            suburb_id: active_address.suburb_id,
          },
          pipeline: [
            {
              $match: {
                type: "DELIVERY",
                date: new Date(moment().format("YYYY-MM-DD")),
                $expr: {
                  $and: [
                    {
                      $eq: ["$$shift_id", "$shift_id"],
                    },
                    {
                      $in: ["$$product_id", "$products.product_id"],
                    },
                    {
                      $eq: ["$suburb_id", "$$suburb_id"],
                    },
                  ],
                },
              },
            },
          ],
          as: "stocks",
        },
      },
      {
        $unwind: {
          path: "$stocks",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          cover_pic: 1,
          name: 1,
          price: 1,
          description: 1,
          image: 1,
          stocks: 1,
          is_veg: 1,
          allergen_contents: 1,
          stock_details: {
            $filter: {
              // input: "$stocks.products",
              input: "$stocks.initial_stock",
              as: "stock",
              cond: {
                $eq: ["$$stock.product_id", "$_id"],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          cover_pic: 1,
          name: 1,
          price: 1,
          description: 1,
          image: 1,
          is_veg: 1,
          allergen_contents: 1,
          delivery_stock: {
            $arrayElemAt: ["$stock_details", 0],
          },
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            cover_pic: "$cover_pic",
            name: "$name",
            price: "$price",
            description: "$description",
            image: "$image",
            allergen_contents: "$allergen_contents",
          },
          details: {
            $push: {
              is_veg: "$is_veg",
            },
          },
          total_delivery_stock: {
            $sum: "$delivery_stock.stock",
          },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          cover_pic: "$_id.cover_pic",
          name: "$_id.name",
          price: "$_id.price",
          description: "$_id.description",
          image: "$_id.image",
          allergen_contents: "$_id.allergen_contents",
          is_veg: {
            $arrayElemAt: ["$details", 0],
          },
          total_delivery_stock: "$total_delivery_stock",
        },
      },
      {
        $project: {
          _id: 1,
          cover_pic: 1,
          name: 1,
          price: 1,
          description: 1,
          image: 1,
          is_veg: "$is_veg.is_veg",
          total_delivery_stock: 1,
          allergen_contents: 1,
        },
      },

      /////////////////////////Count checking with orders ///////////////////////////////////////////
      {
        $lookup: {
          from: "bookings",
          let: {
            product_id: "$_id",
            suburb_id: active_address.suburb_id,
          },
          pipeline: [
            {
              $match: {
                scheduled_date: new Date(moment().format("YYYY-MM-DD")),
                delivery_type: "ONLINE",
                shift_id: ObjectId(coming_shift),
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: {
                  address_id: "$address_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$$address_id", "$_id"],
                      },
                    },
                  },
                  {
                    $project: {
                      suburb_id: 1,
                    },
                  },
                ],
                as: "address",
              },
            },
            {
              $addFields: {
                address: {
                  $arrayElemAt: ["$address", 0],
                },
              },
            },
            {
              $match: {
                "address.suburb_id": active_address.suburb_id,
              },
            },
            {
              $unwind: "$orders",
            },
            {
              $match: {
                $expr: {
                  $eq: ["$orders.product_id", "$$product_id"],
                },
              },
            },
            {
              $project: {
                orders: 1,
              },
            },
            {
              $group: {
                _id: null,
                tot_quantity: {
                  $sum: "$orders.quantity",
                },
              },
            },
          ],
          as: "booked_orders",
        },
      },
      {
        $addFields: {
          booked_orders: {
            $arrayElemAt: ["$booked_orders", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          cover_pic: 1,
          name: 1,
          price: 1,
          description: 1,
          image: 1,
          // booked_orders: 1,
          total_delivery_stock: 1,
          stock_left: {
            $subtract: ["$total_delivery_stock", "$booked_orders.tot_quantity"],
          },
        },
      },
      {
        $addFields: {
          total_delivery_stock: {
            $cond: {
              if: {
                $eq: ["$stock_left", null],
              },
              then: "$total_delivery_stock",
              else: "$stock_left",
            },
          },
        },
      },
    ]);
    return res.json({
      status: true,
      data: accessories,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};
