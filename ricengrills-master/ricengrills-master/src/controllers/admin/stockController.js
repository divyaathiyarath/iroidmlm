const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const Box = mongoose.model("boxes");
const Sensor = mongoose.model("sensors");
const Setting = mongoose.model("settings");
const Suburb = mongoose.model("suburbs");
const CollectionPoint = mongoose.model("collectionpoints");
const ExcessStock = mongoose.model("excessstocks");
const Booking = mongoose.model("bookings");
const Product = mongoose.model("products");
const Driver = mongoose.model("drivers");
const Vehicle = mongoose.model("vehicles");
const Stock = mongoose.model("stocks");
const BookingSlot = mongoose.model("booking_slots");
const DriverLog = mongoose.model("driver_logs");
const Address = mongoose.model("addresses");
const moment = require("moment");
const _ = require("underscore");
const _lodash = require("lodash");
let { validateStockInputs } = require("../../validators/stockValidator");
const { isObjectLike } = require("lodash");
let { allocateSlot } = require("../../controllers/web/cartController");

exports.getComingShift = async () => {
  let offset = Math.abs(new Date().getTimezoneOffset());
  let today = moment().format("YYYY-MM-DD");
  let cur_date = moment()
    .utcOffset(+offset)
    .format("YYYY-MM-DD HH:mm");

  let query = [
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
  ];

  let current_slot = await Setting.aggregate([
    ...query,
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
  console.log({ current_slot });

  let next_slot = await Setting.aggregate([
    ...query,
    {
      $match: {
        $expr: {
          $and: [{ $gte: ["$current_date", "$start"] }],
        },
      },
    },
    {
      $skip: 1,
    },
    {
      $limit: 1,
    },
  ]);

  let shifts = await Setting.aggregate(query);

  if ((currentslot = current_slot.shift())) {
    next_slot = next_slot.shift();
    next_shift_date = new Date(moment().format("YYYY-MM-DD"));
    coming_shift_date = new Date(moment().format("YYYY-MM-DD"));
    if (!next_slot) {
      next_slot = shifts[0];
      next_shift_date = new Date(moment().add(1, "days").format("YYYY-MM-DD"));
    }
    return {
      coming_shift: currentslot._id,
      coming_shift_name: currentslot.name,
      coming_shift_date,
      next_shift: next_slot._id,
      next_shift_name: next_slot.name,
      next_shift_date,
      shifts: shifts,
    };
  } else if (shifts.length > 0) {
    next_shift_date = new Date(moment().add(1, "days").format("YYYY-MM-DD"));
    coming_shift_date = new Date(moment().format("YYYY-MM-DD"));
    return {
      coming_shift: shifts[0]._id,
      coming_shift_name: shifts[0].name,
      coming_shift_date,
      next_shift: (shifts[1]?shifts[1]._id:shifts[0]._id),
      next_shift_name: (shifts[1]?shifts[1].name:shifts[0].name),
      shifts: shifts,
    };
  }
};

exports.getStocks = async (suburb_id, shift_id, type) => {
  return await Stock.aggregate([
    {
      $match: {
        date: new Date(moment().format("YYYY-MM-DD")),
        shift_id: ObjectId(shift_id),
        type: type,
        suburb_id: ObjectId(suburb_id),
      },
    },
    {
      $lookup: {
        from: "settings",
        let: { shift_id: "$shift_id" },
        pipeline: [
          { $unwind: "$shift_times" },
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$shift_times._id", "$$shift_id"] }],
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
        ],
        as: "shifts",
      },
    },
    {
      $addFields: {
        shift: { $arrayElemAt: ["$shifts", 0] },
      },
    },
    {
      $lookup: {
        from: "drivers",
        let: { driver_id: "$driver_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$driver_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              mobile: 1,
            },
          },
        ],
        as: "drivers",
      },
    },
    {
      $addFields: {
        driver: { $arrayElemAt: ["$drivers", 0] },
      },
    },
    {
      $lookup: {
        from: "vehicles",
        let: { vehicle_id: "$vehicle_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$vehicle_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              registration_number: 1,
            },
          },
        ],
        as: "vehicles",
      },
    },
    {
      $addFields: {
        vehicle: { $arrayElemAt: ["$vehicles", 0] },
      },
    },
    {
      $lookup: {
        from: "suburbs",
        let: { suburb_id: "$suburb_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$suburb_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
        as: "suburbs",
      },
    },
    {
      $addFields: {
        suburb: { $arrayElemAt: ["$suburbs", 0] },
      },
    },
    {
      $project: {
        _id: 1,
        products: 1,
        shift: 1,
        suburb: 1,
        driver: 1,
        vehicle: 1,
      },
    },
    { $unwind: "$products" },
    {
      $match: {
        $expr: {
          $and: [{ $gt: ["$products.stock", 0] }],
        },
      },
    },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$products.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              price: 1,
              type: 1,
            },
          },
        ],
        as: "product",
      },
    },
    {
      $lookup: {
        from: "boxes",
        let: { box_id: "$products.box_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$box_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              uid: 1,
            },
          },
        ],
        as: "box",
      },
    },
    {
      $project: {
        _id: 1,
        product: {
          _id: "$products.product_id",
          name: {
            $arrayElemAt: ["$product.name", 0],
          },
          price: {
            $arrayElemAt: ["$product.price", 0],
          },
          type: {
            $arrayElemAt: ["$product.type", 0],
          },
          box_uid: {
            $arrayElemAt: ["$box.uid", 0],
          },
          box_id: "$products.box_id",
          stock: "$products.stock",
        },
        suburb: 1,
        shift: 1,
        driver: 1,
        vehicle: 1,
      },
    },
    {
      $group: {
        _id: "$_id",
        products: {
          $addToSet: {
            $arrayElemAt: ["$product", 0],
          },
        },
        suburb: { $first: "$suburb" },
        shift: { $first: "$shift" },
        driver: { $first: "$driver" },
        vehicle: { $first: "$vehicle" },
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
  ]);
};

