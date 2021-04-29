const mongoose = require("mongoose");
const moment = require("moment");
const ObjectId = mongoose.Types.ObjectId;
const QRCode = require("qrcode");
const config = require("config");

let TmpPayment = mongoose.model("tmp_payments");
let TmpBooking = mongoose.model("tmp_bookings");
let Booking = mongoose.model("bookings");
let Setting = mongoose.model("settings");
let Credit = mongoose.model("credits");
let User = mongoose.model("users");
let TmpCredit = mongoose.model("tmp_credits");
let Payment = mongoose.model("payments");
let Address = mongoose.model("addresses");
let Driver = mongoose.model("drivers");
let BookingSlot = mongoose.model("booking_slots");
let Transaction = mongoose.model("transactions");
const PayPal = require("@paypal/checkout-server-sdk");

const {
  addCreditByReferal,
  sendOrderConfirm,
} = require("../../jobs/notification");
const { order_confirmed } = require("../../utils/emails/user/orders");

let SquareConnect = require("square-connect");
let defaultClient = SquareConnect.ApiClient.instance;

if (config.SQUARE_ENV == "DEMO") {
  defaultClient.basePath = "https://connect.squareupsandbox.com";
} else {
  defaultClient.basePath = "https://connect.squareup.com";
}

let oauth2 = defaultClient.authentications["oauth2"];
oauth2.accessToken = config.SQUARE_TOKEN;

exports.allocateSlot = async (data) => {
  let { shift_id, driver_id, booking_id, address_id } = data;
  let address = await Address.findOne({ _id: ObjectId(address_id) });
  let driver = await Driver.findOne({ _id: ObjectId(driver_id) });
  let { location } = driver;
  let booking_slot = new BookingSlot({
    shift_id: ObjectId(shift_id),
    driver_id: ObjectId(driver_id),
    booking_id: ObjectId(booking_id),
    address_id: ObjectId(address_id),
    location: address.location,
    date: new Date(moment().format("YYYY-MM-DD")),
  });

  await booking_slot.save();

  slots = await BookingSlot.aggregate([
    {
      $geoNear: {
        near: location,
        key: "location",
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 0.001,
        query: {
          shift_id: ObjectId(shift_id),
          driver_id: ObjectId(driver_id),
        },
      },
    },
    {
      $match: {
        shift_id: ObjectId(shift_id),
        date: new Date(moment().format("YYYY-MM-DD")),
        driver_id: ObjectId(driver_id),
      },
    },
  ]);

  slots.forEach(async (slot) => {
    let { _id, distance } = slot;
    if (_id && distance) {
      await BookingSlot.updateOne(
        {
          _id: ObjectId(_id),
        },
        {
          $set: {
            distance: parseFloat(distance),
          },
        }
      );
    }
  });

  return true;
};

exports.getDataUrl = async (str) => {
  return QRCode.toDataURL(str, { errorCorrectionLevel: "M" });
};

exports.createOrder = async (data) => {
  let setting = await Setting.findOne();
  let {
    booking_id,
    payment_id,
    app_url,
    first_order_price,
    credit_amount,
  } = data;
  let payment = await TmpPayment.findOne({ _id: payment_id });
  let user = await User.findOne({ _id: ObjectId(payment.user_id) });

  let location = config.SQUARE_LOCATION;

  //set demo for saleesh
  // if (user.mobile == "9946070864") {
  //   SquareConnect = require("square-connect");
  //   defaultClient = SquareConnect.ApiClient.instance;
  //   defaultClient.basePath = "https://connect.squareupsandbox.com";
  //   oauth2.accessToken = "EAAAEJD8Cj5Hh1cubxJGbmeDFa0Fn-LsFAChmLy0pbWRCVy_d2k9ugVX0lO6irGK";
  //   location = "LGQ3JD10JMY4P"
  // }

  let delivery_charge = 0;
  if (payment && payment.delivery_charge) {
    delivery_charge = parseFloat(payment.delivery_charge.toFixed(2));
  }

  let service_charge = 0;
  if (payment && payment.service_charge) {
    service_charge = parseFloat(payment.service_charge.toFixed(2));
  }

  let items = await TmpBooking.aggregate([
    {
      $match: {
        delete_status: false,
        _id: ObjectId(booking_id),
      },
    },
    {
      $unwind: "$orders",
    },
    {
      $lookup: {
        let: {
          product_id: "$orders.product_id",
        },
        from: "products",
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
              name: "$name",
              price: "$price",
            },
          },
        ],
        as: "product_details",
      },
    },
    {
      $addFields: {
        product_detail: {
          $arrayElemAt: ["$product_details", 0],
        },
      },
    },
    {
      $project: {
        _id: "$product_detail._id",
        coupon: "$coupon",
        name: "$product_detail.name",
        quantity: "$orders.quantity",
        price: "$product_detail.price",
        total_price: {
          $multiply: ["$orders.quantity", "$product_detail.price"],
        },
      },
    },
  ]);

  let line_items = [];
  let coupon = null;
  items.forEach((item) => {
    coupon = item.coupon;
    let price = parseInt(parseFloat(item.price.toFixed(2) * 100));
    line_items.push({
      name: item.name,
      quantity: item.quantity + "",
      base_price_money: {
        amount: price,
        currency: "AUD",
      },
    });
  });

  if (delivery_charge) {
    delivery_charge = parseInt(parseFloat(delivery_charge.toFixed(2) * 100));
    line_items.push({
      name: "DELIVERY CHARGE",
      quantity: 1 + "",
      base_price_money: {
        amount: +delivery_charge,
        currency: "AUD",
      },
    });
  }

  if (service_charge) {
    console.log(
      `**********************service charge = ${service_charge} *********************************`
    );
    service_charge = parseInt(parseFloat(service_charge.toFixed(2) * 100));
    line_items.push({
      name: "SERVICE CHARGE",
      quantity: 1 + "",
      base_price_money: {
        amount: +service_charge,
        currency: "AUD",
      },
    });
  }

  let discount_price = [];
  let rng_key = "RNG-" + Math.floor(Date.now() / 1000);
  if (payment.discount_price) {
    var discount = parseInt(
      parseFloat(payment.discount_price.toFixed(2) * 100)
    );
    voucher_label = "DISCOUNT";
    if (coupon) {
      voucher_label = coupon;
    }
    discount_price.push({
      uid: rng_key,
      type: "FIXED_AMOUNT",
      scope: "ORDER",
      amount_money: {
        amount: discount,
        currency: "AUD",
      },
      name: voucher_label,
    });
  }

  if (credit_amount) {
    credit_amount = parseInt(parseFloat(credit_amount.toFixed(2)) * 100);
    discount_price.push({
      uid: "RNG-" + Math.floor(Date.now() / 1000),
      type: "FIXED_AMOUNT",
      scope: "ORDER",
      amount_money: {
        amount: credit_amount,
        currency: "AUD",
      },
      name: "CREDIT USED",
    });
  }

  if (first_order_price) {
    first_order_price = parseInt(
      parseFloat(first_order_price.toFixed(2)) * 100
    );
    discount_price.push({
      uid: "RNG-" + Math.floor(Date.now() / 1000),
      type: "FIXED_AMOUNT",
      scope: "ORDER",
      amount_money: {
        amount: first_order_price,
        currency: "AUD",
      },
      name: "FIRST ORDER DISCOUNT",
    });
  }

  // console.log("********************************************")
  // console.log(discount_price)
  // console.log("********************************************")
  var checkout = {
    idempotency_key: rng_key,
    redirect_url: app_url + "/order-confirm",
    order: {
      idempotency_key: rng_key,
      order: {
        location_id: location,
        customer_id: payment.user_id,
        reference_id: booking_id,
        line_items: line_items,
        discounts: discount_price,
      },
    },
    ask_for_shipping_address: false,
    merchant_support_email: "info@ricengrills.com.au",
    pre_populate_buyer_email: user.email,
  };

  let apiInstance = new SquareConnect.CheckoutApi();
  let locationId = location;
  // let body = new SquareConnect.CreateCheckoutRequest(checkout)
  let response = {};
  await apiInstance.createCheckout(locationId, checkout).then(
    function (data) {
      console.log("API called successfully. Returned data: " + data);
      response = data;
    },
    function (error) {
      console.error(error);
    }
  );
  return response;
};

