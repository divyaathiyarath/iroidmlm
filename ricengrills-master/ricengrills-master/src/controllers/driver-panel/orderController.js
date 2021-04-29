const mongoose = require("mongoose");
const ExcessStock = mongoose.model("excessstocks");
const Stock = mongoose.model("stocks");
const Setting = mongoose.model("settings");
const Address = mongoose.model("addresses");
const Product = mongoose.model("products");
const StockRequest = mongoose.model("stock_requests");
const StockTransfer = mongoose.model("stock_transfers");
const CPStock = mongoose.model("cp_stocks");
const CP = mongoose.model("collectionpoints");
let ObjectId = mongoose.Types.ObjectId;
const moment = require("moment");
const _ = require("underscore");
const { getComingShift, getUserLocation } = require("./dashboardController");
const stock_transfers = require("../../models/stock_transfers");
const { session } = require("passport");

exports.index = async (req, res) => {
  let { current_shift } = await getComingShift();
  let active_shift = "";
  if (current_shift) {
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
        $match: {
          _id: ObjectId(current_shift),
        },
      },
    ]);
    if (shifts.length > 0) {
      active_shift = shifts[0].name;
    }
  }
  res.render("driver-panel/orders/list", {
    current_shift,
    active_shift,
  });
};

exports.checkDelivered = async (cp_id, shift_id) => {
  return await CPStock.find({
    collectionpoint_id: ObjectId(cp_id),
    shift_id: ObjectId(shift_id),
    date: new Date(moment().format("YYYY-MM-DD")),
  }).count();
};

exports.submit = async (req, res) => {
  let { cp_id } = req.params;
  let { current_shift: shift_id } = await getComingShift();
  if ((count = await this.checkDelivered(cp_id, shift_id))) {
    return res.redirect(res.locals.app_url + "/orders");
  }
  let active_shift = "";
  if (shift_id) {
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
        $match: {
          _id: ObjectId(shift_id),
        },
      },
    ]);
    if (shifts.length > 0) {
      active_shift = shifts[0].name;
    }
  } else {
    return res.redirect(res.locals.app_url + "/orders");
  }

  //get required stock and product details
  let collectionpoints = await Address.aggregate([
    {
      $match: {
        $expr: {
          $eq: ["$collectionpoint_id", ObjectId(cp_id)],
        },
        delete_status: false,
        type: "COLLECTION_POINT",
      },
    },
    {
      $lookup: {
        from: "collectionpoints",
        let: {
          cp_id: "$collectionpoint_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$cp_id"] },
                  { $eq: ["$delete_status", false] },
                  { $eq: ["$approved", true] },
                ],
              },
            },
          },
        ],
        as: "collectionpoint",
      },
    },
    {
      $addFields: {
        collectionpoint: {
          $arrayElemAt: ["$collectionpoint", 0],
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
                $and: [
                  { $eq: ["$_id", "$$suburb_id"] },
                  { $eq: ["$delete_status", false] },
                ],
              },
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
      $sort: {
        distance: 1,
      },
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
        address_id: "$_id",
        location: 1,
        suburb_id: 1,
        suburb: "$suburb.name",
        distance: 1,
      },
    },
    {
      $lookup: {
        from: "excessstocks",
        let: {
          cp_id: "$_id",
          shift_id: ObjectId(shift_id),
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$shift_id", "$$shift_id"] },
                  { $eq: ["$delete_status", false] },
                ],
              },
            },
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              _id: "$products.product_id",
              quantity: "$products.quantity",
            },
          },
        ],
        as: "excessstocks",
      },
    },
    {
      $lookup: {
        from: "bookings",
        let: {
          shift_id: ObjectId(shift_id),
          address_id: "$address_id",
          date: new Date(moment().format("YYYY-MM-DD")),
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$address_id", "$$address_id"] },
                  { $eq: ["$shift_id", "$$shift_id"] },
                  { $eq: ["$scheduled_date", "$$date"] },
                  { $eq: ["$redeemed", false] },
                ],
              },
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
        ],
        as: "bookings",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        contact_name: 1,
        email: 1,
        mobile: 1,
        image: 1,
        address_line1: 1,
        address_line2: 1,
        address_id: 1,
        location: 1,
        suburb_id: 1,
        suburb: 1,
        distance: 1,
        products: { $concatArrays: ["$bookings", "$excessstocks"] },
      },
    },
    {
      $unwind: "$products",
    },
    {
      $lookup: {
        from: "products",
        let: {
          product_id: "$products._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$product_id"] },
                  { $eq: ["$delete_status", false] },
                ],
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
      $match:{
        product:{
          $ne: null
        }
      }
    },
    {
      $group: {
        _id: "$_id",
        address_id: {
          $first: "$address_id",
        },
        address_line1: {
          $first: "$address_line1",
        },
        address_line2: {
          $first: "$address_line2",
        },
        contact_name: {
          $first: "$contact_name",
        },
        distance: {
          $first: "$distance",
        },
        distance: {
          $first: "$distance",
        },
        email: {
          $first: "$email",
        },
        location: {
          $first: "$location",
        },
        mobile: {
          $first: "$mobile",
        },
        name: {
          $first: "$name",
        },
        suburb: {
          $first: "$suburb",
        },
        suburb_id: {
          $first: "$suburb_id",
        },
        products: {
          $addToSet: {
            _id: "$product._id",
            name: "$product.name",
            quantity: {
              $sum: "$products.quantity",
            },
          },
        },
      },
    },
  ]);

  let collectionpoint = null;
  if (collectionpoints && collectionpoints.length > 0) {
    collectionpoint = collectionpoints[0];
    let { products } = collectionpoint;
    if(products.length > 0){
      let sorted_array = [];
      let product_ids = Array.from(new Set(products.map(product=>{
        return product._id.toString()
      }))); 
      sorted_array = product_ids.map(product_id=>{
        tmp_products = products.filter((prod)=>{
          return prod._id.toString() == product_id
        }) 
        product = tmp_products[0];
        stock = tmp_products.reduce((total, prod)=>{
          return total + +prod.quantity
        },0)
        product.quantity = +stock 
        return product;
      })
      collectionpoint.products = sorted_array;      
    } 
  }

  let address = await Address.findOne({ collectionpoint_id: ObjectId(cp_id) });
  let suburb_id = address.suburb_id;

  // return res.json(collectionpoint)

  return res.render("driver-panel/orders/submit", {
    collectionpoint,
    shift_id,
    suburb_id,
  });
  
};