exports.getVehicles = async (type) => {
  return await Vehicle.aggregate([
    {
      $match: {
        delete_status: false,
        type,
      },
    },
  ]);
};

exports.getDrivers = async (type, shift_id) => {
  return await Driver.aggregate([
    {
      $match: {
        delete_status: false,
        is_approved: true,
        type,
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        mobile: 1,
        vehicle_id: 1,
      },
    },
  ]);
};

exports.getProducts = async (regular) => {
  if (regular) {
    return await Product.aggregate([
      {
        $match: {
          delete_status: false,
          $expr: {
            $or: [
              { $eq: ["$is_regular", true] },
              { $eq: ["$type", "ACCESSORIES"] },
            ],
          },
        },
      },
      {
        $sort: {
          type: -1,
        },
      },
    ]);
  } else {
    return await Product.aggregate([
      {
        $match: {
          delete_status: false,
        },
      },
    ]);
  }
};

exports.getExcessStock = async (collection_point_ids, shift_id) => {
  return await ExcessStock.aggregate([
    {
      $match: {
        collectionpoint_id: {
          $in: collection_point_ids,
        },
        shift_id: ObjectId(shift_id),
      },
    },
    {
      $unwind: "$products",
    },
    {
      $group: {
        _id: {
          product_id: "$products.product_id",
        },
        count: { $sum: "$products.quantity" },
      },
    },
    {
      $project: {
        _id: "$_id.product_id",
        count: 1,
      },
    },
  ]);
};

exports.getScheduledStock = async (suburb_id, shift_id) => {
  let scheduled_bookings = await Booking.aggregate([
    {
      $match: {
        booking_type: "SCHEDULED",
        delete_status: false,
        $expr: {
          $and: [
            {
              $gte: [
                "$scheduled_date",
                new Date(moment().format("YYYY-MM-DD")),
              ],
            },
            {
              $lt: [
                "$scheduled_date",
                new Date(moment().add(1, "days").format("YYYY-MM-DD")),
              ],
            },
          ],
        },
        shift_id: ObjectId(shift_id),
      },
    },
    {
      $lookup: {
        from: "addresses",
        let: { address_id: "$address_id" },
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
        as: "addresses",
      },
    },
    {
      $addFields: {
        suburb_id: {
          $arrayElemAt: ["$addresses.suburb_id", 0],
        },
      },
    },
    {
      $match: {
        suburb_id: ObjectId(suburb_id),
      },
    },
    {
      $unwind: "$orders",
    },
    // {
    //     $project: {
    //         _id: 1,
    //         product_id: '$orders.product_id',
    //         quantity: '$orders.quantity',
    //     }
    // },
    {
      $group: {
        _id: {
          product_id: "$orders.product_id",
        },
        count: { $sum: "$orders.quantity" },
      },
    },
    {
      $project: {
        _id: "$_id.product_id",
        count: 1,
      },
    },
  ]);
  return scheduled_bookings;
};

exports.toCollection = function (obj) {
  return Object.keys(obj)
    .sort(function (x, y) {
      return +x - +y;
    })
    .map(function (k) {
      return {
        _id: k,
        count: obj[k].count,
      };
    });
};

exports.getGroupedArray = async (data) => {
  let result = data.reduce(function (acc, x) {
    var id = acc[x._id];
    // console.log({acc,x,id})
    if (id) {
      id.count += x.count;
    } else {
      acc[x._id] = x;
      delete x._id;
    }
    return acc;
  }, {});
  return this.toCollection(result);
};

