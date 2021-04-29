const mongoose = require("mongoose");
const moment = require("moment");
let ObjectId = mongoose.Types.ObjectId;
let User = mongoose.model("users");
let Product = mongoose.model("products");
let Setting = mongoose.model("settings");
let Address = mongoose.model("addresses");
let Suburb = mongoose.model("suburbs");
let Coupon = mongoose.model("coupons");
let CP = mongoose.model("collectionpoints");
let TmpCredit = mongoose.model("tmp_credits");
let Booking = mongoose.model("bookings");
let Payment = mongoose.model("payments");
let Credit = mongoose.model("credits");
let TmpPayment = mongoose.model("tmp_payments");
let TmpBooking = mongoose.model("tmp_bookings");
let StockLimit = mongoose.model("scheduled_stock_limits");
let Company = mongoose.model("companies")
let QRCode = require("qrcode");
let { sendOrderConfirm } = require('../../jobs/notification')
let config = require("config");
let _ = require("underscore");
const { session } = require("passport");
let { createCredit, createOrder } = require("./paymentController");
let { getComingShift } = require("./cartController");
const { response } = require("express");
const suburbs = require("../../models/suburbs");
const { format } = require("path");

async function getDataUrl(str) {
  return QRCode.toDataURL(str, { errorCorrectionLevel: "M" });
}

async function checkScheduledLimit(
  orders,
  shift_id,
  scheduled_date,
  suburb_id
) {
  let stocklimit = await StockLimit.aggregate([
    {
      $match: {
        shift_id: ObjectId(shift_id),
        suburb_id: ObjectId(suburb_id),
        delete_status: false,
      },
    },
    {
      $project: {
        _id: "$product_id",
        limit: 1,
      },
    },
  ]);

  let scheduledorders = await Booking.aggregate([
    {
      $match: {
        booking_type: "SCHEDULED",
        delete_status: false,
        shift_id: ObjectId(shift_id),
        scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
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
                $and: [{ $eq: ["$_id", "$$address_id"] }],
              },
            },
          },
          {
            $project: {
              suburb_id: 1,
            },
          },
        ],
        as: "suburb",
      },
    },
    {
      $addFields: {
        suburb_id: {
          $arrayElemAt: ["$suburb.suburb_id", 0],
        },
      },
    },
    {
      $match: {
        suburb_id: ObjectId(suburb_id),
      },
    },
    {
      $project: {
        orders: 1,
      },
    },
    {
      $unwind: "$orders",
    },
    {
      $project: {
        _id: "$orders.product_id",
        quantity: "$orders.quantity",
      },
    },
    {
      $group: {
        _id: "$_id",
        quantity: {
          $sum: "$quantity",
        },
      },
    },
  ]);

  //check products with stock limits
  stock_limit_products = [];
  let stock_check = true;

  orders.forEach((order) => {
    let { product_id, quantity } = order;
    let stock_limit = 0;
    let booking_stock = 0;
    let limit_exists = false;

    let limit = _.find(stocklimit, function (rec) {
      return rec._id.toString() === product_id;
    });

    if (limit) {
      limit_exists = true;
      stock_limit = limit.limit;
      var booked_stock = _.find(scheduledorders, function (rec) {
        return rec._id.toString() === product_id;
      });
      if (booked_stock) {
        let { quantity: booked_quantity } = booked_stock;
        booking_stock = booked_quantity;
      }
      if (+stock_limit - booking_stock < +quantity) {
        stock_check = false;
      }
    }
  });
  return stock_check;
}

async function getShiftName(shift_id) {
  if (!shift_id) {
    return "";
  }
  let shift = await Setting.aggregate([
    {
      $unwind: "$shift_times",
    },
    {
      $project: {
        _id: "$shift_times._id",
        name: "$shift_times.name",
      },
    },
    {
      $match: {
        _id: ObjectId(shift_id),
      },
    },
  ]);
  shift = await shift.shift();
  return shift.name;
}

