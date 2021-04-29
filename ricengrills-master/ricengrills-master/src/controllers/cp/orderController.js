const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId
const Bookings = mongoose.model("bookings");
const Products = mongoose.model("products")
const Cpsales = mongoose.model("cp_sales")
const Cpstocks = mongoose.model("cp_stocks")
const Collectionpoint = mongoose.model("collectionpoints")
const paginate = require("express-paginate")
const Excel = require("exceljs");
const moment = require('moment')
let { getComingShift } = require('./dashboardController');

exports.index = async (req, res) => {
  const id = req.session._id
  let { search, page, limit } = req.query
  let today = moment().format("YYYY-MM-DD")
  const start_date = new Date(moment().format('YYYY-MM-DD 00:00:000'))
  const end_date = new Date(moment().format('YYYY-MM-DD 23:59:000'))
  console.log(start_date, end_date)
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit
  }
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { booking_id: regex },

        ],
      },
    });
  }
  // collectionpoint_id:ObjectId(id),

  query.push(
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$collectionpoint_id", ObjectId(id)] },
            { $gte: ["$scheduled_date", start_date] },
            { $lte: ["$scheduled_date", end_date] }
          ]
        }
      },
    },
    {
      $lookup: {
        from: "products",
        let: { orders: "$orders" },
        pipeline: [
          {
            $addFields: {
              orders: "$$orders",
            },
          },
          {
            $unwind: "$orders",
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$orders.product_id"] },
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
              quantity: "$orders.quantity",
            },
          },
        ],
        as: "products",
      },
    },
    {
      $addFields: {
        collection_point: { $arrayElemAt: ["$collection_point", 0] },
      },
    });

  const bookings = await Bookings.aggregate([...query,
  {
    $skip: skip
  },
  {
    $limit: limit
  }
  ]);

  let itemCount = await Bookings.aggregate([...query,
  {
    $count: "count"
  }
  ]);
  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
    console.log(itemCount)
  } else {
    itemCount = 0;
  }
  const pageCount = Math.ceil(itemCount / limit);
  let data = {
    bookings,
    search,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  }
  console.log(pageCount);
  res.render("cp/orders/index", data);
}

exports.cancelled = async (req, res) => {
  const id = req.session._id
  let { search, page, limit } = req.query
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { booking_id: regex },

        ],
      },
    });
  }
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
  }
  let skip = 0;
  if (page > 1) {
    skip = (page - 1) * limit
  }
  query.push({
    $match: {
      delete_status: {
        $ne: true,
      },
      collectionpoint_id: ObjectId(id)
    },
  },
    {
      $lookup: {
        from: "products",
        let: { orders: "$orders" },
        pipeline: [
          {
            $addFields: {
              orders: "$$orders",
            },
          },
          {
            $unwind: "$orders",
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$orders.product_id"] },
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
              quantity: "$orders.quantity",
            },
          },
        ],
        as: "products",
      },
    },
    {
      $addFields: {
        collection_point: { $arrayElemAt: ["$collection_point", 0] },
      },
    });
  console.log(id)
  let bookings = await Bookings.aggregate([...query,
  {
    $skip: skip
  },
  {
    $limit: limit
  }
  ]);
  let itemCount = await Bookings.aggregate([...query,
  {
    $count: "count"
  }
  ])

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count;
  } else {
    itemCount = 0;
  }

  let pageCount = Math.ceil(itemCount / limit);

  let data = {
    bookings,
    search,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  }

  res.render("cp/orders/cancelled", data, pageCount);
}

exports.completed = async (req, res) => {
  const id = req.session._id
  let { search, page, limit } = req.query
  let { current_shift: shift_id } = await getComingShift()
  if (typeof limit == 'undefined') {
    limit = 10
  }
  if (typeof page == 'undefined') {
    page = 1
  }

  let skip = 0
  if (page > 1) {
    skip = (page - 1) * limit
  }
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { booking_id: regex },

        ],
      },
    });
  }
  query.push({
    $match: {
      delete_status: {
        $ne: true,
      },
      delivery_type: 'COLLECTIONPOINT',
      collectionpoint_id: ObjectId(id),
      shift_id: ObjectId(shift_id)
    },
  },
    {
      $lookup: {
        from: "products",
        let: { orders: "$orders" },
        pipeline: [
          {
            $addFields: {
              orders: "$$orders",
            },
          },
          {
            $unwind: "$orders",
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$orders.product_id"] },
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
              quantity: "$orders.quantity",
            },
          },
        ],
        as: "products",
      },
    },
    {
      $addFields: {
        collection_point: { $arrayElemAt: ["$collection_point", 0] },
      },
    });
  const bookings = await Bookings.aggregate([...query,
  {
    $skip: skip
  }, {
    $limit: limit
  }]);
  let itemCount = await Bookings.aggregate([...query,
  {
    $count: "count"
  }
  ])

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count
  } else {
    itemCount = 0
  }

  const pageCount = Math.ceil(itemCount / limit);
  let data = {
    bookings,
    search,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  }
  res.render("cp/orders/completed", data);
}

exports.update = async (req, res) => {
  const { order } = req.body;
  const collectionpoint_id = req.session._id

  let booking = await Bookings.findOne({
    _id: ObjectId(order),
    redeemed: false,
  }).populate("address_id");

  let cp_stock = await Cpstocks.findOne({
    collectionpoint_id: ObjectId(collectionpoint_id),
    shift_id: booking.shift_id,
    date: new Date(moment().format('YYYY-MM-DD')),
    delete_status: false,
  });

  let { products } = cp_stock;
  let { orders } = booking; 
  let order_ids = [];
  let product_ids = [];
  products.map(product=>{
    product_ids.push(ObjectId(product.product_id))
  })
  orders.map(product=>{
    order_ids.push(ObjectId(product.product_id))
  })
  
  let is_valid = 1;
  order_ids.forEach(id=>{
    let valid = product_ids.some((prod_id)=>{
      return id.toString() == prod_id.toString() 
    })
    if(!valid){
      is_valid = 0;
    }
  })

  if(!is_valid){
    return res.json({
      status: false,
      message: "Insufficient stock",
    });
  }

  products.map(prod=>{
    let order = orders.filter(ord=>{
      return ord.product_id.toString() == prod.product_id.toString()
    });
    order = order[0]
    if(order){
      prod.stock -= order.quantity;
    }
    if(prod.stock < 0){
      is_valid = 0;
    }
    return prod
  })

  if(!is_valid){
    return res.json({
      status: false,
      message: "Insufficient stock",
    });
  }

  cp_stock.products = products;
  await cp_stock.save();
  await Bookings.updateOne(
    {
      _id: ObjectId(order),
    },
    {
      $set: {
        redeemed: true,
      },
    }
  );
  return res.json({
    status: true,
    message: "order has completed",
  });

  // return res.json({products, orders});

  // if (cp_stock) {
  //   for (var i = 0; i < booking.orders.length; i++) {
  //     await Cpstocks.updateOne(
  //       {
  //         _id: cp_stock._id,
  //         products: {
  //           $elemMatch: {
  //             product_id: ObjectId(booking.orders[i].product_id),
  //           },
  //         },
  //       },
  //       {
  //         $inc: {
  //           "products.$.stock": -booking.orders[i].quantity,
  //         },
  //       }
  //     );
  //   }
  // }

  
};
