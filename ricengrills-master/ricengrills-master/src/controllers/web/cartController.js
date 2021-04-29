const mongoose = require("mongoose");
const moment = require("moment");
let ObjectId = mongoose.Types.ObjectId;
let Product = mongoose.model("products");
let Setting = mongoose.model("settings");
let Address = mongoose.model("addresses");
let Suburb = mongoose.model("suburbs");
let Coupon = mongoose.model("coupons");
let User = mongoose.model("users");
let Driver = mongoose.model("drivers");
let Stock = mongoose.model("stocks");
let CP = mongoose.model("collectionpoints");
let TmpPayment = mongoose.model("tmp_payments");
let TmpBooking = mongoose.model("tmp_bookings");
let Payment = mongoose.model("payments");
let Booking = mongoose.model("bookings");
let BookingSlot = mongoose.model("booking_slots");
let CP_STOCK = mongoose.model("cp_stocks");
let Company = mongoose.model("companies");

let config = require("config");
let _ = require("underscore");
const { session } = require("passport");
let { createOrder, createOrderPaypal } = require("./paymentController");
const { on } = require("events");
const {
  addCreditByReferal,
  sendOrderConfirm,
} = require("../../jobs/notification");
let { getDataUrl } = require("./paymentController");
const { first } = require("underscore");