exports.getCollectionPointsWithRequiredStocks = async (req, res) => {
  let { shift_id } = req.query;
  let { lat, lng } = await getUserLocation(req.session._id);
  console.log({
    lat,
    lng,
  });
  if (!shift_id) {
    return res.json({
      status: true,
      stocks: [],
    });
  }
  let stocks = await Stock.find({
    delete_status: false,
    driver_id: ObjectId(req.session._id),
    shift_id: ObjectId(shift_id),
    date: new Date(moment().format("YYYY-MM-DD")),
  });
  let suburbs = [];
  stocks.forEach((stock) => {
    suburbs.push(ObjectId(stock.suburb_id));
  });

  let collectionpoints = await Address.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [parseFloat(lat), parseFloat(lng)],
        },
        key: "location",
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 0.001,
        query: {
          delete_status: false,
        },
      },
    },
    {
      $match: {
        $expr: {
          $in: ["$suburb_id", suburbs],
        },
        delete_status: false,
        type: "COLLECTION_POINT",
      },
    },
    {
      $lookup: {
        from: "collectionpoints",
        let: {
          cp_id: "$collectionpoint_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$cp_id"] },
                  { $eq: ["$delete_status", false] },
                  { $eq: ["$approved", true] },
                ],
              },
            },
          },
        ],
        as: "collectionpoint",
      },
    },
    {
      $addFields: {
        collectionpoint: {
          $arrayElemAt: ["$collectionpoint", 0],
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
                $and: [
                  { $eq: ["$_id", "$$suburb_id"] },
                  { $eq: ["$delete_status", false] },
                ],
              },
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
      $sort: {
        distance: 1,
      },
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
        address_id: "$_id",
        location: 1,
        suburb_id: 1,
        suburb: "$suburb.name",
        distance: 1,
      },
    },
    {
      $lookup: {
        from: "excessstocks",
        let: {
          cp_id: "$_id",
          shift_id: ObjectId(shift_id),
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$shift_id", "$$shift_id"] },
                  { $eq: ["$delete_status", false] },
                ],
              },
            },
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              _id: "$products.product_id",
              quantity: "$products.quantity",
            },
          },
        ],
        as: "excessstocks",
      },
    },
    {
      $lookup: {
        from: "bookings",
        let: {
          shift_id: ObjectId(shift_id),
          address_id: "$address_id",
          date: new Date(moment().format("YYYY-MM-DD")),
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$address_id", "$$address_id"] },
                  { $eq: ["$shift_id", "$$shift_id"] },
                  { $eq: ["$scheduled_date", "$$date"] },
                  { $eq: ["$redeemed", false] },
                ],
              },
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
        ],
        as: "bookings",
      },
    },
    {
      $lookup: {
        from: "cp_stocks",
        let: {
          cp_id: "$_id",
          shift_id: ObjectId(shift_id),
          date: new Date(moment().format("YYYY-MM-DD")),
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$collectionpoint_id", "$$cp_id"] },
                  { $eq: ["$shift_id", "$$shift_id"] },
                  { $eq: ["$delete_status", false] },
                  { $eq: ["$date", "$$date"] },
                ],
              },
            },
          },
          {
            $unwind: "$products",
          },
          {
            $project: {
              _id: "$products.product_id",
              quantity: "$products.stock",
            },
          },
        ],
        as: "cp_stocks",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        contact_name: 1,
        email: 1,
        mobile: 1,
        image: 1,
        address_line1: 1,
        address_line2: 1,
        address_id: 1,
        location: 1,
        suburb_id: 1,
        suburb: 1,
        distance: 1,
        products: { $concatArrays: ["$bookings", "$excessstocks"] },
        cp_stocks: 1,
      },
    },
    {
      $unwind: "$products",
    },
    {
      $lookup: {
        from: "products",
        let: {
          product_id: "$products._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$product_id"] },
                  { $eq: ["$delete_status", false] },
                ],
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
      $match:{
        product:{
          $ne: null
        }
      }
    },
    {
      $group: {
        _id: "$_id",
        address_id: {
          $first: "$address_id",
        },
        address_line1: {
          $first: "$address_line1",
        },
        address_line2: {
          $first: "$address_line2",
        },
        contact_name: {
          $first: "$contact_name",
        },
        distance: {
          $first: "$distance",
        },
        distance: {
          $first: "$distance",
        },
        email: {
          $first: "$email",
        },
        location: {
          $first: "$location",
        },
        mobile: {
          $first: "$mobile",
        },
        name: {
          $first: "$name",
        },
        suburb: {
          $first: "$suburb",
        },
        suburb_id: {
          $first: "$suburb_id",
        },
        cp_stocks: {
          $first: "$cp_stocks",
        },
        products: {
          $addToSet: {
            _id: "$product._id",
            name: "$product.name",
            quantity: {
              $sum: "$products.quantity",
            },
          },
        },
      },
    },
  ]);

  return res.json({
    cps: collectionpoints,
    status: false,
  });
};

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