exports.getCurrentStock = async (stock_id) => {
  return await Stock.aggregate([
    {
      $match: {
        _id: ObjectId(stock_id),
      },
    },
    {
      $lookup: {
        from: "settings",
        let: { shift_id: "$shift_id" },
        pipeline: [
          { $unwind: "$shift_times" },
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$shift_times._id", "$$shift_id"] }],
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
        ],
        as: "shifts",
      },
    },
    {
      $addFields: {
        shift: { $arrayElemAt: ["$shifts", 0] },
      },
    },
    {
      $lookup: {
        from: "drivers",
        let: { driver_id: "$driver_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$driver_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              mobile: 1,
            },
          },
        ],
        as: "drivers",
      },
    },
    {
      $addFields: {
        driver: { $arrayElemAt: ["$drivers", 0] },
      },
    },
    {
      $lookup: {
        from: "vehicles",
        let: { vehicle_id: "$vehicle_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$vehicle_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              registration_number: 1,
            },
          },
        ],
        as: "vehicles",
      },
    },
    {
      $addFields: {
        vehicle: { $arrayElemAt: ["$vehicles", 0] },
      },
    },
    {
      $lookup: {
        from: "suburbs",
        let: { suburb_id: "$suburb_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$suburb_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
        as: "suburbs",
      },
    },
    {
      $addFields: {
        suburb: { $arrayElemAt: ["$suburbs", 0] },
      },
    },
    {
      $project: {
        _id: 1,
        products: 1,
        shift: 1,
        suburb: 1,
        driver: 1,
        vehicle: 1,
      },
    },
    { $unwind: "$products" },
    // {
    //   $match: {
    //     $expr: {
    //       $and: [{ $gt: ["$products.stock", 0] }],
    //     },
    //   },
    // },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$products.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              price: 1,
              type: 1,
            },
          },
        ],
        as: "product",
      },
    },
    {
      $lookup: {
        from: "boxes",
        let: { box_id: "$products.box_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$box_id"] }],
              },
            },
          },
          {
            $project: {
              _id: 1,
              uid: 1,
            },
          },
        ],
        as: "box",
      },
    },
    {
      $project: {
        _id: 1,
        product: {
          _id: "$products.product_id",
          name: {
            $arrayElemAt: ["$product.name", 0],
          },
          price: {
            $arrayElemAt: ["$product.price", 0],
          },
          type: {
            $arrayElemAt: ["$product.type", 0],
          },
          box_uid: {
            $arrayElemAt: ["$box.uid", 0],
          },
          box_id: "$products.box_id",
          stock: "$products.stock",
        },
        suburb: 1,
        shift: 1,
        driver: 1,
        vehicle: 1,
      },
    },
    {
      $group: {
        _id: "$_id",
        products: {
          $addToSet: {
            $arrayElemAt: ["$product", 0],
          },
        },
        suburb: { $first: "$suburb" },
        shift: { $first: "$shift" },
        driver: { $first: "$driver" },
        vehicle: { $first: "$vehicle" },
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
  ]);
};

exports.new = async (req, res) => {
  let { shifts, coming_shift } = await this.getComingShift();
  let suburbs = await Suburb.find({ delete_status: false });
  return res.render("admin/stocks/new", {
    coming_shift,
    shifts,
    suburbs,
  });
};

exports.save = async (req, res) => {
  const { errors, isValid } = validateStockInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  let {
    suburb_id,
    shift_id,
    type,
    driver_id,
    vehicle_id,
    products,
    accessories,
    boxes,
  } = req.body;

  if (!vehicle_id) {
    driver = await Driver.findOne({ _id: ObjectId(driver_id) });
    vehicle_id = driver.vehicle_id;
  }

  stock = await  Stock.findOne({
    suburb_id,
    shift_id,
    //type,
    driver_id,
    vehicle_id,
    date: moment().format("YYYY-MM-DD"),
  });

  if(stock){
    return res.json({
      stock,
      status: false,
      message: "Stock already added to this driver for same location please edit the stock details"
    })
  }

  stock = new Stock({
    suburb_id,
    shift_id,
    type,
    driver_id,
    vehicle_id,
    date: moment().format("YYYY-MM-DD"),
  });

  let insert_products = [];
  if (products) {
    _.map(products, function (stock, product_id) {
      if (stock) {
        insert_products.push({
          product_id,
          stock,
        });
      }
    });
  }

  let insert_boxes = [];
  let boxes_array = [];
  if (boxes) {
    _.map(boxes, function (box_id, product_id) {
      insert_boxes.push({
        product_id,
        box_id,
      });
      boxes_array.push(box_id);
    });
  }

  let box_not_assigned = 0;

  let products_array = _.map(insert_products, function (product) {
    var box = _.findWhere(insert_boxes, { product_id: product.product_id });
    if (!box) {
      box_not_assigned = 1;
    }
    return _.extend(product, box);
  });

  if (accessories) {
    _.map(accessories, function (stock, product_id) {
      if (stock) {
        products_array.push({
          product_id,
          stock,
        });
      }
    });
  }

  if (box_not_assigned) {
    return res.json({
      status: false,
      message: "Please assign all selected products to boxes",
    });
  }

  if (products_array.length <= 0) {
    return res.json({
      status: false,
      message: "Please add at least one product",
    });
  }

  stock.products = products_array;
  stock.initial_stock = products_array;
  stock.boxes = boxes_array;

  await stock.save();
  return res.json({
    status: true,
    message: "Stock added successfully",
  });
};