exports.orderConfirm = async (req, res) => {
  try {
    let user = await User.findOne({ _id: ObjectId(req.session._id) });
    req.session.cart = [];
    req.session.accessories = [];
    return res.render("web/success");
  } catch (error) {
    console.log(error);
    return res.render("web/error");
  }
};

exports.createCredit = async (data) => {
  let setting = await Setting.findOne();
  let { food, booking_id, user_id, app_url } = data;
  let line_items = [];
  let user = await User.findOne({ _id: user_id });

  let location = config.SQUARE_LOCATION;

  let service_charge = 0;
  if (setting.service_charge_square) {
    service_charge = food * (setting.service_charge_square/100);
  }

  if (food) {
    line_items.push({
      name: "Food Credit",
      quantity: "1",
      base_price_money: {
        amount: +food * 100,
        currency: "AUD",
      },
    });
  }

  if (service_charge) {
    service_charge = parseInt(parseFloat(service_charge.toFixed(2) * 100));
    line_items.push({
      name: "SERVICE CHARGE",
      quantity: 1 + "",
      base_price_money: {
        amount: +service_charge,
        currency: "AUD",
      },
    });
  }

  let rng_key = "RNG-" + Math.floor(Date.now() / 1000);
  var checkout = {
    idempotency_key: rng_key,
    redirect_url: app_url + "/credit-confirm",
    order: {
      idempotency_key: rng_key,
      order: {
        location_id: location,
        customer_id: user_id,
        reference_id: booking_id,
        line_items: line_items,
        taxes: [],
        discounts: [],
      },
    },
    ask_for_shipping_address: false,
    merchant_support_email: "info@ricengrills.com.au",
    pre_populate_buyer_email: user.email,
  };
  let apiInstance = new SquareConnect.CheckoutApi();
  let locationId = location;
  let response = {};
  await apiInstance.createCheckout(locationId, checkout).then(
    function (data) {
      response = data;
    },
    function (error) {
      console.error(error);
    }
  );
  return response;
};

exports.creditConfirm = async (req, res) => {
  return res.redirect(res.locals.app_url + "/scheduled");
};

exports.success = async (req, res) => {
  req.session.cart = [];
  req.session.accessories = [];
  return res.render("web/success");
};