exports.getComingShift = async () => {
  let offset = Math.abs(new Date().getTimezoneOffset());
  let today = moment().format("YYYY-MM-DD");
  let cur_date = moment()
    .utcOffset(+offset)
    .format("YYYY-MM-DD HH:mm");

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
            { $lte: ["$current_date", "$end"] },
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

exports.toCollection = function (obj) {
  return Object.keys(obj)
    .sort(function (x, y) {
      return +x - +y;
    })
    .map(function (k) {
      return {
        product_id: k,
        count: obj[k].count,
      };
    });
};

exports.getGroupedArray = async (data) => {
  let result = data.reduce(function (acc, x) {
    var id = acc[x.product_id];
    // console.log({acc,x,id})
    if (id) {
      id.count = +id.count + +x.count;
    } else {
      acc[x.product_id] = x;
      delete x._id;
    }
    return acc;
  }, {});
  return this.toCollection(result);
};

exports.addToCart = async (req, res) => {
  let { current_shift } = await this.getComingShift();

  if (!current_shift) {
    return res.status(200).json({
      status: false,
      current_shift,
      message: "No realtime orders at this time",
    });
  }

  let { products } = req.body;
  let cart = req.session.cart;

  if (typeof products == "undefined" || products.length <= 0) {
    return res.status(200).json({
      status: false,
      message: "No products selected",
    });
  }

  if (typeof cart != "undefined" && cart.length > 0) {
    cart = cart.concat(products);
    cart = await this.getGroupedArray(cart);
    req.session.cart = cart;
  } else {
    req.session.cart = products;
  }

  if (!req.session._id || !req.session.role == "user") {
    return res.status(401).json({
      status: false,
      message: "User not logged in",
    });
  }

  return res.json({
    status: true,
    message: "Added to cart",
  });
};

exports.addProductsToCart = async (req, res) => {
  let { products, accessories, delivery_address_id } = req.body;
  req.session.cart = products;
  req.session.accessories = accessories;
  req.session.delivery_address = delivery_address_id;
  return res.json({
    status: true,
    message: "Added to cart",
  });
};

async function getShiftNameById(shift_id) {
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
  if (shift.length > 0) {
    return shift[0].name;
  } else {
    return "";
  }
}

async function getAddressesByUser(data) {
  let { user_id, delivery_address, has_realtime } = data;
  let active_suburb = "";
  let selected_address = "";

  let user_addresses = await Address.aggregate([
    {
      $match: {
        user_id: ObjectId(user_id),
        delete_status: false,
      },
    },
    {
      $sort: {
        active_location: 1,
      },
    },
  ]);

  active_suburb = user_addresses[0].suburb_id;

  let collectionpoints = await CP.aggregate([
    {
      $match: {
        approved: true,
        delete_status: false,
      },
    },
    {
      $lookup: {
        from: "addresses",
        let: {
          cp_id: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$delete_status", false] },
                ],
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
      },
    },
  ]);

  if (delivery_address) {
    let address = await Address.findOne({
      _id: ObjectId(delivery_address),
    });

    if (address && address.type == "COLLECTIONPOINT") {
      let addresses = await CP.aggregate([
        {
          $match: {
            _id: ObjectId(address.collectionpoint_id),
            approved: true,
            delete_status: false,
            rejected: false,
          },
        },
        {
          $lookup: {
            from: "addresses",
            let: {
              cp_id: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$collectionpoint_id", "$$cp_id"] },
                      { $eq: ["$delete_status", false] },
                    ],
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
          },
        },
      ]);
      if (addresses.length > 0) {
        selected_address = addresses[0];
      } else {
        selected_address = collectionpoints[0];
      }
    } else {
      selected_address = address;
    }
  }

  if (!selected_address && has_realtime) {
    selected_address = user_addresses[0];
  } else if (!selected_address && !has_realtime) {
    let addresses = await CP.aggregate([
      {
        $match: {
          suburb_id: ObjectId(active_suburb),
          approved: true,
          delete_status: false,
          rejected: false,
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: {
            cp_id: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$collectionpoint_id", "$$cp_id"] },
                    { $eq: ["$delete_status", false] },
                  ],
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
        },
      },
    ]);
    if (addresses.length > 0) {
      selected_address = addresses[0];
    } else {
      selected_address = collectionpoints[0];
    }
  }

  return {
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
  };
}

exports.cart = async (req, res) => {
  if (!req.session._id || !req.session.role == "user") {
    return res.redirect(res.locals.app_url + "/home");
  }

  let { current_shift } = await this.getComingShift();
  if (!current_shift) {
    req.session.cart = [];
    req.session.accessories = [];
    return res.redirect(res.locals.app_url + "/menu");
  }

  let shift_name = await getShiftNameById(current_shift);
  let has_realtime = 0;
  if (shift_name == "Dinner") {
    has_realtime = 1;
  }

  let setting = await Setting.findOne();
  let gst = setting.gst;
  let service_charge_square = setting.service_charge_square;
  let service_charge_paypal = setting.service_charge_paypal;
  let delivery_charge = setting.delivery_charge;
  let user = await User.findOne({ _id: ObjectId(req.session._id) });
  let delivery_address = req.session.delivery_address;

  // return res.json({
  //   delivery_address
  // })
  let {
    user_addresses,
    collectionpoints,
    selected_address,
    active_suburb,
  } = await getAddressesByUser({
    user_id: user._id,
    delivery_address,
    has_realtime,
  });

  let suburbs = await Suburb.aggregate([
    {
      $match: {
        delete_status: false,
      },
    },
  ]);

  let user_credits = 0;
  if (user) {
    if (typeof user.credits != undefined) {
      user_credits = user.credits.food;
    }
  }

  let companies = await Company.find({ delete_status: false });
  return res.render("web/cart", {
    suburbs,
    delivery_address: selected_address._id,
    gst,
    collectionpoints,
    user_addresses,
    delivery_charge,
    first_order_status: !user.first_order,
    service_charge_square,
    service_charge_paypal,
    user_credits,
    companies,
    has_realtime,
  });
};

exports.getCartRegularProducts = async (req, res) => {
  let cart = req.session.cart;
  let products = [];
  if (typeof cart != "undefined" && cart.length > 0) {
    cart_products = [];
    cart.forEach((prod) => {
      cart_products.push({
        product_id: ObjectId(prod.product_id),
        count: prod.count,
      });
    });
    products = await Product.aggregate([
      {
        $match: {
          delete_status: false,
          is_regular: true,
        },
      },
      {
        $lookup: {
          from: "products",
          let: { products: cart_products },
          pipeline: [
            {
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
                  $and: [
                    { $eq: ["$_id", "$products.product_id"] },
                    { $eq: ["$is_regular", true] },
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
                count: "$products.count",
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
        $match: {
          $expr: {
            $and: [{ $eq: ["$_id", "$products._id"] }],
          },
        },
      },
      {
        $project: {
          _id: 1,
          cover_pic: 1,
          type: 1,
          delete_status: 1,
          name: 1,
          price: 1,
          description: 1,
          image: 1,
          count: "$products.count",
        },
      },
    ]);
  }
  return res.json({
    status: true,
    products,
  });
};

exports.getCartAccessories = async (req, res) => {
  let accessories = req.session.accessories;
  let accessories_array = [];
  if (accessories && accessories.length > 0) {
    accessories.forEach((prod) => {
      let { product_id, count } = prod;
      accessories_array.push({
        product_id: ObjectId(product_id),
        count: parseInt(count),
      });
    });
  }
  let products = await Product.aggregate([
    {
      $match: {
        delete_status: false,
        type: "ACCESSORIES",
      },
    },
    {
      $lookup: {
        from: "products",
        let: {
          product_id: "$_id",
          accessories: accessories_array,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$product_id"] },
                  { $eq: ["$delete_status", false] },
                  { $eq: ["$type", "ACCESSORIES"] },
                ],
              },
            },
          },
          {
            $addFields: {
              accessories: "$$accessories",
            },
          },
          {
            $unwind: "$accessories",
          },
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$accessories.product_id"],
              },
            },
          },
          {
            $project: {
              count: "$accessories.count",
            },
          },
        ],
        as: "count",
      },
    },
    {
      $addFields: {
        count: {
          $cond: {
            if: {
              $gte: [
                {
                  $arrayElemAt: ["$count.count", 0],
                },
                0,
              ],
            },
            then: {
              $arrayElemAt: ["$count.count", 0],
            },
            else: 0,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        cover_pic: 1,
        type: 1,
        delete_status: 1,
        name: 1,
        price: 1,
        description: 1,
        image: 1,
        products: 1,
        count: 1,
      },
    },
  ]);

  return res.json({
    status: true,
    products,
  });
};

