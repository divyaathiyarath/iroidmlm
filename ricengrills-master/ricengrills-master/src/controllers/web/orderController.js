const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const moment = require("moment");
const Settings = mongoose.model("settings");
const User = mongoose.model("users");
const Booking = mongoose.model("bookings");
const Payment = mongoose.model("payments");
let { getComingShift } = require("./cartController");

exports.getOrdersList = async (req, res) => {
  try {
    let today = new Date(moment().format("YYYY-MM-DD"));
    let { current_shift } = await getComingShift();
    let bookings = await Booking.aggregate([
      {
        $match: {
          // delivery_type: 'ONLINE',
          delete_status: false,
          // redeemed: {
          //     $ne: true
          // },
          booking_type: {
            $in: ["REALTIME", "SCHEDULED"],
          },
          user_id: ObjectId(req.session._id),
          scheduled_date: {
            $lte: new Date(moment().format("YYYY-MM-DD")),
          },
        },
      },
      {
        $addFields: {
          order_active: {
            $cond: {
              if: {
                $and: [
                  {
                    $eq: [
                      "$scheduled_date",
                      new Date(moment().format("YYYY-MM-DD")),
                    ],
                  },
                  { $eq: ["$shift_id", ObjectId(current_shift)] },
                  { $gt: ["$driver_id", null] },
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $lookup: {
          from: "settings",
          let: {
            shift_id: "$shift_id",
          },
          pipeline: [
            {
              $unwind: "$shift_times",
            },
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$$shift_id", "$shift_times._id"] }],
                },
              },
            },
            {
              $project: {
                _id: "$shift_times._id",
                name: "$shift_times.name",
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
        $sort: {
          scheduled_date: -1,
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
                  $eq: ["$_id", "$$address_id"],
                },
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
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$orders.product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
            {
              $project: {
                type: "$type",
                name: "$name",
              },
            },
          ],
          as: "product_detail",
        },
      },
      {
        $addFields: {
          product_detail: {
            $arrayElemAt: ["$product_detail", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          redeemed: 1,
          can_cancel: {
            $cond: {
              if: { $lt: [today, "$scheduled_date"] },
              then: true,
              else: false,
            },
          },
          expired: {
            $cond: {
              if: {
                $and: [
                  { $lt: ["$scheduled_date", today] },
                  { $eq: [false, "$redeemed"] },
                ],
              },
              then: true,
              else: false,
            },
          },
          booking_type: 1,
          scheduled_date: 1,
          created_at: 1,
          booking_id: 1,
          user_id: 1,
          delivery_type: 1,
          address_id: 1,
          address: 1,
          shift_id: 1,
          shift: 1,
          orders: {
            product_id: 1,
            product_name: "$product_detail.name",
            quantity: 1,
            type: "$product_detail.type",
          },
          qr_code: 1,
          order_active: 1,
          company_id: 1,
        },
      },
      {
        $group: {
          _id: "$_id",
          booking_type: {
            $first: "$booking_type",
          },
          scheduled_date: {
            $first: "$scheduled_date",
          },
          created_at: {
            $first: "$created_at",
          },
          booking_id: {
            $first: "$booking_id",
          },
          user_id: {
            $first: "$user_id",
          },
          delivery_type: {
            $first: "$delivery_type",
          },
          address_id: {
            $first: "$address_id",
          },
          address: {
            $first: "$address",
          },
          shift_id: {
            $first: "$shift_id",
          },
          shift: {
            $first: "$shift",
          },
          qr_code: {
            $first: "$qr_code",
          },
          redeemed: {
            $first: "$redeemed",
          },
          orders: {
            $push: "$orders",
          },
          can_cancel: {
            $first: "$can_cancel",
          },
          expired: {
            $first: "$expired",
          },
          order_active: {
            $first: "$order_active",
          },
          company_id: {
            $first: "$company_id",
          }
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);
    return res.json({
      status: true,
      bookings,
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: true,
      bookings: [],
    });
  }
};

exports.getScheduledList = async (req, res) => {
  try {
    let setting = await Settings.findOne();
    let min_schedule_hour = 0;
    if (setting.min_schedule_hour) {
      min_schedule_hour = setting.min_schedule_hour;
    }
    let offset = Math.abs(new Date().getTimezoneOffset());
    let today = moment().format("YYYY-MM-DD");
    let cur_date = moment()
      .utcOffset(+offset)
      .format("YYYY-MM-DD HH:mm:ss");

    let { shift } = req.query;
    let bookings = await Booking.aggregate([
      {
        $match: {
          shift_id: ObjectId(shift),
          delete_status: false,
          redeemed: {
            $ne: true,
          },
          booking_type: "SCHEDULED",
        },
      },
      {
        $match: {
          user_id: ObjectId(req.session._id),
        },
      },
      {
        $sort: {
          created_at: -1,
        },
      },
      {
        $lookup: {
          from: "settings",
          let: {
            shift_id: "$shift_id",
            scheduled_date: "$scheduled_date",
          },
          pipeline: [
            {
              $unwind: "$shift_times",
            },
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$$shift_id", "$shift_times._id"] }],
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
              $addFields: {
                date_difference: {
                  $subtract: ["$start", "$current_date"],
                },
              },
            },
            {
              $addFields: {
                can_cancel: {
                  $cond: {
                    if: {
                      $or: [
                        {
                          $and: [
                            {
                              $gte: [
                                "$date_difference",
                                (3600000 * min_schedule_hour),
                              ],
                            },
                            {
                              $gte: ["$$scheduled_date", new Date(today)],
                            },
                          ]
                        },
                        {
                          $gt: ["$$scheduled_date", new Date(today)],
                        }
                      ],
                    },
                    then: true,
                    else: false,
                  },
                },
              },
            },
          ],
          as: "shift",
        },
      },
      {
        $addFields: {
          can_cancel: {
            $arrayElemAt: ["$shift.can_cancel", 0],
          },
          shift: {
            $arrayElemAt: ["$shift", 0],
          },
        },
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
                  $eq: ['$_id', '$$payment_id']
                }
              }
            },
            {
              $project: {
                discount_price: 1
              }
            }
          ],
          as: "payment"
        }
      },
      {
        $addFields: {
          payment: {
            $arrayElemAt: ["$payment", 0]
          }
        }
      },
      {
        $addFields: {
          can_edit: {
            $cond: { if: { $and: [{ $eq: ["$can_cancel", true] }, { $lte: ["$payment.discount_price", 0] }] }, then: true, else: false }
          }
        }
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
                  $eq: ["$_id", "$$address_id"],
                },
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
        $unwind: "$orders",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$orders.product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
            {
              $project: {
                type: "$type",
                name: "$name",
              },
            },
          ],
          as: "product_detail",
        },
      },
      {
        $addFields: {
          product_detail: {
            $arrayElemAt: ["$product_detail", 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          booking_type: 1,
          scheduled_date: 1,
          can_cancel: 1,
          can_edit: 1,
          expired: {
            $cond: {
              if: {
                $and: [
                  { $lt: ["$scheduled_date", today] },
                  { $eq: [false, "$redeemed"] },
                ],
              },
              then: true,
              else: false,
            },
          },
          created_at: 1,
          booking_id: 1,
          user_id: 1,
          delivery_type: 1,
          address_id: 1,
          address: 1,
          shift_id: 1,
          shift: 1,
          company_id: 1,
          orders: {
            product_id: 1,
            product_name: "$product_detail.name",
            quantity: 1,
            type: "$product_detail.type",
          },
          qr_code: 1,
          redeemed: 1,
        },
      },
      {
        $group: {
          _id: "$_id",
          booking_type: {
            $first: "$booking_type",
          },
          scheduled_date: {
            $first: "$scheduled_date",
          },
          created_at: {
            $first: "$created_at",
          },
          booking_id: {
            $first: "$booking_id",
          },
          user_id: {
            $first: "$user_id",
          },
          delivery_type: {
            $first: "$delivery_type",
          },
          address_id: {
            $first: "$address_id",
          },
          address: {
            $first: "$address",
          },
          shift_id: {
            $first: "$shift_id",
          },
          shift: {
            $first: "$shift",
          },
          qr_code: {
            $first: "$qr_code",
          },
          redeemed: {
            $first: "$redeemed",
          },
          orders: {
            $push: "$orders",
          },
          can_cancel: {
            $first: "$can_cancel",
          },
          can_edit: {
            $first: "$can_edit",
          },
          company_id: {
            $first: "$company_id",
          },
          expired: {
            $first: "$expired",
          },
        },
      },
      {
        $sort: {
          _id: -1,
        },
      },
    ]);
    return res.json({
      status: true,
      bookings,
    });
  } catch (err) {
    console.log({ err });
    return res.json({
      status: true,
      bookings: [],
    });
  }
};

exports.cancelScheduledOrder = async (req, res) => {
  try {
    let { _id } = req.body;
    if (typeof _id === "undefined") {
      return res.json({
        status: false,
        message: "Id is required",
      });
    }
    let booking = await Booking.findOne({
      _id,
      booking_type: "SCHEDULED",
      user_id: req.session._id,
      delete_status: false,
      redeemed: false,
      scheduled_date: {
        $gt: new Date(moment().format("YYYY-MM-DD")),
      },
    });
    if (booking) {
      let payment = await Payment.findOne({
        _id: ObjectId(booking.payment_id),
      });
      let total_credits = 0;
      let discount_price = 0;
      if (payment) {
        total_credits = payment.total_price;
      }
      let user = await User.findOne({
        _id: req.session._id,
      });
      user.credits.food = user.credits.food + +total_credits;
      await user.save();
      await booking.delete();
      return res.json({
        status: true,
        message: "Scheduled order has been cancelled",
      });
    } else {
      return res.json({
        status: false,
        message: "Could not cancel scheduled order at this time",
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