exports.confirmfrom_webhook = async (req, res) => {
  try {
    console.log("*****************confirmfrom_webhook******************");
    let { data } = req.body;
    if (data) {
      let { type } = data;
      if (type == "payment") {
        let { object } = data;
        if (object) {
          let { payment } = object;
          if (payment) {
            let { id: payment_id, order_id, amount_money, status } = payment;
            if (status == "COMPLETED" && order_id) {
              //check order id exists in payment
              let exists_in_payment_table = await Payment.find({
                transaction_id: order_id,
              }).countDocuments();
              if (!exists_in_payment_table) {
                //check order id in temp payment table
                let tmp_payment = await TmpPayment.findOne({ order_id });
                if (tmp_payment) {
                  //get tmp_booking
                  let tmp_booking = await TmpBooking.findOne({
                    tmp_payment_id: ObjectId(tmp_payment._id),
                  }).populate({
                    path: "tmp_payment_id",
                  });
                  if (!tmp_booking) {
                    throw new Error("Payment already done or not found");
                  }

                  //get user
                  let user_details = await User.findOne({
                    _id: ObjectId(tmp_booking.user_id),
                  });

                  let transaction = new Transaction({
                    user_id: user_details._id,
                    payment_id,
                    amount: parseFloat(amount_money.amount / 100),
                    type: "ORDER",
                    date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
                  });

                  //new payment
                  let newpayment = new Payment({
                    user_id: req.session._id,
                    transaction_id: payment_id,
                    checkout_id: order_id,
                    date: tmp_booking.tmp_payment_id.date,
                    actual_price: tmp_booking.tmp_payment_id.actual_price,
                    discount_price: tmp_booking.tmp_payment_id.discount_price,
                    gst: tmp_booking.tmp_payment_id.gst,
                    total_price: tmp_booking.tmp_payment_id.total_price,
                    payment_type: tmp_booking.tmp_payment_id.payment_type,
                    delivery_charge: tmp_booking.tmp_payment_id.delivery_charge,
                    is_credit: tmp_booking.tmp_payment_id.is_credit
                      ? tmp_booking.tmp_payment_id.is_credit
                      : false,
                    credit_used: tmp_booking.tmp_payment_id.credit_used
                      ? tmp_booking.tmp_payment_id.credit_used
                      : 0,
                    service_charge: tmp_booking.tmp_payment_id.service_charge
                      ? tmp_booking.tmp_payment_id.service_charge
                      : 0,
                  });

                  await newpayment.save();

                  //booking
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

                  let booking_id = "";

                  if (tmp_booking.booking_id) {
                    booking_id = tmp_booking.booking_id;
                    let booking = await Booking.findOne({ booking_id });
                    if (booking) {
                      await Booking.deleteOne({ _id: ObjectId(booking._id) });
                      await Payment.deleteOne({
                        _id: ObjectId(booking.payment_id),
                      });
                    }
                  } else {
                    if (tmp_booking.booking_type == "SCHEDULED") {
                      booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                        }`;
                    } else {
                      booking_id = `${config.REALTIME_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                        }`;
                    }
                  }

                  booking.booking_id = booking_id;
                  booking.payment_id = newpayment._id;
                  booking.user_id = user_details._id;
                  booking.booking_type = tmp_booking.booking_type;
                  booking.address_id = tmp_booking.address_id;
                  booking.delivery_type = tmp_booking.delivery_type;
                  tmp_booking.delivery_type == "ONLINE"
                    ? (booking.address_id = tmp_booking.address_id)
                    : (booking.collectionpoint_id =
                      tmp_booking.collectionpoint_id);
                  booking.shift_id = tmp_booking.shift_id;
                  booking.orders = tmp_booking.orders;
                  booking.qrcode = await this.getDataUrl(booking_id);
                  booking.scheduled_date = tmp_booking.scheduled_date;
                  booking.created_at = new Date(
                    moment().format("YYYY-MM-DD HH:mm")
                  );
                  booking.coupon = tmp_booking.coupon;
                  if (
                    tmp_booking.delivery_type == "ONLINE" &&
                    tmp_booking.booking_type == "REALTIME"
                  ) {
                    booking.driver_id = ObjectId(tmp_booking.driver_id);
                  }
                  booking.company_id = tmp_booking.company_id;
                  await booking.save();

                  transaction.booking_id = booking_id;
                  await transaction.save();

                  if (
                    booking.delivery_type == "ONLINE" &&
                    booking.booking_type == "REALTIME"
                  ) {
                    await this.allocateSlot({
                      shift_id: booking.shift_id,
                      driver_id: booking.driver_id,
                      booking_id: booking._id,
                      address_id: booking.address_id,
                    });
                  }

                  sendOrderConfirm.add({
                    booking_id: booking._id,
                    total: tmp_booking.tmp_payment_id.total_price,
                    name: user_details.name,
                    email: user_details.email,
                  });

                  // console.log(tmp_booking.orders);

                  if (tmp_booking.booking_id) {
                    user_details.credits.food = 0;
                    await user_details.save();
                  } else if (tmp_booking.tmp_payment_id.credit_used) {
                    user_details.credits.food =
                      user_details.credits.food -
                      +tmp_booking.tmp_payment_id.credit_used;
                    await user_details.save();
                  }

                  await TmpPayment.deleteOne({
                    _id: tmp_booking.tmp_payment_id._id,
                  });
                  await TmpBooking.deleteOne({ _id: tmp_booking._id });

                  if (user_details) {
                    let { first_order, reffered_by } = user_details;
                    if (!first_order && reffered_by) {
                      let setting = await Setting.findOne();
                      let price = 0;
                      if (setting) {
                        price = setting.price.food;
                      }
                      await User.updateOne(
                        {
                          _id: ObjectId(reffered_by),
                        },
                        { $inc: { "credits.food": price } }
                      );
                      user_details.first_order = true;
                      await user_details.save();
                      addCreditByReferal.add({
                        to_user: reffered_by,
                        from_user: user_details._id,
                      });
                    }
                  }
                  console.log("*************orderr confrimed*************");
                  return res.json({
                    status: true,
                    message: "Order confirmed",
                  });
                } else {
                  console.log("***************in credit ********************");
                  let credit = await TmpCredit.findOne({
                    order_id: order_id,
                  });
                  console.log(credit);
                  if (!credit) {
                    throw new Error("Payment failed");
                  }

                  let transaction = new Transaction({
                    user_id: credit.user_id,
                    payment_id,
                    amount: parseFloat(amount_money.amount / 100),
                    type: "ORDER",
                    date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
                  });
                  await transaction.save();

                  let newcredit = new Credit();
                  let user = await User.findOne({
                    _id: ObjectId(credit.user_id),
                  });
                  let current_price = 0;
                  if (typeof user.credits.food != "undefined") {
                    current_price = user.credits.food;
                  }
                  user.credits.food = +current_price + +credit.price;
                  newcredit = credit;
                  await newcredit.save();
                  await credit.remove();
                  await user.save();
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Some thing went wrong",
    });
  }

  return res.json({
    status: true,
  });
};

exports.paypal_orderconfirm = async (req, res) => {
  console.log(`*************order confirm***************`)
  let environment = "";
  if (config.PAYPAL_ENV == "DEMO") {
    environment = new PayPal.core.SandboxEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  } else {
    environment = new PayPal.core.LiveEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  }
  client = new PayPal.core.PayPalHttpClient(environment);

  let {
    id: ref_id,
    resource: {
      status,
      id: order_id,
      purchase_units
    },
  } = req.body;

  // console.log(req.body)
  if (status == "APPROVED" && order_id) {
    console.log(`*************order approved***************`)
    request = new PayPal.orders.OrdersCaptureRequest(order_id);
    request.requestBody({});
    let capture = await client.execute(request);
    // console.log(capture);
    let captureId = capture.result.purchase_units[0].payments.captures[0].id;
    if(captureId){
      let paid_amount = capture.result.purchase_units[0].payments.captures[0].amount.value
      //check order id exists in payment
      let exists_in_payment_table = await Payment.find({
        transaction_id: captureId,
      }).countDocuments();
      if (!exists_in_payment_table) {
        //check order id in temp payment table
        let tmp_payment = await TmpPayment.findOne({ checkout_id: order_id });
        if (tmp_payment) {
          //get tmp_booking
          let tmp_booking = await TmpBooking.findOne({
            tmp_payment_id: ObjectId(tmp_payment._id),
          }).populate({
            path: "tmp_payment_id",
          });
          if (!tmp_booking) {
            throw new Error("Payment already done or not found");
          }

          //get user
          let user_details = await User.findOne({
            _id: ObjectId(tmp_booking.user_id),
          });

          let transaction = new Transaction({
            user_id: user_details._id,
            payment_id: captureId,
            amount: parseFloat(paid_amount),
            type: "ORDER",
            gateway: tmp_booking.tmp_payment_id.gateway
              ? tmp_booking.tmp_payment_id.gateway
              : "",
            date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
          });

          //new payment
          let newpayment = new Payment({
            user_id: req.session._id,
            transaction_id: captureId,
            checkout_id: order_id,
            date: tmp_booking.tmp_payment_id.date,
            actual_price: tmp_booking.tmp_payment_id.actual_price,
            discount_price: tmp_booking.tmp_payment_id.discount_price,
            gst: tmp_booking.tmp_payment_id.gst,
            total_price: tmp_booking.tmp_payment_id.total_price,
            payment_type: tmp_booking.tmp_payment_id.payment_type,
            delivery_charge: tmp_booking.tmp_payment_id.delivery_charge,
            is_credit: tmp_booking.tmp_payment_id.is_credit
              ? tmp_booking.tmp_payment_id.is_credit
              : false,
            credit_used: tmp_booking.tmp_payment_id.credit_used
              ? tmp_booking.tmp_payment_id.credit_used
              : 0,
            service_charge: tmp_booking.tmp_payment_id.service_charge
              ? tmp_booking.tmp_payment_id.service_charge
              : 0,
            gateway: "paypal"
          });

          await newpayment.save();

          //booking
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

          let booking_id = "";

          if (tmp_booking.booking_id) {
            booking_id = tmp_booking.booking_id;
            let booking = await Booking.findOne({ booking_id });
            if (booking) {
              await Booking.deleteOne({ _id: ObjectId(booking._id) });
              await Payment.deleteOne({
                _id: ObjectId(booking.payment_id),
              });
            }
          } else {
            if (tmp_booking.booking_type == "SCHEDULED") {
              booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                }`;
            } else {
              booking_id = `${config.REALTIME_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                }`;
            }
          }

          booking.booking_id = booking_id;
          booking.payment_id = newpayment._id;
          booking.user_id = user_details._id;
          booking.booking_type = tmp_booking.booking_type;
          booking.address_id = tmp_booking.address_id;
          booking.delivery_type = tmp_booking.delivery_type;
          tmp_booking.delivery_type == "ONLINE"
            ? (booking.address_id = tmp_booking.address_id)
            : (booking.collectionpoint_id = tmp_booking.collectionpoint_id);
          booking.shift_id = tmp_booking.shift_id;
          booking.orders = tmp_booking.orders;
          booking.qrcode = await this.getDataUrl(booking_id);
          booking.scheduled_date = tmp_booking.scheduled_date;
          booking.created_at = new Date(moment().format("YYYY-MM-DD HH:mm"));
          booking.coupon = tmp_booking.coupon;
          if (
            tmp_booking.delivery_type == "ONLINE" &&
            tmp_booking.booking_type == "REALTIME"
          ) {
            booking.driver_id = ObjectId(tmp_booking.driver_id);
          }
          booking.company_id = tmp_booking.company_id;
          await booking.save();

          transaction.booking_id = booking_id;
          await transaction.save();

          if (
            booking.delivery_type == "ONLINE" &&
            booking.booking_type == "REALTIME"
          ) {
            await this.allocateSlot({
              shift_id: booking.shift_id,
              driver_id: booking.driver_id,
              booking_id: booking._id,
              address_id: booking.address_id,
            });
          }

          sendOrderConfirm.add({
            booking_id: booking._id,
            total: tmp_booking.tmp_payment_id.total_price,
            name: user_details.name,
            email: user_details.email,
          });

          // console.log(tmp_booking.orders);

          if (tmp_booking.booking_id) {
            user_details.credits.food = 0;
            await user_details.save();
          } else if (tmp_booking.tmp_payment_id.credit_used) {
            user_details.credits.food =
              user_details.credits.food -
              +tmp_booking.tmp_payment_id.credit_used;
            await user_details.save();
          }

          await TmpPayment.deleteOne({
            _id: tmp_booking.tmp_payment_id._id,
          });
          await TmpBooking.deleteOne({ _id: tmp_booking._id });

          if (user_details) {
            let { first_order, reffered_by } = user_details;
            if (!first_order && reffered_by) {
              let setting = await Setting.findOne();
              let price = 0;
              if (setting) {
                price = setting.price.food;
              }
              await User.updateOne(
                {
                  _id: ObjectId(reffered_by),
                },
                { $inc: { "credits.food": price } }
              );
              user_details.first_order = true;
              await user_details.save();
              addCreditByReferal.add({
                to_user: reffered_by,
                from_user: user_details._id,
              });
            }
          }
          console.log("*************orderr confrimed*************");
          return res.json({
            status: true,
            message: "Order confirmed",
          });
        } else {
          console.log("***************in credit ********************");
          let credit = await TmpCredit.findOne({
            order_id: order_id,
          });
          console.log(credit);
          if (!credit) {
            throw new Error("Payment failed");
          }

          let transaction = new Transaction({
            user_id: credit.user_id,
            payment_id: captureId,
            amount: parseFloat(paid_amount),
            type: "ORDER",
            date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
            gateway: "paypal",
          });
          await transaction.save();

          let newcredit = new Credit();
          let user = await User.findOne({
            _id: ObjectId(credit.user_id),
          });
          let current_price = 0;
          if (typeof user.credits.food != "undefined") {
            current_price = user.credits.food;
          }
          user.credits.food = +current_price + +credit.price;
          newcredit = credit;
          await newcredit.save();
          await credit.remove();
          await user.save();

          return res.json({
            status: true,
            message: "Order confirmed",
          });
        }
      }
      return res.json({
        status: false,
        message: "Order failed",
      });    
    }

    return res.json({
      status: false,
      message: "Order failed",
    });    

    console.log({ captureId })
  }

  res.status(200).send(true);

}

exports.confirmfrom_webhook_paypal = async (req, res) => {
  console.log("******inside confirm webhook paypal***********")
  try {
    let {
      resource: {
        id: order_id,
        gross_amount: {
          value
        },
        status
      }
    } = req.body;
    if (status == "COMPLETED" && order_id) {
      //check order id exists in payment
      let exists_in_payment_table = await Payment.find({
        transaction_id: order_id,
      }).countDocuments();
      if (!exists_in_payment_table) {
        //check order id in temp payment table
        let tmp_payment = await TmpPayment.findOne({ order_id });
        if (tmp_payment) {
          //get tmp_booking
          let tmp_booking = await TmpBooking.findOne({
            tmp_payment_id: ObjectId(tmp_payment._id),
          }).populate({
            path: "tmp_payment_id",
          });
          if (!tmp_booking) {
            throw new Error("Payment already done or not found");
          }

          //get user
          let user_details = await User.findOne({
            _id: ObjectId(tmp_booking.user_id),
          });

          let transaction = new Transaction({
            user_id: user_details._id,
            payment_id: order_id,
            amount: parseFloat(value),
            type: "ORDER",
            gateway: tmp_booking.tmp_payment_id.gateway
              ? tmp_booking.tmp_payment_id.gateway
              : "",
            date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
          });

          //new payment
          let newpayment = new Payment({
            user_id: req.session._id,
            transaction_id: order_id,
            checkout_id: order_id,
            date: tmp_booking.tmp_payment_id.date,
            actual_price: tmp_booking.tmp_payment_id.actual_price,
            discount_price: tmp_booking.tmp_payment_id.discount_price,
            gst: tmp_booking.tmp_payment_id.gst,
            total_price: tmp_booking.tmp_payment_id.total_price,
            payment_type: tmp_booking.tmp_payment_id.payment_type,
            delivery_charge: tmp_booking.tmp_payment_id.delivery_charge,
            is_credit: tmp_booking.tmp_payment_id.is_credit
              ? tmp_booking.tmp_payment_id.is_credit
              : false,
            credit_used: tmp_booking.tmp_payment_id.credit_used
              ? tmp_booking.tmp_payment_id.credit_used
              : 0,
            service_charge: tmp_booking.tmp_payment_id.service_charge
              ? tmp_booking.tmp_payment_id.service_charge
              : 0,
            gateway: tmp_booking.tmp_payment_id.gateway
              ? tmp_booking.tmp_payment_id.gateway
              : "",
          });

          await newpayment.save();

          //booking
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

          let booking_id = "";

          if (tmp_booking.booking_id) {
            booking_id = tmp_booking.booking_id;
            let booking = await Booking.findOne({ booking_id });
            if (booking) {
              await Booking.deleteOne({ _id: ObjectId(booking._id) });
              await Payment.deleteOne({
                _id: ObjectId(booking.payment_id),
              });
            }
          } else {
            if (tmp_booking.booking_type == "SCHEDULED") {
              booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                }`;
            } else {
              booking_id = `${config.REALTIME_BOOKING_ID_PREFIX}${parseInt(bk_id) + 1
                }`;
            }
          }

          booking.booking_id = booking_id;
          booking.payment_id = newpayment._id;
          booking.user_id = user_details._id;
          booking.booking_type = tmp_booking.booking_type;
          booking.address_id = tmp_booking.address_id;
          booking.delivery_type = tmp_booking.delivery_type;
          booking.break_time = tmp_booking.break_time ? tmp_booking.break_time  : "" 
          tmp_booking.delivery_type == "ONLINE"
            ? (booking.address_id = tmp_booking.address_id)
            : (booking.collectionpoint_id = tmp_booking.collectionpoint_id);
          booking.shift_id = tmp_booking.shift_id;
          booking.orders = tmp_booking.orders;
          booking.qrcode = await this.getDataUrl(booking_id);
          booking.scheduled_date = tmp_booking.scheduled_date;
          booking.created_at = new Date(moment().format("YYYY-MM-DD HH:mm"));
          booking.coupon = tmp_booking.coupon;
          if (
            tmp_booking.delivery_type == "ONLINE" &&
            tmp_booking.booking_type == "REALTIME"
          ) {
            booking.driver_id = ObjectId(tmp_booking.driver_id);
          }
          booking.company_id = tmp_booking.company_id;
          await booking.save();

          transaction.booking_id = booking_id;
          await transaction.save();

          if (
            booking.delivery_type == "ONLINE" &&
            booking.booking_type == "REALTIME"
          ) {
            await this.allocateSlot({
              shift_id: booking.shift_id,
              driver_id: booking.driver_id,
              booking_id: booking._id,
              address_id: booking.address_id,
            });
          }

          sendOrderConfirm.add({
            booking_id: booking._id,
            total: tmp_booking.tmp_payment_id.total_price,
            name: user_details.name,
            email: user_details.email,
          });

          // console.log(tmp_booking.orders);

          if (tmp_booking.booking_id) {
            user_details.credits.food = 0;
            await user_details.save();
          } else if (tmp_booking.tmp_payment_id.credit_used) {
            user_details.credits.food =
              user_details.credits.food -
              +tmp_booking.tmp_payment_id.credit_used;
            await user_details.save();
          }

          await TmpPayment.deleteOne({
            _id: tmp_booking.tmp_payment_id._id,
          });
          await TmpBooking.deleteOne({ _id: tmp_booking._id });

          if (user_details) {
            let { first_order, reffered_by } = user_details;
            if (!first_order && reffered_by) {
              let setting = await Setting.findOne();
              let price = 0;
              if (setting) {
                price = setting.price.food;
              }
              await User.updateOne(
                {
                  _id: ObjectId(reffered_by),
                },
                { $inc: { "credits.food": price } }
              );
              user_details.first_order = true;
              await user_details.save();
              addCreditByReferal.add({
                to_user: reffered_by,
                from_user: user_details._id,
              });
            }
          }
          console.log("*************orderr confrimed*************");
          return res.json({
            status: true,
            message: "Order confirmed",
          });
        } else {
          console.log("***************in credit ********************");
          let credit = await TmpCredit.findOne({
            order_id: order_id,
          });
          console.log(credit);
          if (!credit) {
            throw new Error("Payment failed");
          }

          let transaction = new Transaction({
            user_id: credit.user_id,
            payment_id: order_id,
            amount: parseFloat(value),
            type: "ORDER",
            date: new Date(moment().format("YYYY-MM-DD HH:mm:ss")),
            gateway: tmp_booking.tmp_payment_id.gateway
              ? tmp_booking.tmp_payment_id.gateway
              : "",
          });
          await transaction.save();

          let newcredit = new Credit();
          let user = await User.findOne({
            _id: ObjectId(credit.user_id),
          });
          let current_price = 0;
          if (typeof user.credits.food != "undefined") {
            current_price = user.credits.food;
          }
          user.credits.food = +current_price + +credit.price;
          newcredit = credit;
          await newcredit.save();
          await credit.remove();
          await user.save();

          return res.json({
            status: true,
            message: "Order confirmed",
          });
        }
      }
      throw new Error('Could not confirm')
    }
    throw new Error('Could not confirm')
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Payment failed",
    });
  }
};

invoicehtml = (booking, app_url) => {
  let {
    booking_id,
    orders,
    scheduled_date,
    created_at,
    shift_details,
    address_details,
    user_details,
    payment_details,
    delivery_type,
    transaction_details,
    company_id,
  } = booking;
  let shift_name = "";
  let address_html = "";
  //user details
  let name = "";
  let mobile = "";
  let email = "";
  delivery_type = delivery_type == "ONLINE" ? "DELIVERY" : "PICKUP";
  delivery_type = company_id ? "OFFICE" : delivery_type;
  if (shift_details) {
    //shift details
    shift_name = shift_details.name;
  }
  if (address_details) {
    let { type } = address_details;
    if (type == "USER") {
      let {
        address_line1,
        address_line2,
        house_flat_no,
        appartment,
        landmark,
        to_reach,
      } = address_details;
      if (address_line1) {
        address_html += address_line1 + "<br/>";
      }
      if (address_line2) {
        address_html += address_line2 + "<br/>";
      }
      if (house_flat_no) {
        address_html += house_flat_no + ",";
      }
      if (appartment) {
        address_html += appartment + ",";
      }
      if (landmark) {
        address_html += landmark + "<br/>";
      }
      if (to_reach) {
        address_html += to_reach;
      }
    } else {
      let { address_line1, address_line2 } = address_details;
      if (address_line1) {
        address_html += address_line1 + "<br/>";
      }
      if (address_line2) {
        address_html += address_line2 + "<br/>";
      }
    }
  }
  if (user_details) {
    let {
      name: user_name,
      mobile: user_mobile,
      email: user_email,
    } = user_details;
    name = user_name;
    mobile = user_mobile;
    email = user_email;
  }

  let rng_credits_html = "";
  let square_payment_html = "";
  let coupon_html = "";

  let total_price = 0;
  let delivery_charge = 0;
  let service_charge = 0;

  if (payment_details) {
    let {
      credit_used,
      transaction_id,
      coupon,
      total_price: tot_price,
      service_charge: service_chrg,
      delivery_charge: delivery_chrg,
    } = payment_details;
    total_price = tot_price;
    delivery_charge = delivery_chrg;
    service_charge = service_chrg;

    if (credit_used) {
      rng_credits_html += `
        <tr class="details">
          <td>
              RNG Credits
          </td>                  
          <td>
              $${credit_used.toFixed(2)}
          </td>
        </tr>
      `;
    }
    if (transaction_id) {
      if (transaction_details) {
        let { payment_id, amount } = transaction_details;
        square_payment_html = `
          <tr class="details">
            <td>
                Payment (Square- ${payment_id})
            </td>                  
            <td>
                $${amount.toFixed(2)}
            </td>
          </tr>
        `;
      }
    }

    if (coupon) {
      let { discount_price } = payment_details;
      coupon_html = `
          <tr class="details">
            <td>
                Coupon (${coupon})
            </td>                  
            <td>
                $${discount_price.toFixed(2)}
            </td>
          </tr>
        `;
    }
  }

  let orders_html = "";
  if (orders.length > 0) {
    orders.forEach((order) => {
      let { product_name, price, quantity } = order;
      let tot_price = 0;
      if (price) {
        tot_price = price * quantity;
      }
      orders_html += `
        <tr class="item">
            <td>
                ${product_name} (x${quantity})
            </td>            
            <td>
                $${tot_price.toFixed(2)}
            </td>
        </tr>
      `;
    });
  }

  return `
  <!doctype html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>A simple, clean, and responsive HTML invoice template</title>    
      <style>
      .invoice-box {
          max-width: 800px;
          margin: auto;
          padding: 30px;
          border: 1px solid #eee;
          box-shadow: 0 0 10px rgba(0, 0, 0, .15);
          font-size: 16px;
          line-height: 24px;
          font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
          color: #555;
      }
      
      .invoice-box table {
          width: 100%;
          line-height: inherit;
          text-align: left;
      }
      
      .invoice-box table td {
          padding: 5px;
          vertical-align: top;
      }
      
      .invoice-box table tr td:nth-child(2) {
          text-align: right;
      }
      
      .invoice-box table tr.top table td {
          padding-bottom: 20px;
      }
      
      .invoice-box table tr.top table td.title {
          font-size: 45px;
          line-height: 45px;
          color: #333;
      }
      
      .invoice-box table tr.information table td {
          padding-bottom: 40px;
      }
      
      .invoice-box table tr.heading td {
          background: #eee;
          border-bottom: 1px solid #ddd;
          font-weight: bold;
      }
      
      .invoice-box table tr.details td {
          padding-bottom: 20px;
      }
      
      .invoice-box table tr.item td{
          border-bottom: 1px solid #eee;
      }
      
      .invoice-box table tr.item.last td {
          border-bottom: none;
      }
      
      .invoice-box table tr.total td:nth-child(2) {
          border-top: 2px solid #eee;
          font-weight: bold;
      }
      
      @media only screen and (max-width: 600px) {
          .invoice-box table tr.top table td {
              width: 100%;
              display: block;
              text-align: center;
          }
          
          .invoice-box table tr.information table td {
              width: 100%;
              display: block;
              text-align: center;
          }
      }
      
      /** RTL **/
      .rtl {
          direction: rtl;
          font-family: Tahoma, 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
      }
      
      .rtl table {
          text-align: right;
      }
      
      .rtl table tr td:nth-child(2) {
          text-align: left;
      }
      </style>
  </head>
  
  <body>
      <div class="invoice-box">
          <table cellpadding="0" cellspacing="0">
              <tr class="top">
                  <td colspan="2">
                      <table>
                          <tr>
                              <td class="title">
                                  <img src="${app_url}/public/web/images/rice-n-grills-logo.svg" style="width:100%; max-width:300px;">
                              </td>
                              
                              <td>
                                  Bk.ID           : ${booking_id}<br>
                                  Created Date    : ${moment(created_at).format(
    "YYYY-MM-DD"
  )}<br>
                                  Scheduled Date  : ${moment(
    scheduled_date
  ).format("YYYY-MM-DD")}<br>
                                  Shift Selected  : ${shift_name}<br>
                                  Del. Type       : ${delivery_type}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              
              <tr class="information">
                  <td colspan="2">
                      <table>
                          <tr>
                              <td>
                                ${address_html}
                              </td>
                              
                              <td>
                                  ${name}<br>
                                  ${mobile}<br>
                                  ${email}
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
              
              <tr class="heading">
                  <td>
                      Payment Method
                  </td>                  
                  <td>
                      Amount
                  </td>
              </tr>
              
              ${rng_credits_html}
              ${square_payment_html}
              ${coupon_html}

              <tr class="heading">
                  <td>
                      Item
                  </td>
                  
                  <td>
                      Price
                  </td>
              </tr>              
              ${orders_html}
              <tr class="item">
                <td>
                    Delivery Charge
                </td>
                
                <td>
                    $${delivery_charge.toFixed(2)}
                </td>
              </tr>
              <tr class="item last">
                  <td>
                      Service Charge
                  </td>
                  
                  <td>
                      $${service_charge.toFixed(2)}
                  </td>
              </tr>
              
              <tr class="total">
                  <td></td>                  
                  <td>
                     Total: $${total_price.toFixed(2)}
                  </td>
              </tr>
          </table>
      </div>
  </body>
  </html>
  `;
};

exports.generateInvoice = async (req, res) => {
  let { booking_id } = req.params;
  if (!booking_id || !ObjectId.isValid(booking_id)) {
    return res.redirect(res.locals.app_url + "/home");
  }

  //check booking exists
  let booking_exists = await Booking.find({
    _id: ObjectId(booking_id),
  }).estimatedDocumentCount();

  if (!booking_exists) {
    return res.redirect(res.locals.app_url + "/home");
  }
  //end check booking exists

  //get booking details
  let bookings = await Booking.aggregate([
    {
      $match: {
        _id: ObjectId(booking_id),
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
              name: 1,
            },
          },
        ],
        as: "product",
      },
    },
    {
      $project: {
        _id: 1,
        booking_type: 1,
        booking_id: 1,
        user_id: 1,
        delivery_type: 1,
        address_id: 1,
        scheduled_date: 1,
        created_at: 1,
        shift_id: 1,
        coupon: 1,
        payment_id: 1,
        orders: {
          _id: "$orders._id",
          product_id: "$orders.product_id",
          price: "$orders.price",
          quantity: "$orders.quantity",
          product_name: {
            $arrayElemAt: ["$product.name", 0],
          },
        },
        company_id: 1,
      },
    },
    {
      $group: {
        _id: "$_id",
        booking_type: {
          $first: "$booking_type",
        },
        orders: {
          $addToSet: "$orders",
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
        scheduled_date: {
          $first: "$scheduled_date",
        },
        created_at: {
          $first: "$created_at",
        },
        shift_id: {
          $first: "$shift_id",
        },
        coupon: {
          $first: "$coupon",
        },
        payment_id: {
          $first: "$payment_id",
        },
        company_id: {
          $first: "$company_id",
        },
      },
    },
    {
      //get payment details
      $lookup: {
        from: "payments",
        let: {
          payment_id: "$payment_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$payment_id"],
              },
            },
          },
        ],
        as: "payment_details",
      },
    },
    {
      //get shift details
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
                $eq: ["$shift_times._id", "$$shift_id"],
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
        as: "shift_details",
      },
    },
    {
      //get shift details
      $lookup: {
        from: "transactions",
        let: {
          booking_id: "$booking_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$booking_id", "$$booking_id"],
              },
            },
          },
        ],
        as: "transaction_details",
      },
    },
    {
      //get address details
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
        as: "address_details",
      },
    },
    {
      //get user details
      $lookup: {
        from: "users",
        let: {
          user_id: "$user_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$user_id"],
              },
            },
          },
          {
            $project: {
              name: 1,
              mobile: 1,
              email: 1,
            },
          },
        ],
        as: "user_details",
      },
    },
    {
      $addFields: {
        payment_details: {
          $arrayElemAt: ["$payment_details", 0],
        },
        shift_details: {
          $arrayElemAt: ["$shift_details", 0],
        },
        transaction_details: {
          $arrayElemAt: ["$transaction_details", 0],
        },
        address_details: {
          $arrayElemAt: ["$address_details", 0],
        },
        user_details: {
          $arrayElemAt: ["$user_details", 0],
        },
      },
    },
  ]);

  // return res.json({
  //   status: false,
  //   bookings
  // })
  let html = invoicehtml(bookings[0], res.locals.app_url);

  let pdf = require("html-pdf");
  pdf.create(html).toBuffer(function (err, buffer) {
    res.writeHead(200, {'Content-Type': 'application/pdf'});
    return  res.end(buffer, 'binary')
  });
};

exports.createOrderPaypal = async (data) => {
  let environment = "";
  if (config.PAYPAL_ENV == "DEMO") {
    environment = new PayPal.core.SandboxEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  } else {
    environment = new PayPal.core.LiveEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  }
  client = new PayPal.core.PayPalHttpClient(environment);

  let { credit_amount, app_url } = data;

  let request = new PayPal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: "CAPTURE",
    application_context: {
      return_url: app_url + "/success",
      cancel_url: app_url,
    },
    purchase_units: [
      {
        amount: {
          currency_code: "AUD",
          value: parseFloat(credit_amount.toFixed(2)),
        },
      },
    ],
  });

  let response = await client.execute(request);
  if (response.statusCode == 201) {
    let {
      result: { id, links },
    } = response;
    let link = links.filter((link) => {
      return link.rel == "approve";
    });
    if (link.length > 0) {
      link = link[0];
      return {
        status: true,
        id,
        link: link.href,
      };
    } else {
      return {
        status: false,
      };
    }
  } else {
    return {
      status: false,
    };
  }
};


exports.createCreditPaypal = async (data) => {
  let setting = await Setting.findOne();
 
  let environment = "";
  if (config.PAYPAL_ENV == "DEMO") {
    environment = new PayPal.core.SandboxEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  } else {
    environment = new PayPal.core.LiveEnvironment(
      config.PAYPAL_CLIENT_ID,
      config.PAYPAL_CLIENT_SECRET
    );
  }
  client = new PayPal.core.PayPalHttpClient(environment);

  let { credit_amount, app_url } = data;

  credit_amount = parseFloat(credit_amount);

  let service_charge = 0;
  if (setting.service_charge_paypal) {
    service_charge = credit_amount * (setting.service_charge_paypal/100);
  }

  let request = new PayPal.orders.OrdersCreateRequest();
  console.log(credit_amount,service_charge)
  request.requestBody({
    intent: "CAPTURE",
    application_context: {
      return_url: app_url + "/success",
      cancel_url: app_url,
    },
    purchase_units: [
      {
        amount: {
          value: parseFloat((credit_amount + service_charge).toFixed(2)),
          currency_code: 'AUD',
          breakdown: {
              item_total: {value: parseFloat((credit_amount + service_charge).toFixed(2)), currency_code: 'AUD'}
          }
        },
        items: [
          {
            name: "Credit",
            unit_amount: {value: parseFloat(credit_amount.toFixed(2)) , currency_code: 'AUD'},
            quantity: 1
          },
          {
            name: "Service Charge",
            unit_amount: {value: parseFloat(service_charge.toFixed(2)) , currency_code: 'AUD'},
            quantity: 1
          }
        ],
      }
    ],
  });

  let response = await client.execute(request);
  if (response.statusCode == 201) {
    let {
      result: { id, links },
    } = response;
    let link = links.filter((link) => {
      return link.rel == "approve";
    });
    if (link.length > 0) {
      link = link[0];
      return {
        status: true,
        id,
        link: link.href,
      };
    } else {
      return {
        status: false,
      };
    }
  } else {
    return {
      status: false,
    };
  }
};