exports.getCollectionPoints = async (req, res) => {
  // let { coming_shift } = await this.getComingShift()
  let { selected_suburb } = req.query;
  let query = [
    {
      $match: {
        delete_status: false,
        approved: true,
      },
    },
  ];

  if (selected_suburb) {
    query.push(
      {
        $lookup: {
          from: "addresses",
          let: { cp_id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$collectionpoint_id", "$$cp_id"] },
                    { $eq: ["$type", "COLLECTION_POINT"] },
                    { $eq: ["$delete_status", false] },
                    { $eq: ["$suburb_id", ObjectId(selected_suburb)] },
                  ],
                },
              },
            },
          ],
          as: "addresses",
        },
      },
      {
        $addFields: {
          suburb_exists: {
            $size: "$addresses",
          },
        },
      },
      {
        $match: {
          suburb_exists: {
            $gte: 1,
          },
        },
      }
    );
  } else {
    query.push({
      $lookup: {
        from: "addresses",
        let: { cp_id: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$type", "COLLECTION_POINT"] },
                  { $eq: ["$delete_status", false] },
                ],
              },
            },
          },
        ],
        as: "addresses",
      },
    });
  }

  query.push({
    $project: {
      _id: 1,
      name: 1,
      image: 1,
      email: 1,
      mobile: 1,
      address: {
        _id: {
          $arrayElemAt: ["$addresses._id", 0],
        },
        address_line1: {
          $arrayElemAt: ["$addresses.address_line1", 0],
        },
        address_line2: {
          $arrayElemAt: ["$addresses.address_line2", 0],
        },
        location: {
          $arrayElemAt: ["$addresses.location", 0],
        },
      },
      location: {
        $arrayElemAt: ["$addresses.location", 0],
      },
    },
  });

  let collectionpoints = await CP.aggregate(query);
  return res.json({
    status: true,
    collectionpoints,
  });
};

exports.getAddressDetails = async (req, res) => {
  let { address_id } = req.query;
  if (!address_id) {
    return res.json({
      status: true,
      address: null,
    });
  }
  let address = await Address.findOne({
    _id: ObjectId(address_id),
  })
    .lean()
    .exec();
  if (address.type == "COLLECTION_POINT") {
    let cp = await CP.findOne({ _id: ObjectId(address.collectionpoint_id) });
    address.name = cp.name;
  }
  return res.json({
    status: true,
    address,
  });
};