exports.list = async (req, res) => {
  let { search, page, limit } = req.query;
  let { shifts, coming_shift, next_shift } = await this.getComingShift();

  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }

  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }

  let query = [
    {
      $match: {
        date: new Date(moment().format("YYYY-MM-DD")),
        // shift_id: {
        //   $in: [
        //     ObjectId(coming_shift),
        //     ObjectId(next_shift)
        //   ]
        // }
      },
    },
    {
      $lookup: {
        from: "drivers",
        let: { driver_id: "$driver_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$driver_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              mobile: "mobile",
              email: "$type",
            },
          },
        ],
        as: "driver",
      },
    },
    {
      $addFields: {
        driver: {
          $arrayElemAt: ["$driver", 0],
        },
      },
    },
    {
      $lookup: {
        from: "suburbs",
        let: { suburb_id: "$suburb_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$suburb_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
            },
          },
        ],
        as: "suburb",
      },
    },
    {
      $addFields: {
        suburb: {
          $arrayElemAt: ["$suburb", 0],
        },
      },
    },
    {
      $lookup: {
        from: "settings",
        let: { shift_id: "$shift_id" },
        pipeline: [
          { $unwind: "$shift_times" },
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$shift_times._id", "$$shift_id"],
                  },
                ],
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
        ],
        as: "shifts",
      },
    },
    {
      $match: {
        $expr: {
          $gt: [{ $size: "$shifts" }, 0],
        },
      },
    },
    {
      $lookup: {
        from: "products",
        let: { products: "$products" },
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
              stock: "$products.stock",
              box_id: "$products.box_id",
            },
          },
        ],
        as: "products",
      },
    },
    {
      $addFields: {
        shift: { $arrayElemAt: ["$shifts", 0] },
      },
    },
  ];

  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { "driver.name": regex },
          { "suburb.name": regex },
          { "shift.name": regex },
        ],
      },
    });
  }

  let itemCount = await Stock.aggregate([
    ...query,
    {
      $count: "count",
    },
  ]);

  query.push(
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      $sort: {
        shift_id: -1,
      },
    }
  );
  let stocks = await Stock.aggregate(query);

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
  } else {
    itemCount = 0;
  }

  const pageCount = Math.ceil(itemCount / limit);

  return res.render("admin/stocks/list", {
    search,
    stocks,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  });
};

exports.checkOrderAssigned = async (data) => {
  let { stock_id, driver_id, suburb_id, coming_shift } = data;
  try {
    let booking = await Booking.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$driver_id", ObjectId(driver_id)] },
              { $eq: ["$shift_id", ObjectId(coming_shift)] },
              {
                $and: [
                  {
                    $gte: [new Date(moment().format("YYYY-MM-DD")), "$scheduled_date"],
                  },
                  {
                    $lte: [
                      new Date(moment().format("YYYY-MM-DD 23:59")),
                      "$scheduled_date",
                    ],
                  },
                ],
              },
            ],
          },
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
              $lookup: {
                from: "suburbs",
                let: {
                  suburb_id: "$suburb_id",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [{ $eq: ["$$suburb_id", "$_id"] }],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: "$_id",
                      name: "$name",
                    },
                  },
                ],
                as: "suburb",
              },
            },
            {
              $addFields: {
                suburb: {
                  $arrayElemAt: ["$suburb", 0],
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
        $match: {
          $expr: {
            $eq: ["$address.suburb._id", ObjectId(suburb_id)],
          },
        },
      },
      {
        $count: "count",
      }
    ]);
    booking = booking.shift();
    if (booking && booking.count > 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.log(err);
    return err;
  }
};

exports.checkTripStarted = async (data) => {
  let { stock_id, driver_id, suburb_id, coming_shift } = data;
  try {
    let count = await DriverLog.find({
      driver_id: ObjectId(driver_id),
      suburb_id: ObjectId(suburb_id),
      shift_id: ObjectId(coming_shift),
      date: new Date(moment().format("YYYY-MM-DD")),
    }).countDocuments();
    if (count) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    return true;
  }
};