exports.schedule = async (req, res) => {
  if (!req.session._id || req.session.role != "user") {
    return res.redirect(res.locals.app_url + "/login");
  }
  let { shifts } = await getComingShift();
  let user = await User.findOne({ _id: ObjectId(req.session._id) });
  let food_credits = 0;
  if (typeof user.credits != "undefined" && user.credits) {
    let { food } = user.credits;
    if (typeof food != "undefined" && food) {
      food_credits = food;
    }
  }
  return res.render("web/schedule", {
    food_credits,
    shifts,
  });
};

exports.addCredit = async (req, res) => {
  let setting = await Setting.findOne();
  let { food } = req.body;
  try {
    if (food) {
      let credit = new TmpCredit({
        user_id: ObjectId(req.session._id),
        price: food,
      });
      await credit.save();
      let data = await createCredit({
        food,
        booking_id: credit._id,
        user_id: req.session._id,
        app_url: res.locals.app_url,
      });
      let { checkout } = data;
      if (typeof checkout == "undefined" || !checkout) {
        throw new Error("Payment error");
      }
      let {
        id: checkout_id,
        checkout_page_url: payment_page,
        order: { id: order_id },
      } = checkout;
      if (typeof payment_page == undefined || !payment_page) {
        throw new Error("Payment error");
      } else {
        credit.checkout_id = checkout_id;
        credit.order_id = order_id;
        await credit.save();
        req.session.cart = [];
        req.session.accessories = [];
        return res.json({
          status: true,
          message: "Booking has been saved",
          payment_page,
        });
      }
    } else {
      throw new Error("No amount selected");
    }
  } catch (error) {
    console.log(error);
    return res.json({
      status: false,
      message: "Could not process payment",
    });
  }
};

async function getAddressesByUser(data) {
  let { user_id, delivery_address } = data
  let active_suburb = ""
  let selected_address = ""
  let office_address = ""

  let user_addresses = await Address.aggregate([
    {
      $match: {
        user_id: ObjectId(user_id),
        delete_status: false
      }
    },
    {
      $sort: {
        active_location: 1
      }
    }
  ])

  active_suburb = user_addresses[0].suburb_id

  let collectionpoints = await CP.aggregate([
    {
      $match: {
        approved: true,
        delete_status: false,
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
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$delete_status", false] }
                ]
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
      $project: {
        _id: "$address._id",
        name: 1,
        location: "$address.location",
        type: "$address.type",
        address_line1: "$address.address_line1",
        address_line2: "$address.address_line2",
        house_flat_no: "$address.house_flat_no",
        appartment: "$address.appartment",
        landmark: "$address.landmark",
        to_reach: "$address.to_reach",
        suburb_id: "$address.suburb_id",
      }
    }
  ])

  selected_address = collectionpoints[0]
  // if (delivery_address) {
  //   let address = await Address.findOne({
  //     _id: ObjectId(delivery_address)
  //   }).lean().exec()

  //   if (address && address.type == 'COLLECTIONPOINT') {
  //     let collectionpoint = await CP.findOne({ _id: ObjectId(address.collectionpoint_id) })
  //     if (collectionpoint) {
  //       selected_address = address
  //       selected_address.name = collectionpoint.name
  //     }
  //   } else {
  //     selected_address = address
  //   }
  // }

  if (user_id) {
    let user = await User.findOne({ _id: ObjectId(user_id) })
    if (user.company_id) {
      company = await Company.findOne({ _id: ObjectId(user.company_id) })
      if (company) {
        let address = await Address.findOne({ company_id: ObjectId(company._id) }).lean().exec()
        if (address) {
          office_address = address
          office_address.name = company.name
        }
      }
    }
  }

  return {
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
    office_address
  }
}