let getStockBySuburbRealtime = async (data) => {
  let { shift_id, suburb, cp_id } = data;
  let stock = [];
  if (cp_id) {
    stock = CP_STOCK.aggregate([
      {
        $match: {
          collectionpoint_id: ObjectId(cp_id),
          date: new Date(moment().format("YYYY-MM-DD")),
          delete_status: false,
          shift_id: ObjectId(shift_id),
        },
      },
      {
        $unwind: "$products",
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$products.product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
          ],
          as: "product",
        },
      },
      {
        $addFields: {
          product: {
            $arrayElemAt: ["$product", 0],
          },
        },
      },
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          stock: "$products.stock",
          shift_id: "$shift_id",
          collectionpoint_id: "$collectionpoint_id",
        },
      },
      {
        //check booked products
        $lookup: {
          from: "bookings",
          let: {
            product_id: "$_id",
            shift_id: "$shift_id",
            cp_id: "$driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$redeemed", false] },
                    { $eq: ["$shift_id", "$$shift_id"] },
                    { $eq: ["$delete_status", false] },
                    // { $eq: ["$delivery_type", "ONLINE"] },
                    { $eq: ["$collectionpoint_id", "$$cp_id"] },
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
              $match: {
                $expr: {
                  $eq: ["$$product_id", "$orders.product_id"],
                },
              },
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
          as: "booked_products",
        },
      },
      {
        $addFields: {
          order_quantity: {
            $arrayElemAt: ["$booked_products.quantity", 0],
          },
        },
      },
      {
        $addFields: {
          order_quantity: {
            $cond: {
              if: { $gte: ["$order_quantity", 0] },
              then: "$order_quantity",
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          stock: {
            $subtract: ["$stock", "$order_quantity"],
          },
        },
      },
    ]);
  } else {
    let active_drivers = [];
    let driver_res = await Stock.aggregate([
      {
        $match: {
          date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(shift_id),
          suburb_id: ObjectId(suburb),
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
              $match: {
                type: "DELIVERY",
                $expr: {
                  $and: [{ $eq: ["$_id", "$$driver_id"] }],
                },
              },
            },
            ////////////////////////////////////////anis////////////////////////////
            {
              $lookup: {
                from: "driver_logs",
                let: {
                  driver_id: "$_id",
                  shift_id: ObjectId(shift_id),
                  date: new Date(moment().format("YYYY-MM-DD")),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$driver_id", "$$driver_id"] },
                          { $eq: ["$shift_id", "$$shift_id"] },
                          { $eq: ["$date", "$$date"] },
                        ],
                      },
                    },
                  },
                ],
                as: "driver_log",
              },
            },
            {
              $addFields: {
                driver_log: {
                  $arrayElemAt: ["$driver_log", 0],
                },
              },
            },
            {
              $addFields: {
                service_started: {
                  $cond: {
                    if: {
                      $or: [
                        { $ne: ["$driver_log.callback_time", null] },
                        { $ne: ["$driver_log.service_end_time", null] },
                      ],
                    },
                    then: false,
                    else: true,
                  },
                },
              },
            },
            //////////////////////////anis//////////////////////////
          ],
          as: "driver",
        },
      },
      {
        $addFields: {
          service_started: {
            $arrayElemAt: ["$driver.service_started", 0],
          },
        },
      },
      {
        $match: {
          service_started: true,
        },
      },
      {
        $group: {
          _id: "$driver_id",
        },
      },
    ]);

    driver_res.forEach((driver) => {
      active_drivers.push(ObjectId(driver._id));
    });

    console.log(active_drivers)

    stock = await Stock.aggregate([
      {
        $match: {
          date: new Date(moment().format("YYYY-MM-DD")),
          shift_id: ObjectId(shift_id),
          driver_id: {
            $in: active_drivers,
          },
          // suburb_id: ObjectId(suburb)
        },
      },
      {
        $unwind: "$products",
      },
      {
        $match: {
          "products.stock": {
            $gt: 0,
          },
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$products.product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$product_id"],
                },
              },
            },
          ],
          as: "product",
        },
      },
      {
        $addFields: {
          product: {
            $arrayElemAt: ["$product", 0],
          },
        },
      },
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          stock: "$products.stock",
          driver_id: "$driver_id",
          shift_id: "$shift_id",
        },
      },
      {
        $group: {
          _id: "$_id",
          name : {
            $first : "$name"
          },
          stock :{
            $sum: "$stock"
          },
          driver_id: {
            $first : "$driver_id"
          },
          shift_id: {
            $first: "$shift_id",
          },
        },
      },
      {
        //check booked products
        $lookup: {
          from: "bookings",
          let: {
            product_id: "$_id",
            shift_id: "$shift_id",
            driver_id: "$driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$redeemed", false] },
                    { $eq: ["$shift_id", "$$shift_id"] },
                    { $eq: ["$delete_status", false] },
                    { $eq: ["$delivery_type", "ONLINE"] },
                    { $eq: ["$driver_id", "$$driver_id"] },
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
              $match: {
                $expr: {
                  $eq: ["$$product_id", "$orders.product_id"],
                },
              },
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
          as: "booked_products",
        },
      },
      {
        $addFields: {
          order_quantity: {
            $arrayElemAt: ["$booked_products.quantity", 0],
          },
        },
      },
      {
        $addFields: {
          order_quantity: {
            $cond: {
              if: { $gte: ["$order_quantity", 0] },
              then: "$order_quantity",
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          // stock: "$stock"
          stock: {
            $subtract: ["$stock", "$order_quantity"],
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          stock: 1
        }
      },
    ]);
  }
  return stock;
};

exports.getAddressDetailsRealtime = async (req, res) => {
  let { current_shift } = await this.getComingShift();
  let { address_id } = req.query;
  if (!address_id) {
    return res.json({
      status: true,
      address: null,
    });
  }
  let address = await Address.findOne({
    _id: ObjectId(address_id),
  })
    .lean()
    .exec();

  if (address.type == "COLLECTION_POINT") {
    let cp = await CP.findOne({ _id: ObjectId(address.collectionpoint_id) });
    address.name = cp.name;
  }

  let has_expres_delivery = true;
  if (address.type == "USER") {
    let checkSuburb = await checkSuburbForRealTimeDelivery(
      address.suburb_id,
      current_shift
    );
    if (!checkSuburb) {
      has_expres_delivery = false;
    }
  }

  let stock = await getStockBySuburbRealtime({
    shift_id: current_shift,
    suburb: address.suburb_id,
    cp_id: address.collectionpoint_id ? address.collectionpoint_id : null,
  });
  return res.json({
    status: true,
    address,
    stock,
    has_expres_delivery,
  });
};

exports.getMenu = async (req, res) => {
  let { type } = req.query;
  let is_regular = false;
  if (!type || type == "REGULAR") {
    is_regular = true;
  }
  let products = await Product.aggregate([
    {
      $match: {
        delete_status: false,
        type: "FOOD",
        is_regular,
      },
    },
  ]);
  return res.render("web/menu", {
    products,
  });
};

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