exports.delete = async (req, res) => {
  const { stock_id, driver_id, suburb_id, shift_id } = req.body;

  let order_assinged = await this.checkOrderAssigned({
    stock_id,
    driver_id,
    suburb_id,
    coming_shift: shift_id,
  });

  // return res.json({ status: false, order_assinged });

  if (order_assinged) {
    return res.json({
      status: false,
      message: "Order already assigned to this driver",
    });
  }

  let tripstarted = await this.checkTripStarted({
    stock_id,
    driver_id,
    suburb_id,
    coming_shift: shift_id,
  });
  if (tripstarted) {
    return res.json({
      status: false,
      message: "Trip already started",
    });
  }

  await Stock.deleteOne({
    _id: ObjectId(stock_id),
  });
  return res.json({
    status: true,
    message: "Stock deleted successfully",
  });
};

exports.edit = async (req, res) => {
  let { stock_id } = req.params;
  let { shifts, coming_shift } = await this.getComingShift();
  let stock = await Stock.findOne({ _id: ObjectId(stock_id) });
  if (!stock_id) {
    res.redirect(res.locals.app_url + "/stocks/new");
  }
  let suburbs = await Suburb.find({ delete_status: false });
  return res.render("admin/stocks/edit", {
    stock,
    suburbs,
    shifts,
    coming_shift,
  });
};

exports.update = async (req, res) => {
  const { errors, isValid } = validateStockInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  let {
    suburb_id,
    shift_id,
    type,
    driver_id,
    vehicle_id,
    products,
    accessories,
    boxes,
    stock_id,
  } = req.body;

  if (!vehicle_id) {
    driver = await Driver.findOne({ _id: ObjectId(driver_id) });
    vehicle_id = driver.vehicle_id;
  }
  var stock = await Stock.findOne({ _id: ObjectId(stock_id) });
  if (!stock) {
    return res.json({
      status: false,
      message: "Could not edit this stock, stock not found",
    });
  } else {
    stock.suburb_id = suburb_id;
    stock.shift_id = shift_id;
    stock.type = type;
    stock.driver_id = driver_id;
    stock.vehicle_id = vehicle_id;
    stock.date = moment().format("YYYY-MM-DD");
  }

  let insert_products = [];
  if (products) {
    _.map(products, function (stock, product_id) {
      if (stock) {
        insert_products.push({
          product_id,
          stock,
        });
      }
    });
  }

  let insert_boxes = [];
  let boxes_array = [];
  if (boxes) {
    _.map(boxes, function (box_id, product_id) {
      insert_boxes.push({
        product_id,
        box_id,
      });
      boxes_array.push(box_id);
    });
  }

  let box_not_assigned = 0;

  let products_array = _.map(insert_products, function (product) {
    var box = _.findWhere(insert_boxes, { product_id: product.product_id });
    if (!box) {
      box_not_assigned = 1;
    }
    return _.extend(product, box);
  });

  if (accessories) {
    _.map(accessories, function (stock, product_id) {
      if (stock) {
        products_array.push({
          product_id,
          stock,
        });
      }
    });
  }

  if (box_not_assigned) {
    return res.json({
      status: false,
      message: "Please assign all selected products to boxes",
    });
  }

  if (products_array.length <= 0) {
    return res.json({
      status: false,
      message: "Please add at least one product",
    });
  }

  stock.products = products_array;
  stock.initial_stock = products_array;
  stock.boxes = boxes_array;

  await stock.save();
  return res.json({
    status: true,
    message: "Stock updated successfully",
  });
};