exports.scheduledBooking = async (req, res) => {
  let { shifts } = await getComingShift();
  let setting = await Setting.findOne();
  let gst = setting.gst;
  let service_charge_square = setting.service_charge_square;
  let service_charge_paypal = setting.service_charge_paypal;
  let delivery_charge = setting.delivery_charge;
  if (!req.session._id || !req.session.role == "user") {
    return res.redirect(res.locals.app_url + "/login");
  }

  let user = await User.findOne({ _id: ObjectId(req.session._id) });
  let food_credits = 0;
  if (user && typeof user.credits != "undefined") {
    let { food } = user.credits;
    if (typeof food != "undefined" && food) {
      food_credits = food;
    }
  }

  let delivery_address = req.session.delivery_address;

  let {
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
    office_address
  } = await getAddressesByUser({
    user_id: user._id,
    delivery_address
  })

  delivery_address = selected_address._id

  // return res.json({
  //   selected_address,
  //   delivery_address
  // })

  let suburbs = await Suburb.aggregate([
    {
      $match: {
        delete_status: false,
      },
    },
  ]);

  let companies = await Company.find({ delete_status: false })

  return res.render("web/scheduled_booking", {
    suburbs,
    delivery_address,
    gst,
    shifts,
    food_credits,
    delivery_charge,
    service_charge_square,
    service_charge_paypal,
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
    office_address,
    has_office_address: office_address ? true : false,
    companies
  });
};