exports.getnewMenu = async (req, res) => {
  let { current_shift } = await this.getComingShift();
  let shift_name = await getShiftName(current_shift);
  let setting = await Setting.findOne();
  if (!req.session._id || !req.session.role == "user") {
    return res.redirect(res.locals.app_url + "/login");
  }
  return res.render("web/newmenu", {
    gst: setting.gst,
    shift_name,
  });
};

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
    distance: 1500,
    date: new Date(moment().format("YYYY-MM-DD")),
  });
  console.log(booking_slot);
  await booking_slot.save();

  // slots = await BookingSlot.aggregate([
  //   {
  //     $geoNear: {
  //       near: location,
  //       key: "location",
  //       spherical: true,
  //       distanceField: "distance",
  //       distanceMultiplier: 0.001,
  //       query: {
  //         shift_id: ObjectId(shift_id),
  //         driver_id: ObjectId(driver_id),
  //       },
  //     },
  //   },
  //   {
  //     $match: {
  //       shift_id: ObjectId(shift_id),
  //       date: new Date(moment().format("YYYY-MM-DD")),
  //       driver_id: ObjectId(driver_id),
  //     },
  //   },
  // ]);

  // slots.forEach(async (slot) => {
  //   let { _id, distance } = slot;
  //   if (_id && distance) {
  //     await BookingSlot.updateOne(
  //       {
  //         _id: ObjectId(_id),
  //       },
  //       {
  //         $set: {
  //           distance: parseFloat(distance),
  //         },
  //       }
  //     );
  //   }
  // });

  return true;
};