exports.check = async (req, res) => {
  let { suburb_id, shift_id, type, stock_id } = req.query;

  if (typeof type == "undefined" || !type) {
    type = "DELIVERY";
  }

  if (typeof stock_id == "undefined" || !stock_id) {
    stock_id = "";
  }

  // console.log({ type })

  let collection_points = await CollectionPoint.aggregate([
    {
      $match:{
        delete_status:false,
        approved:true
      }
    },
    {
      $lookup: {
        from: "addresses",
        localField: "_id",
        foreignField: "collectionpoint_id",
        as: "address",
      },
    },
    {
      $addFields: {
        suburb_id: {
          $arrayElemAt: ["$address.suburb_id", 0],
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
        _id: 1,
      },
    },
  ]);
  let collection_point_ids = [];
  collection_points.forEach((cp) => {
    collection_point_ids.push(ObjectId(cp._id));
  });

  let excess_stocks = [];
  let drivers = [];
  let products = [];
  let vehicles = [];
  let stocks = [];
  let scheduled_stocks = [];
  let required_stocks = [];
  let current_stock = [];

  switch (type) {
    case "DELIVERY":
      products = await this.getProducts((regular = true));
      drivers = await this.getDrivers("DELIVERY", shift_id);
      vehicles = await this.getVehicles("DELIVERY", shift_id);
      stocks = await this.getStocks(suburb_id, shift_id, type);
      if (stock_id) current_stock = await this.getCurrentStock(stock_id);

      //get required stocks for a suburb
      scheduled_stocks = await this.getScheduledStock(suburb_id, shift_id);
      required_stocks = scheduled_stocks;

      break;

    case "REFILLING":
      excess_stocks = await this.getExcessStock(collection_point_ids, shift_id);
      scheduled_stocks = await this.getScheduledStock(suburb_id, shift_id);
      products = await this.getProducts((regular = true));
      drivers = await this.getDrivers("REFILLING", shift_id);
      vehicles = await this.getVehicles("REFILLING", shift_id);
      stocks = await this.getStocks(suburb_id, shift_id, type);
      if (stock_id) current_stock = await this.getCurrentStock(stock_id);

      required_stocks = excess_stocks.concat(scheduled_stocks);
      required_stocks = await this.getGroupedArray(required_stocks);

      break;

    case "BULK":
      products = await this.getProducts((regular = false));
      drivers = await this.getDrivers("REFILLING");
      vehicles = await this.getVehicles("REFILLING");
      stocks = await this.getStocks(suburb_id, shift_id, type);
      if (stock_id) current_stock = await this.getCurrentStock(stock_id);

      break;
  }

  return res.json({
    status: true,
    drivers,
    products,
    vehicles,
    stocks,
    required_stocks,
    current_stock,
  });
};

exports.reports = async (req, res) => {
  let { from_date, to_date, page, limit, search } = req.query;

  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }

  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }

  if (from_date) {
    from_date = new Date(moment(from_date).format("YYYY-MM-DD 00:00:000"));
  } else {
    from_date = new Date(moment().format("YYYY-MM-DD 00:00:000"));
  }

  if (to_date) {
    to_date = new Date(moment(to_date).format("YYYY-MM-DD 23:59"));
  } else {
    to_date = new Date(moment().format("YYYY-MM-DD 23:59"));
  }

  let query = [
    {
      $match: {
        delete_status: false,
        $expr: {
          $and: [{ $gte: ["$date", from_date] }, { $lte: ["$date", to_date] }],
        },
      },
    },
    {
      $lookup: {
        from: "settings",
        let: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
          shift_id: "$shift_id",
        },
        pipeline: [
          {
            $unwind: "$shift_times",
          },
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$shift_times._id", "$$shift_id"],
                  },
                ],
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
              start: { $toDate: { $concat: ["$$date", " ", "$time"] } },
              end: { $toDate: { $concat: ["$$date", " ", "$time"] } },
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
      $lookup: {
        from: "drivers",
        let: { driver_id: "$driver_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$driver_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              mobile: "mobile",
              email: "$type",
            },
          },
        ],
        as: "driver",
      },
    },
    {
      $addFields: {
        driver: {
          $arrayElemAt: ["$driver", 0],
        },
      },
    },
    {
      $lookup: {
        from: "suburbs",
        let: { suburb_id: "$suburb_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$suburb_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
            },
          },
        ],
        as: "suburb",
      },
    },
    {
      $addFields: {
        suburb: {
          $arrayElemAt: ["$suburb", 0],
        },
      },
    },
  ];

  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [{ "driver.name": regex }, { "suburb.name": regex }],
      },
    });
  }

  let itemCount = await Stock.aggregate([
    ...query,
    {
      $group: {
        _id: "$_id",
      },
    },
    {
      $count: "count",
    },
  ]);

  let stocks = await Stock.aggregate([
    ...query,
    {
      $unwind: "$initial_stock",
    },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$initial_stock.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              type: "$type",
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
        _id: 1,
        suburb: 1,
        driver: 1,
        shift: 1,
        products: 1,
        initial_stock: {
          _id: "$initial_stock._id",
          product_id: "$initial_stock.product_id",
          stock: "$initial_stock.stock",
          box_id: "$initial_stock.box_id",
          product_name: "$product.name",
        },
        type: 1,
        date: 1,
      },
    },
    {
      $group: {
        _id: "$_id",
        suburb: {
          $first: "$suburb",
        },
        driver: {
          $first: "$driver",
        },
        shift: {
          $first: "$shift",
        },
        type: {
          $first: "$type",
        },
        date: {
          $first: "$date",
        },
        final_stock: {
          $first: "$products",
        },
        products: {
          $addToSet: "$initial_stock",
        },
      },
    },
    {
      $unwind: "$final_stock",
    },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$final_stock.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              type: "$type",
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
        _id: 1,
        suburb: 1,
        driver: 1,
        shift: 1,
        products: 1,
        type: 1,
        date: 1,
        final_stock: {
          _id: "$final_stock._id",
          product_id: "$final_stock.product_id",
          stock: "$final_stock.stock",
          box_id: "$final_stock.box_id",
          product_name: "$product.name",
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        suburb: {
          $first: "$suburb",
        },
        driver: {
          $first: "$driver",
        },
        shift: {
          $first: "$shift",
        },
        type: {
          $first: "$type",
        },
        date: {
          $first: "$date",
        },
        final_stocks: {
          $addToSet: "$final_stock",
        },
        products: {
          $first: "$products",
        },
      },
    },
    {
      $sort: {
        _id: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  // return res.json({stocks})

  let total_product_stocks = await Stock.aggregate([
    ...query,
    {
      $unwind: "$initial_stock",
    },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$initial_stock.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              type: "$type",
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
        _id: 1,
        suburb: 1,
        driver: 1,
        shift: 1,
        products: 1,
        initial_stock: {
          _id: "$initial_stock._id",
          product_id: "$initial_stock.product_id",
          stock: "$initial_stock.stock",
          box_id: "$initial_stock.box_id",
          product_name: "$product.name",
        },
        type: 1,
        date: 1,
      },
    },
    {
      $group: {
        _id: "$initial_stock.product_id",
        name: {
          $first: "$initial_stock.product_name",
        },
        stock: {
          $sum: "$initial_stock.stock",
        },
      },
    },
  ]);

  let total_final_stocks = await Stock.aggregate([
    ...query,
    {
      $unwind: "$products",
    },
    {
      $lookup: {
        from: "products",
        let: { product_id: "$products.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$product_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              type: "$type",
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
      },
    },
    {
      $group: {
        _id: "$_id",
        name: {
          $first: "$name",
        },
        final_stock: {
          $sum: "$stock",
        },
      },
    },
  ]);

  // return res.json({
  //   total_final_stocks
  // })

  var merged = _lodash.merge(
    _lodash.keyBy(total_final_stocks, "_id"),
    _lodash.keyBy(total_product_stocks, "_id")
  );
  total_product_stocks = _lodash.values(merged);

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
  } else {
    itemCount = 0;
  }

  const pageCount = Math.ceil(itemCount / limit);
  // return res.json({stocks})
  return res.render("admin/stocks/reports", {
    search,
    stocks,
    total_product_stocks,
    from_date: moment(from_date).format("YYYY-MM-DD"),
    to_date: moment(to_date).format("YYYY-MM-DD"),
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  });
};