exports.getGroupedArray = async (data) => {
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
  console.log(result);
  return this.toCollection(result);
};

exports.transferStock = async (req, res) => {
  try {
    let { stock, shift_id, cp_id } = req.body;
    let insert_products = [];
    if (stock) {
      _.map(stock, function (quantity, product_id) {
        if (quantity && typeof quantity  != "object") {
          insert_products.push({
            product_id,
            stock: +quantity,
          });
        }
      });
    } else {
      res.json({
        status: false,
        message: "No products selected",
      });
    }

    if (insert_products && insert_products.length > 0) {
      let address = await Address.findOne({
        collectionpoint_id: ObjectId(cp_id),
      });
      let suburb_id = address.suburb_id;
      if (!address) {
        throw new Error("Collection point not found");
      }
      const sessions = await mongoose.startSession();
      const transactionOptions = {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      };

      let stock = await Stock.findOne({
        suburb_id: ObjectId(suburb_id),
        driver_id: ObjectId(req.session._id),
        shift_id: ObjectId(shift_id),
        date: new Date(moment().format("YYYY-MM-DD")),
      });

      if (!stock) {
        return res.json({
          status: false,
          suburb_id,
          driver_id: req.session._id,
          shift_id,
          date: new Date(moment().format("YYYY-MM-DD")),
          cp: collectionpoint,
        });
      }
      let products = stock.products;
      products = products.concat(insert_products);
      products = await this.getGroupedArray(products);
      sessions.startTransaction(transactionOptions);
      stock.products = products;
      await stock.save();

      let stock_transfer = new StockTransfer({
        driver_id: ObjectId(req.session._id),
        collectionpoint_id: ObjectId(cp_id),
        type: "COLLECTIONPOINT",
        products: insert_products,
        approve_status: true,
      });

      let cpstock = new CPStock({
        collectionpoint_id: ObjectId(cp_id),
        shift_id: ObjectId(shift_id),
        date: new Date(moment().format("YYYY-MM-DD")),
        products: insert_products,
      });

      await cpstock.save();
      await stock_transfer.save();
      sessions.commitTransaction();
      return res.json({
        status: true,
        message: "Stock updated",
      });
    } else {
      return res.json({
        status: false,
        message: "Stock update failed",
      });
    }
  } catch (err) {
    console.log(err);
    if (typeof sessions != "undefined") {
      sessions.abortTransaction();
    }
    return res.json({
      status: false,
      message: "Stock update failed",
    });
  }
};

exports.checkStock = async (req, res) => {
  let { shift_id, stock, suburb_id } = req.query;
  let product_id = null;
  let qty = null;
  for (var key in stock) {
    product_id = key;
    qty = stock[key];
  }
  var stockdet = await Stock.aggregate([
    {
      $match: {
        delete_status: false,
        shift_id: ObjectId(shift_id),
        suburb_id: ObjectId(suburb_id),
        driver_id: ObjectId(req.session._id),
        date: new Date(moment().format("YYYY-MM-DD")),
      },
    },
    {
      $unwind: "$products",
    },
    {
      $match: {
        "products.product_id": ObjectId(product_id),
        "products.stock": {
          $gte: +qty,
        },
      },
    },
  ]);
  // return res.json(stockdet)
  if (stockdet && stockdet.length > 0) {
    return res.send("true");
  }
  return res.send("false");
};