exports.refreshSlots = async (req, res) => {
  shift_id = "5f578a3a6c3b9f18f893e082";
  driver_id = "5fae329eb3fbba0af8b7da71";
  let driver = await Driver.findOne({ _id: ObjectId(driver_id) });

  slots = await BookingSlot.aggregate([
    {
      $geoNear: {
        near: driver.location,
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
  return res.json({
    status: true,
    slots,
  });
};

exports.checkStockAvailability = async (data) => {
  let {
    products,
    current_shift,
    address: {
      suburb_id,
      _id: address_id,
      collectionpoint_id,
      user_id,
      type,
      location,
    },
  } = data;

  products = products.map((product) => {
    return {
      product_id: ObjectId(product.product_id),
      count: parseInt(product.count),
    };
  });

  let stock_check = false;
  if (type == "USER") {
    // console.log({ suburb_id });

    let active_drivers = [];

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
          _id: "$driver_id",
        },
      },
    ]);

    drivers_rec.forEach((driver) => {
      active_drivers.push(ObjectId(driver._id));
    });

    let stock_status_check = await Stock.aggregate([
      {
        $match: {
          delete_status: false,
          shift_id: ObjectId(current_shift),
          driver_id: {
            $in: active_drivers,
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
                distanceField: 1
              }
            },
            ////////////////////////////////////////anis////////////////////////////
            {
              $lookup: {
                from: "driver_logs",
                let: {
                  driver_id: "$_id",
                  shift_id: ObjectId(current_shift),
                  date: new Date(moment().format("YYYY-MM-DD")),
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$driver_id", "$$driver_id"] },
                          { $eq: ["$shift_id", "$$shift_id"] },
                          { $eq: ["$date", "$$date"] },
                        ],
                      },
                    },
                  },
                ],
                as: "driver_log",
              },
            },
            {
              $addFields: {
                driver_log: {
                  $arrayElemAt: ["$driver_log", 0],
                },
              },
            },
            {
              $addFields: {
                service_started: {
                  $cond: {
                    if: {
                      $or: [
                        { $ne: ["$driver_log.callback_time", null] },
                        { $ne: ["$driver_log.service_end_time", null] },
                      ],
                    },
                    then: false,
                    else: true,
                  },
                },
              },
            },
            //////////////////////////anis//////////////////////////
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
          service_started: true,
        },
      },
      {
        $unwind: "$products",
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products,
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
            // suburb_id: "$suburb_id",
            driver_id: "$driver_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$redeemed", false] },
                    { $eq: ["$shift_id", "$$shift_id"] },
                    { $eq: ["$delete_status", false] },
                    { $eq: ["$delivery_type", "ONLINE"] },
                    { $eq: ["$driver_id", "$$driver_id"] },
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
              input: products,
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
            $gt: [{ $size: "$required_product" }, 0],
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
      // {
      //   $project: {
      //     _id: 1,
      //     booking_stock: 1,
      //     driver_id: 1,
      //     product: {
      //       _id: "$products.product_id",
      //       stock: "$products.stock",
      //       count: "$required_product.count",
      //     },
      //     booking_product: 1,
      //   },
      // },
      // {
      //   $addFields: {
      //     has_stock: {
      //       $cond: {
      //         if: { $lte: ["$product.count", "$product.stock"] },
      //         then: true,
      //         else: false,
      //       },
      //     },
      //   },
      // },
      // {
      //   $group: {
      //     _id: "$_id",
      //     driver_id: {
      //       $first: "$driver_id",
      //     },
      //     insufficient_products: {
      //       $push: {
      //         $cond: [
      //           {
      //             $eq: ["$has_stock", false],
      //           },
      //           { id: "$product._id", stock: "$product.stock" },
      //           null,
      //         ],
      //       },
      //     },
      //   },
      // },
      // {
      //   $addFields: {
      //     insufficient_products: {
      //       $filter: {
      //         input: "$insufficient_products",
      //         as: "product",
      //         cond: {
      //           $ne: ["$$product", null],
      //         },
      //       },
      //     },
      //   },
      // },
      // {
      //   $addFields: {
      //     insufficient_stock: {
      //       $cond: {
      //         if: { $gte: [{ $size: "$insufficient_products" }, 1] },
      //         then: true,
      //         else: false,
      //       },
      //     },
      //   },
      // },
      // {
      //   $match: {
      //     insufficient_stock: false,
      //   },
      // },
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

    let drivers = [];
    if (stock_status_check.length > 0) {
      stock_check = true;
      stock_status_check.forEach((rec) => {
        let { _id } = rec;
        drivers.push(_id);
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
        $unwind: "$products",
      },
      {
        $addFields: {
          required_product: {
            $filter: {
              input: products,
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
              input: products,
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

let checkSuburbForRealTimeDelivery = async (suburb_id, current_shift) => {
  let status = false;
  let check = await Suburb.findOne({
    _id: ObjectId(suburb_id),
    has_online_delivery: { $in: [current_shift] },
  }).countDocuments();
  if (check) {
    status = true;
  }
  return status;
};

exports.checkOut = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    let gst = setting.gst;
    let service_charge_square = setting.service_charge_square;
    let service_charge_paypal = setting.service_charge_paypal;
    let delivery_charge = setting.delivery_charge;

    let { current_shift } = await this.getComingShift();
    let shift_id = null;
    if (!current_shift) {
      return res.json({
        status: false,
        message: "No service at this time!!",
      });
    } else {
      shift_id = ObjectId(current_shift);
    }

    let user = await User.findOne({ _id: ObjectId(req.session._id) });
    let total_item_count = 0;
    let product_price = 0;
    let discount_price = 0;
    let coupon_value = 0;
    let gst_price = 0;
    let total_price = 0;
    let applied_coupon = null;
    let delivery_type = "COLLECTIONPOINT";
    let first_order_price = 0;
    let tot_delivery_charge = 0;
    let address = null;
    let driver_id = null;
    let service_charge = 0;
    let orders = [];
    let credit_used = 0;

    //get data from request body
    let {
      products,
      address_id,
      coupon,
      accessories,
      pay_from_credit,
      selected_service_val,
    } = req.body;

    //check credit exists
    pay_from_credit = parseInt(pay_from_credit);
    if (!pay_from_credit || res.locals.food_credit <= 0) {
      pay_from_credit = 0;
    }

    //check product exists
    if (typeof products == "undefined" || products.length <= 0) {
      return res.json({
        status: false,
        message: "No Products added to cart",
      });
    }

    //check address exists
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

    if (address.type == "USER") {
      let checkSuburb = await checkSuburbForRealTimeDelivery(
        address.suburb_id,
        current_shift
      );
      if (!checkSuburb) {
        return res.json({
          status: false,
          message: "No delivery service in your suburb",
        });
      }
    }

    //check driver\ collectionpoint availability
    let checkproducts = products;
    if (typeof accessories != "undefined" && accessories.length > 0) {
      checkproducts.concat(accessories);
    }

    let {
      stock_check,
      drivers,
      collectionpoint,
    } = (data = await this.checkStockAvailability({
      products: checkproducts,
      current_shift,
      address,
    }));

    if (!stock_check) {
      if (collectionpoint) {
        return res.json({
          status: false,
          message:
            "The selected collection point has not enough stock to supply",
        });
      } else {
        return res.json({
          status: false,
          message: "No driver in your suburb has enough stock to supply",
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
              distance: 1,
            },
          },
          {
            $match: {
              _id: {
                $in: drivers,
              },
            },
          },
        ]);
        if (av_drivers.length) {
          driver_id = av_drivers[0]._id;
        } else {
          return res.json({
            status: false,
            message:
              "We dont have delivery partner with these stock. Please choose pickup option.",
          });
        }
        // driver_id = drivers.shift();
      }
    }

    //*********************stock check completed******************************//

    //push product to orders
    for (i = 0; i < products.length; i++) {
      let prod = await Product.findOne({
        _id: ObjectId(products[i].product_id),
      });
      products[i]["price"] = prod.price;
    }

    products.forEach((product, index) => {
      if (index == 0) {
        if (user.first_order == false) {
          first_order_price = product.price;
          first_order_delivery_charge = delivery_charge;
          first_order_price += +first_order_delivery_charge;
        }
      }
      product_price += +product.count * +product.price;
      total_item_count += +product.count;
      let details = {
        product_id: product.product_id,
        quantity: product.count,
        price: product.price,
      };
      orders.push(details);
    });

    //end push product to orders

    //push accessories to orders
    if (typeof accessories != "undefined") {
      for (i = 0; i < accessories.length; i++) {
        let prod = await Product.findOne({
          _id: ObjectId(accessories[i].product_id),
        });
        let details = {
          product_id: accessories[i].product_id,
          quantity: accessories[i].count,
          price: prod.price,
        };
        product_price += +accessories[i].count * +prod.price;
        orders.push(details);
      }
    }
    //end push accessories to orders

    if (address.type == "USER") {
      delivery_type = "ONLINE";
      tot_delivery_charge = +delivery_charge * +total_item_count;
      console.log({
        tot_delivery_charge,
        delivery_charge,
        total_item_count,
      });
      if (total_item_count < 3) {
        return res.json({
          status: false,
          message: "There must be a minimum of 3 items ordered for delivery.",
        });
      }
    }

    //check coupon code
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
          coupon_value = coupon_code.val;
          coupon_code.count = coupon_code.count - 1;
          applied_coupon = coupon;
        }
      }
    }
    //end check coupon code

    //check service_charge
    let total_without_service_charge = 0;
    total_without_service_charge =
      +product_price + +tot_delivery_charge - +first_order_price;

    if (service_charge_square && selected_service_val == "square") {
      service_charge = total_without_service_charge * (service_charge_square / 100);
    } else if (service_charge_square && selected_service_val == "paypal") {
      service_charge = total_without_service_charge * (service_charge_paypal / 100);
    }

    //check credit used
    if (pay_from_credit) {
      if (total_without_service_charge > res.locals.food_credits) {
        if (service_charge_square && selected_service_val == "square") {
          service_charge =
            (total_without_service_charge - res.locals.food_credits) *
            (service_charge_square / 100);
        }else if(service_charge_paypal && selected_service_val == "paypal"){
          service_charge =
            (total_without_service_charge - res.locals.food_credits) *
            (service_charge_paypal / 100);
        }
      } else if (total_without_service_charge <= res.locals.food_credits) {
        service_charge = 0;
      }
    }
    //end check credit used

    // total_without_service_charge - credit_used
    total_price = total_without_service_charge + service_charge;

    if (coupon_value) {
      discount_price = total_price * (coupon_value / 100);
      total_price = total_price - discount_price;
      if (total_price < 0) {
        total_price = 0;
      }
    }

    if (pay_from_credit) {
      if (total_price > res.locals.food_credits) {
        credit_used = res.locals.food_credits;
      } else if (total_price <= res.locals.food_credits) {
        credit_used = total_price;
      }
    }

    if (gst) {
      if (total_price) {
        gst_price = gst * (total_price / 100);
      }
    }

    let tmp_payment = new TmpPayment({
      user_id: req.session._id,
      date: new Date(moment().format("YYYY-MM-DD")),
      actual_price: product_price,
      discount_price,
      gst: gst_price,
      total_price: total_price,
      delivery_charge: tot_delivery_charge,
      service_charge,
    });

    if (credit_used) {
      tmp_payment.is_credit = true;
      tmp_payment.credit_used = credit_used;
    }

    await tmp_payment.save();

    let tmp_booking = new TmpBooking({
      address_id: ObjectId(address_id),
      tmp_payment_id: tmp_payment._id,
      user_id: req.session._id,
      booking_type: "REALTIME",
      delivery_type,
      shift_id,
      scheduled_date: new Date(moment().format("YYYY-MM-DD")),
      date: new Date(moment().format("YYYY-MM-DD")),
      orders,
      coupon: applied_coupon,
    });

    address.type == "COLLECTION_POINT"
      ? (tmp_booking.collectionpoint_id = address.collectionpoint_id)
      : (tmp_booking.user_id = address.user_id);

    if (address.type == "USER") {
      tmp_booking.driver_id = Object(driver_id);
    }

    await tmp_booking.save();

    if (total_price - credit_used > 0) {

      if(selected_service_val == "square"){

        let data = await createOrder({
          booking_id: tmp_booking._id,
          payment_id: tmp_payment._id,
          app_url: res.locals.app_url,
          first_order_price,
          credit_amount: credit_used,
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

      } else if(selected_service_val == "paypal") {
        
        let data = await createOrderPaypal({  
          credit_amount: total_price - credit_used,
          app_url: res.locals.app_url,
        });

        let { status, link : payment_page, id : checkout_id } = data;

        if(!status){
          return res.json({
            status : false,
            message : "Scheduled order failed"
          })
        }

        if (typeof payment_page == undefined || !payment_page) {
          await tmp_booking.remove();
          await tmp_payment.remove();
          throw new Error("Payment error");
        } else {
          tmp_payment.checkout_id = checkout_id;
          tmp_payment.gateway = "paypal"
          await tmp_payment.save();
          if (coupon_code) await coupon_code.save();
          //req.session.cart = [];
          return res.json({
            status: true,
            message: "Booking has been saved",
            payment_page,
          });
        }

      }else{
        return res.json({
          status: false,
          message: "Please select the payment gateway"
        })
      }
      

    } else {
      let newpayment = new Payment({
        user_id: req.session._id,
        date: tmp_payment.date,
        actual_price: tmp_payment.actual_price,
        discount_price: tmp_payment.discount_price,
        gst: tmp_payment.gst,
        total_price: tmp_payment.total_price,
        payment_type: tmp_payment.payment_type,
        delivery_charge: tmp_payment.delivery_charge,
      });

      if (total_price > 0 && parseInt(credit_used) > 0) {
        newpayment.is_credit = true;
        newpayment.credit_used = total_price;
      }

      await newpayment.save();

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
      if (tmp_booking.booking_type == "SCHEDULED") {
        booking_id = `${config.SCHEDULED_BOOKING_ID_PREFIX}${
          parseInt(bk_id) + 1
        }`;
      } else {
        booking_id = `${config.REALTIME_BOOKING_ID_PREFIX}${
          parseInt(bk_id) + 1
        }`;
      }

      booking.booking_id = booking_id;
      booking.payment_id = newpayment._id;
      booking.user_id = req.session._id;
      booking.booking_type = tmp_booking.booking_type;
      booking.address_id = tmp_booking.address_id;
      booking.delivery_type = tmp_booking.delivery_type;
      tmp_booking.delivery_type == "ONLINE"
        ? (booking.address_id = tmp_booking.address_id)
        : (booking.collectionpoint_id = tmp_booking.collectionpoint_id);
      booking.shift_id = tmp_booking.shift_id;
      booking.orders = tmp_booking.orders;
      booking.qrcode = await getDataUrl(booking_id);
      booking.scheduled_date = new Date(moment().format("YYYY-MM-DD"));
      booking.created_at = new Date(moment().format("YYYY-MM-DD HH:mm"));
      if (tmp_booking.delivery_type == "ONLINE") {
        booking.driver_id = ObjectId(tmp_booking.driver_id);
      }
      await booking.save();
      if (booking.delivery_type == "ONLINE") {
        await this.allocateSlot({
          shift_id: booking.shift_id,
          driver_id: booking.driver_id,
          booking_id: booking._id,
          address_id: booking.address_id,
        });
      }

      if (parseInt(credit_used) > 0) {
        user.credits.food = user.credits.food - +credit_used;
        await user.save();
      }

      sendOrderConfirm.add({
        booking_id: booking._id,
        total: tmp_booking.tmp_payment_id.total_price,
        name: user.name,
        email: user.email,
      });

      await TmpPayment.deleteOne({ _id: tmp_booking.tmp_payment_id._id });
      await TmpBooking.deleteOne({ _id: tmp_booking._id });
      if (coupon_code) await coupon_code.save();

      if (user) {
        let { first_order, reffered_by } = user;
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
          user.first_order = true;
          await user.save();
          addCreditByReferal.add({ to_user: reffered_by, from_user: user._id });
        }
      }

      return res.json({
        status: true,
        message: "Payment completed",
        payment_page: res.locals.app_url + "/success",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({
      status: false,
      message: "Could not process payment, Please try again",
    });
  }
};

exports.getcoupon = async (req, res) => {
  let { voucher, address_id } = req.query;
  let address = await Address.findOne({ _id: ObjectId(address_id) });
  if (address) {
    console.log({
      suburb_id: address.suburb_id,
    });

    let coupon_used = await Booking.findOne({
      coupon: voucher,
      user_id: ObjectId(req.session._id),
    }).countDocuments();

    if (coupon_used) {
      return res.json({
        status: false,
        message: "Coupon already applied",
      });
    }

    let coupon_code = await Coupon.findOne({
      suburbs: ObjectId(address.suburb_id),
      code: voucher,
      delete_status: false,
      active_status: true,
      count: {
        $gt: 0,
      },
    });

    if (coupon_code) {
      return res.json({
        status: true,
        coupon: coupon_code,
      });
    } else {
      return res.json({
        status: false,
        message: "Invalid voucher",
      });
    }
  } else {
    return res.json({
      status: false,
      message: "Invalid voucher",
    });
  }
};

exports.setaddress = async (req, res) => {
  let { address_id } = req.query;
  req.session.delivery_address = address_id;
  return res.json({
    status: true,
  });
};

exports.removeFromCart = async (req, res) => {
  let { product } = req.query;
  let cart = req.session.cart;

  cart = _.without(
    cart,
    _.findWhere(cart, {
      product_id: product,
    })
  );

  req.session.cart = cart;

  return res.json({
    status: true,
    message: "Product removed from to cart",
  });
};