// exports.getScheduledOrdersBySuburbId = async (req, res) => {
//   let { suburb_id,shift_id } = req.params
//   let today = moment().format("YYYY-MM-DD");
//   let stocks = await Booking.aggregate([
//     {
//         $match:{
//             booking_type:"SCHEDULED",
//             delete_status:false,
//             redeemed:false,
//             delivery_type:"ONLINE",
//             // shift_id:ObjectId(shift_id),
//             // scheduled_date:today,
//         }
//     },  {
//       $lookup:{
//           from:"addresses",
//           let:{
//               address_id: "$address_id",
//               suburb_id: ObjectId(suburb_id)
//           },
//           pipeline:[
//               {
//                   $match:{
//                       $expr:{
//                           $and:[
//                               {$eq:["$_id","$$address_id"]},
//                               {$eq: ["$suburb_id", "$$suburb_id"]}
//                           ]
//                       }
//                   }
//               },
//               {
//                   $addFields:{
//                       suburb:{
//                           $arrayElemAt:["$suburb",0]
//                       }
//                   }
//               }
//           ],
//           as: 'address'
//       },
//     },
//     {
//       $unwind: "$address"
//     },
//     {
//         $lookup:{
//           from: "users",
//           let: { user_id: "$user_id" },
//           pipeline: [
//             {
//               $match: {
//                 $expr: { $eq: ["$_id", "$$user_id"] },
//               },
//             },
//             {
//               $project: {
//                 _id: 1,
//                 name: "$name",
//               },
//             },
//           ],
//           as: "users",
//         },
//       },
//     {
//         $project:{
//             booking_id:1,
//             address_id:1,
//             scheduled_date:1,
//             user: {
//                 $arrayElemAt: ["$users", 0]
//               }
//         }
//     }
// ])
// // return res.json({stocks})
// return res.render("admin/scheduledorders/list",{stocks})
// }