exports.scheduledBookingConfirmation = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    let { current_shift } = await getComingShift();
    let shift_id = null;
    let total_item_count = 0;
    let actual_price = 0;
    let discount_price = 0;
    let gst_price = 0;
    let total_price = 0;
    let delivery_type = "COLLECTIONPOINT";
    let gst = setting.gst;
    let service_charge_square = setting.service_charge_square;
    let delivery_charge = setting.delivery_charge;
    let applied_coupon = null;

    let {
      shift,
      products,
      address_id,
      scheduled_date,
      coupon,
      accessories,
    } = req.body;
    if (shift) {
      shift_id = shift;
    } else {
      return res.json({
        status: false,
        message: "Please select shift",
      });
    }

    let address = null;
    if (!address_id) {
      return res.json({
        status: false,
        message: "Please select an address",
      });
    } else {
      address = await Address.findOne({ _id: ObjectId(address_id) });
      if (!address) {
        return res.json({
          status: false,
          message: "Please select an address",
        });
      }
      let { suburb_id } = address;
      if (suburb_id) {
        if (address.type == "USER") {
          let suburb = await Suburb.findOne({ _id: ObjectId(suburb_id) });
          let shift_name = await getShiftName(shift_id);
          if (shift_name != "Dinner" || !suburb) {
            return res.json({
              status: false,
              message: "We dont have delivery service in your suburb",
            });
          } else if (shift_name == "Dinner" && !suburb.has_realtime_order) {
            return res.json({
              status: false,
              message: "We dont have delivery service in your suburb",
            });
          }
        }
      }
    }

    let orders = [];

    for (i = 0; i < products.length; i++) {
      let prod = await Product.findOne({
        _id: ObjectId(products[i].product_id),
      });
      products[i]["price"] = prod.price;
    }

    products.forEach((product) => {
      actual_price += +product.count * +product.price;
      total_item_count += +product.count;
      let details = {
        product_id: product.product_id,
        quantity: product.count,
        price: product.price,
      };
      orders.push(details);
    });

    check_limit = await checkScheduledLimit(
      orders,
      shift_id,
      scheduled_date,
      address.suburb_id
    );

    if (!check_limit) {
      return res.json({
        status: false,
        message: "Some of the products reached the limit for scheduled orders",
        check_limit,
      });
    }

    if (typeof accessories != "undefined") {
      for (i = 0; i < accessories.length; i++) {
        let prod = await Product.findOne({
          _id: ObjectId(accessories[i].product_id),
        });
        actual_price += +accessories[i].count * +prod.price;
        products.push({
          count: accessories[i].count,
          product_id: accessories[i].product_id,
          price: prod.price,
        });
        let details = {
          product_id: accessories[i].product_id,
          quantity: accessories[i].count,
          price: prod.price,
        };
        orders.push(details);
      }
    }

    let tot_delivery_charge = 0;

    if (address.type == "USER") {
      delivery_type = "ONLINE";
      tot_delivery_charge = +delivery_charge * +total_item_count;
      if (total_item_count < 3) {
        return res.json({
          status: false,
          message: "For delivery select atleast 3 products",
        });
      }
    }

    total_price = +actual_price + +tot_delivery_charge;

    // if (gst) {
    //     gst_price = total_price * (gst / 100);
    // }

    total_price += +gst_price;

    let coupon_code = null;
    if (coupon) {
      coupon_code = await Coupon.findOne({
        suburbs: ObjectId(address.suburb_id),
        code: coupon,
        delete_status: false,
        active_status: true,
        count: {
          $gt: 0,
        },
      });
      if (coupon_code) {
        let coupon_used = await Booking.findOne({
          coupon: coupon_code.code,
          user_id: ObjectId(req.session._id),
        }).countDocuments();
        if (!coupon_used) {
          discount_price = total_price * (coupon_code.val / 100);
          total_price -= +discount_price;
          coupon_code.count = coupon_code.count - 1;
          applied_coupon = coupon;
        }
      }
    }

    let service_charge = 0;

    let user = await User.findOne({ _id: req.session._id });
    if (user.credits.food < total_price) {
      if (service_charge_square) {
        service_charge =
          (total_price - user.credits.food) * (service_charge_square / 100);
        console.log(
          `*****************${service_charge}***********************`
        );
      }

      total_price += service_charge;

      let tmp_payment = new TmpPayment({
        user_id: ObjectId(req.session._id),
        date: new Date(moment().format("YYYY-MM-DD")),
        actual_price,
        discount_price,
        gst: gst_price,
        total_price,
        delivery_charge: tot_delivery_charge,
        is_credit: true,
        credit_used: res.locals.food_credits,
        service_charge,
      });

      await tmp_payment.save();

      let company_id = null;
      if (address.type == "OFFICE") {
        if (address.company_id) {
          let company = await Company.findOne({ _id: ObjectId(address.company_id) })
          if (company) {
            company_id = company._id
          }
        }
      }

      let tmp_booking = new TmpBooking({
        address_id: ObjectId(address_id),
        tmp_payment_id: tmp_payment._id,
        user_id: ObjectId(req.session._id),
        booking_type: "SCHEDULED",
        delivery_type,
        shift_id,
        date: new Date(moment(scheduled_date).format("YYYY-MM-DD HH:mm")),
        scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
        orders,
        coupon: applied_coupon
      });

      address.type == "COLLECTION_POINT"
        ? (tmp_booking.collectionpoint_id = address.collectionpoint_id)
        : (tmp_booking.user_id = ObjectId(req.session._id));

      address.type == "OFFICE"
        ? (tmp_booking.company_id = ObjectId(company_id))
        : (tmp_booking.user_id = ObjectId(req.session._id));

      await tmp_booking.save();

      // return res.json({
      //   status: false,
      //   data: req.body,
      //   message: "Could not create order"
      // })

      let data = await createOrder({
        booking_id: tmp_booking._id,
        payment_id: tmp_payment._id,
        app_url: res.locals.app_url,
        first_order_price: 0,
        credit_amount: user.credits.food,
      });

      let { checkout } = data;
      let {
        id: checkout_id,
        checkout_page_url: payment_page,
        order: { id: order_id },
      } = checkout;
      if (typeof payment_page == undefined || !payment_page) {
        await tmp_booking.remove();
        await tmp_payment.remove();
        throw new Error("Payment error");
      } else {
        tmp_payment.checkout_id = checkout_id;
        tmp_payment.order_id = order_id;
        await tmp_payment.save();
        if (coupon_code) await coupon_code.save();
        //req.session.cart = [];
        return res.json({
          status: true,
          message: "Booking has been saved",
          payment_page,
        });
      }
    }

    let last_booking_id = await Booking.findOne(
      {},
      {
        _id: 0,
        booking_id: 1,
      }
    ).sort({ _id: -1 });

    if (last_booking_id) {
      bokid = last_booking_id.booking_id.split("-");
      bk_id = bokid[2];
    } else {
      bk_id = config.SCHEDULED_BOOKING_ID_START;
    }
    let booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
      }`;
    let order = new Booking();
    order.booking_id = booking_id;
    order.user_id = req.session._id;
    order.delivery_type = delivery_type;
    order.address_id = address._id;
    order.collectionpoint_id = address.collectionpoint_id;
    order.scheduled_date = new Date(
      moment(scheduled_date).format("YYYY-MM-DD")
    );
    order.created_at = new Date(moment().format("YYYY-MM-DD HH:mm"));
    order.shift_id = shift_id;
    order.orders = orders;
    order.booking_type = "SCHEDULED";
    order.qrcode = await getDataUrl(booking_id);
    order.coupon = applied_coupon;

    let company_id = null;
    if (address.type == "OFFICE") {
      if (address.company_id) {
        let company = await Company.findOne({ _id: ObjectId(address.company_id) })
        if (company) {
          company_id = company._id
        }
      }
    }

    address.type == "OFFICE"
      ? (order.company_id = ObjectId(company_id))
      : (order.user_id = ObjectId(req.session._id));


    let payment = new Payment({
      user_id: req.session._id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price,
      discount_price,
      gst: gst_price,
      total_price,
      delivery_charge: tot_delivery_charge,
      is_credit: true,
      credit_used: total_price,
      service_charge,
    });

    await payment.save();
    order.payment_id = payment._id;
    await order.save();

    user.credits.food = user.credits.food - +total_price;
    await user.save();
    if (coupon_code) await coupon_code.save();

    sendOrderConfirm.add({
      booking_id: order._id,
      total: payment.total_price,
      name: user.name,
      email: user.email,
    });

    return res.json({
      status: true,
      message: "Your order has been placed",
    });
  } catch (err) {
    console.log(err);
    if (typeof payment != "undefined") {
      await Payment.deleteOne({
        _id: payment._id,
      });
    }
    if (typeof order != "undefined") {
      await Booking.deleteOne({
        _id: order._id,
      });
    }
    return res.json({
      status: false,
      message: "Scheduled order failed",
    });
  }
};

let getPriceDetails = async (data) => {
  let { products, accessories, order_id } = data

  let setting = await Setting.findOne();
  let delivery_type = "COLLECTIONPOINT";
  let delivery_charge = setting.delivery_charge;  
  let gst = setting.gst;
  let service_charge_square = setting.service_charge_square;
  let applied_coupon = null;

  let address = null;

  let booking = await Booking.findOne({ _id: ObjectId(order_id) });
  let payment = await Payment.findOne({ _id: ObjectId(booking.payment_id) });

  if (!address_id) {
    return res.json({
      status: false,
      message: "Please select an address",
    });
  } else {
    address = await Address.findOne({ _id: ObjectId(address_id) });
    if (!address) {
      return res.json({
        status: false,
        message: "Please select an address",
      });
    }
  }
  
  return {
    products,
    accessories,
    order_id
  }

}

exports.updateScheduleBooking = async (req, res) => {
  try {
    let total_item_count = 0;
    let actual_price = 0;
    let discount_price = 0;
    let gst_price = 0;
    let total_price = 0;
    let delivery_type = "COLLECTIONPOINT";
    let applied_coupon = null;
    let address = null;
    let { products, accessories, order_id, shift: shift_id, address_id, scheduled_date } = req.body;

    data = await getPriceDetails({products,accessories,order_id});
    return res.json(data)

    let gst = setting.gst;
    let service_charge_square = setting.service_charge_square;

    let booking = await Booking.findOne({ _id: ObjectId(order_id) });

    let payment = await Payment.findOne({ _id: ObjectId(booking.payment_id) });

    let { shift: shift_id, address_id, scheduled_date } = req.body
    let { booking_id } = booking;
    let { total_price: paid_price, discount_price: discount } = payment;
    if (!booking) {
      return res.json({
        status: false,
        message: "Could not update scheduled booking",
      });
    }

    let address = null;
    if (!address_id) {
      return res.json({
        status: false,
        message: "Please select an address",
      });
    } else {
      address = await Address.findOne({ _id: ObjectId(address_id) });
      if (!address) {
        return res.json({
          status: false,
          message: "Please select an address",
        });
      }
    }


    if (!shift_id) {
      return res.json({
        status: false,
        message: "Please select shift",
      });
    }


    let company_id = null;
    if (address.type == "OFFICE") {
      if (address.company_id) {
        let company = await Company.findOne({ _id: ObjectId(address.company_id) })
        if (company) {
          company_id = company._id
        }
      }
    }

    let orders = [];

    for (i = 0; i < products.length; i++) {
      let prod = await Product.findOne({
        _id: ObjectId(products[i].product_id),
      });
      products[i]["price"] = prod.price;
    }

    products.forEach((product) => {
      actual_price += +product.count * +product.price;
      total_item_count += +product.count;
      let details = {
        product_id: product.product_id,
        quantity: product.count,
        price: product.price,
      };
      orders.push(details);
    });

    if (typeof accessories != "undefined") {
      for (i = 0; i < accessories.length; i++) {
        let prod = await Product.findOne({
          _id: ObjectId(accessories[i].product_id),
        });
        actual_price += +accessories[i].count * +prod.price;
        products.push({
          count: accessories[i].count,
          product_id: accessories[i].product_id,
          price: prod.price,
        });
        let details = {
          product_id: accessories[i].product_id,
          quantity: accessories[i].count,
          price: prod.price,
        };
        orders.push(details);
      }
    }

    let tot_delivery_charge = 0;
    if (address.type == "USER") {
      delivery_type = "ONLINE";
      tot_delivery_charge = +delivery_charge * +total_item_count;
      if (total_item_count < 3) {
        return res.json({
          status: false,
          message: "For delivery select atleast 3 products",
        });
      }
    }

    total_price = +actual_price + +tot_delivery_charge;

    let user = await User.findOne({ _id: req.session._id });

    let service_charge = 0;

    if (+paid_price + +discount + +user.credits.food < total_price) {
      if (service_charge_square) {
        service_charge =
          (total_price - user.credits.food) * (service_charge_square / 100);
      }
      total_price += service_charge;

      let tmp_payment = new TmpPayment({
        user_id: req.session._id,
        date: new Date(moment().format("YYYY-MM-DD")),
        actual_price,
        discount_price: discount,
        gst: gst_price,
        total_price,
        delivery_charge: tot_delivery_charge,
        is_credit: true,
        credit_used: +paid_price + +discount + +user.credits.food,
        service_charge,
      });

      await tmp_payment.save();

      let tmp_booking = new TmpBooking({
        address_id: ObjectId(address_id),
        tmp_payment_id: tmp_payment._id,
        user_id: ObjectId(req.session._id),
        booking_type: "SCHEDULED",
        delivery_type,
        shift_id,
        date: new Date(moment().format("YYYY-MM-DD HH:mm")),
        scheduled_date: new Date(moment(scheduled_date).format("YYYY-MM-DD")),
        orders,
        booking_id,
      });

      address.type == "COLLECTION_POINT"
        ? (tmp_booking.collectionpoint_id = address.collectionpoint_id)
        : (tmp_booking.user_id = ObjectId(req.session._id));

      address.type == "OFFICE"
        ? (tmp_booking.company_id = ObjectId(company_id))
        : (tmp_booking.user_id = ObjectId(req.session._id));

      await tmp_booking.save();

      let data = await createOrder({
        booking_id: tmp_booking._id,
        payment_id: tmp_payment._id,
        app_url: res.locals.app_url,
        first_order_price: 0,
        credit_amount: +paid_price + +discount + +user.credits.food,
      });

      let { checkout } = data;
      let {
        id: checkout_id,
        checkout_page_url: payment_page,
        order: { id: order_id },
      } = checkout;

      if (typeof payment_page == undefined || !payment_page) {
        await tmp_booking.remove();
        await tmp_payment.remove();
        throw new Error("Payment error");
      } else {
        tmp_payment.checkout_id = checkout_id;
        tmp_payment.order_id = order_id;
        await tmp_payment.save();
        return res.json({
          status: true,
          message: "Booking has been saved",
          payment_page,
        });
      }
    }

    let creditamount = 0;
    console.log({
      total_price,
      paid_price,
      discount
    })
    if (+total_price - discount > +paid_price) {
      //add items
      console.log("***********in add items*******");
      creditamount = -(total_price - discount - paid_price);
      discount_price = discount;
    } else if (+total_price - discount < +paid_price) {
      //remove items
      console.log("***********in remove items*******");
      creditamount = 0;
      let difference = +paid_price - (+total_price - +discount);

      if (difference >= discount) {
        console.log(
          "greater" + difference + " " + total_price + " " + paid_price
        );
        discount_price = 0;
        creditamount = difference - discount;
      } else {
        console.log("lesser " + difference);
        discount_price = discount - difference;
        creditamount = 0;
      }

    } else {
      discount_price = discount;
    }

    if (discount_price) {
      total_price -= +discount_price;
    }

    let order = new Booking();
    order.booking_id = booking_id;
    order.user_id = ObjectId(req.session._id);
    order.delivery_type = delivery_type;
    order.address_id = ObjectId(address._id);
    order.collectionpoint_id = address.collectionpoint_id;
    order.scheduled_date = new Date(
      moment(scheduled_date).format("YYYY-MM-DD")
    );
    order.created_at = new Date(moment().format("YYYY-MM-DD HH:mm"));
    order.shift_id = shift_id;
    order.orders = orders;
    order.booking_type = "SCHEDULED";
    order.qrcode = await getDataUrl(booking_id);
    order.coupon = applied_coupon;
    delivery_type == "ONLINE"
      ? (order.address_id = address._id)
      : (order.collectionpoint_id = address.collectionpoint_id);
    address.type == "OFFICE"
      ? (order.company_id = ObjectId(company_id))
      : (order.user_id = ObjectId(req.session._id));

    if (service_charge_square) {
      service_charge =
        (total_price - user.credits.food) * (service_charge_square / 100);
    }
    total_price += service_charge;

    newpayment = new Payment({
      user_id: req.session._id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price,
      discount_price,
      gst: gst_price,
      total_price,
      delivery_charge: tot_delivery_charge,
      is_credit: true,
      credit_used: total_price,
      service_charge
    });

    await newpayment.save();
    order.payment_id = newpayment._id;
    await order.save();

    console.log({ creditamount })
    user.credits.food = user.credits.food + creditamount;
    await user.save();

    await Payment.deleteOne({ _id: ObjectId(payment._id) });
    await Booking.deleteOne({ _id: ObjectId(booking._id) });

    return res.json({
      status: true,
      message: "Your order has been placed",
    });
  } catch (err) {
    console.log(err);
    if (typeof payment != "undefined") {
      await Payment.deleteOne({
        _id: payment._id,
      });
    }
    if (typeof order != "undefined") {
      await Booking.deleteOne({
        _id: order._id,
      });
    }
    return res.json({
      status: false,
      message: "Scheduled order failed",
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  let { order_id } = req.query;
  let booking = await Booking.findOne({ _id: ObjectId(order_id) });
  payment = await Payment.findOne({ _id: ObjectId(booking.payment_id) });
  return res.json({
    booking,
    payment,
  });
};

exports.editOrder = async (req, res) => {
  let { id } = req.params;
  let { shifts } = await getComingShift();
  let setting = await Setting.findOne();
  let gst = setting.gst;
  let service_charge_square = setting.service_charge_square;
  let delivery_charge = setting.delivery_charge;
  if (!req.session._id || !req.session.role == "user") {
    return res.redirect(res.locals.app_url + "/login");
  }

  let user = await User.findOne({ _id: ObjectId(req.session._id) });
  let food_credits = 0;
  if (user && typeof user.credits != "undefined") {
    let { food } = user.credits;
    if (typeof food != "undefined" && food) {
      food_credits = food;
    }
  }

  let delivery_address = req.session.delivery_address;

  let order = await Booking.findOne({ _id: ObjectId(id) });
  if (order) {
    delivery_address = order.address_id //change delivery address if has order id
  } else {
    return res.redirect(res.locals.app_url + "/schdeuled");
  }

  let {
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
    office_address
  } = await getAddressesByUser({
    user_id: user._id,
    delivery_address
  })

  delivery_address = selected_address._id

  if (typeof delivery_address == "undefined" || !delivery_address) {
    let active_address = await Address.findOne({
      user_id: ObjectId(req.session._id),
      delete_status: false,
      // active_location: true
    });
    if (active_address) {
      delivery_address = active_address._id;
    } else {
      delivery_address = null;
    }
  }

  let addresses = await Address.find({
    user_id: ObjectId(req.session._id),
    delete_status: false,
  });

  let suburbs = await Suburb.aggregate([
    {
      $match: {
        delete_status: false,
      },
    },
  ]);

  let companies = await Company.find({ delete_status: false })

  return res.render("web/editscheduled", {
    suburbs,
    delivery_address,
    gst,
    addresses,
    shifts,
    food_credits,
    delivery_charge,
    order_id: id,
    service_charge_square,
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
    office_address,
    has_office_address: office_address ? true : false,
    companies
  });
};

exports.getShiftsByDate = async (req, res) => {
  let setting = await Setting.findOne()
  let min_schedule_hour = 0
  if (setting.min_schedule_hour) {
    min_schedule_hour = setting.min_schedule_hour
  }
  let offset = Math.abs(new Date().getTimezoneOffset());
  let { date } = req.query;
  let today = moment().format("YYYY-MM-DD");
  let cur_date = moment()
    .utcOffset(+offset)
    .format("YYYY-MM-DD HH:mm");

  if (moment(date).format("YYYY-MM-DD") == moment().format("YYYY-MM-DD")) {
    shifts = await Setting.aggregate([
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
        $addFields: {
          date_difference: {
            $subtract: [
              '$start', '$current_date'
            ]
          }
        }
      },
      {
        $match: {
          date_difference: {
            $gte: 3600000 * min_schedule_hour
          }
        }
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
    //return remaining shifts
    return res.json({
      status: true,
      shifts,
    });
  } else {
    shifts = await Setting.aggregate([
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
        $sort: {
          start: 1,
        },
      },
    ]);

    //return all shifts
    return res.json({
      status: true,
      shifts,
    });
  }
};

exports.checkScheduledTypesbyShift = async (req, res) => {
  let { shift: shift_id } = req.query
  let shiftdetails = await Setting.aggregate([
    {
      $unwind: "$shift_times"
    },
    {
      $project: {
        _id: "$shift_times._id",
        name: "$shift_times.name",
      }
    },
    {
      $match: {
        _id: ObjectId(shift_id)
      }
    }
  ])
  let shift = ""
  if (shiftdetails.length > 0) {
    shift = shiftdetails[0]
  }

  if (shift.name == "Dinner") {
    return res.json({
      status: true,
    })
  } else {
    return res.json({
      status: false,
    })
  }

}