exports.getScheduledOrdersBySuburbId = async (req, res) => {
  let { search, page, limit, status } = req.query;
  let { suburb_id, shift_id, driver_id } = req.params;

  if (typeof limit == "undefined") {
    limit = 20;
  }
  if (typeof page == "undefined") {
    page = 1;
  }

  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit;
  }

  let query = [
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$delete_status", false] },
            // { $eq: ["$redeemed", false] },
            { $in: ["$booking_type", ["SCHEDULED", "REALTIME"]] },
            { $eq: ["$delivery_type", "ONLINE"] },
            { $eq: ["$shift_id", ObjectId(shift_id)] },
            {
              $or: [
                { $eq: [{ $ifNull: ["$driver_id", false] }, false] },
                { $eq: ["$driver_id", ObjectId(driver_id)] },
              ],
            },
            {
              $and: [
                {
                  $gte: ["$scheduled_date", new Date(moment().format("YYYY-MM-DD"))],
                },
                {
                  $lte: [
                    "$scheduled_date",
                    new Date(moment().format("YYYY-MM-DD 23:59")),
                  ],
                },
              ],
            },
          ],
        },
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
            $lookup: {
              from: "suburbs",
              let: {
                suburb_id: "$suburb_id",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ["$$suburb_id", "$_id"] }],
                    },
                  },
                },
                {
                  $project: {
                    _id: "$_id",
                    name: "$name",
                  },
                },
              ],
              as: "suburb",
            },
          },
          {
            $addFields: {
              suburb: {
                $arrayElemAt: ["$suburb", 0],
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
      $match: {
        $expr: {
          $eq: ["$address.suburb._id", ObjectId(suburb_id)],
        },
      },
    },
    {
      $lookup: {
        from: "users",
        let: {
          user_id: "$user_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ["$_id", "$$user_id"] }],
              },
            },
          },
          {
            $project: {
              _id: "$_id",
              name: "$name",
              email: "$email",
              mobile: "$mobile",
            },
          },
        ],
        as: "user",
      },
    },
    {
      $addFields: {
        user: {
          $arrayElemAt: ["$user", 0],
        },
      },
    },
  ];

  //  let result = await Booking.aggregate(query)
  //  return res.json({
  //    result
  //  })

  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          {
            "user.name": regex,
          },
          {
            "user.mobile": regex,
          },
          { "user.email": regex },
          { "address.suburb.name": regex },
        ],
      },
    });
  }

  if (status === "0" || status == "1") {
    let redeemed = false;
    if (status === "1") {
      redeemed = true;
    }
    query.push({
      $match: {
        $and: [
          {
            redeemed: redeemed,
          },
        ],
      },
    });
  }

  query.push(
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
              duration: "$shift_times.duration",
              time: "$shift_times.time",
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
        created_at: -1,
      },
    }
  );

  let orders = await Booking.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
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
                $and: [{ $eq: ["$_id", "$$product_id"] }],
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
          price: "$orders.price",
        },
        address: 1,
        driver_id: 1,
      },
    },
    {
      $group: {
        _id: "$_id",
        booking_type: {
          $first: "$booking_type",
        },
        redeemed: {
          $first: "$redeemed",
        },
        booking_id: {
          $first: "$booking_id",
        },
        created_at: {
          $first: "$created_at",
        },
        scheduled_date: {
          $first: "$scheduled_date",
        },
        user: {
          $first: "$user",
        },
        shift: {
          $first: "$shift",
        },
        orders: {
          $addToSet: "$product",
        },
        address: {
          $first: "$address",
        },
        driver_id: {
          $first: "$driver_id",
        },
      },
    },
    {
      $sort: {
        created_at: -1,
      },
    },
  ]);

  let itemCount = await Booking.aggregate([
    ...query,
    {
      $count: "count",
    },
  ]);

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
  } else {
    itemCount = 0;
  }
  const pageCount = Math.ceil(itemCount / limit);
  // return res.json(orders)
  res.render("admin/scheduledorders/newlist", {
    orders,
    search,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
    status,
    driver_id,
  });
};

exports.scheduledApproval = async (req, res) => {
  let { id: order_id, approve, driver_id } = req.body;
  let booking = await Booking.findOne({ _id: ObjectId(order_id) });
  if (booking) {
    if (approve == 1) {
      booking.driver_id = driver_id;
    } else {
      booking.driver_id = null;
    }
    await booking.save();
    if (booking.delivery_type == "ONLINE") {
      if (approve == 1) {
        await allocateSlot({
          shift_id: booking.shift_id,
          driver_id: booking.driver_id,
          booking_id: booking._id,
          address_id: booking.address_id,
          date: new Date(moment().format("YYYY-MM-DD")),
        });
      } else {
        await BookingSlot.deleteOne({
          booking_id: ObjectId(booking._id),
        });
      }
    }
  }
  return res.json({
    status: true,
  });
};
