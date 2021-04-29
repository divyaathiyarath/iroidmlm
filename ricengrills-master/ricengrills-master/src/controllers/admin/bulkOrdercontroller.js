const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")
const Order = mongoose.model("tmp_bookings")
const moment = require('moment')

exports.list = async (req, res) => {
  let { search, page, limit, type } = req.query
  if (typeof type === "undefined") {
    type = 'food'
  }
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

  let query = [
    {
      $match: {
        booking_type: "BULK",
      },
    },
    {
      $lookup:
      {
        from: "users",
        let: { user_id: "$user_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$user_id"] },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
        as: "users",
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
              approve_status: 1
            },
          },
        ],
        as: "products"
      }
    },
    {
      $project: {
        _id: 1,
        bulkorder_status: 1,
        bulkorder_review: 1,
        approximate_price: 1,
        price: 1,
        scheduled_time: 1,
        products: 1,
        user: {
          $arrayElemAt: ["$users", 0]
        }
      }
    }
  ];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          { 'user.name': regex }
        ]
      }
    })
  }

  const orders = await Order.aggregate(
    [
      ...query,
      {
        $sort: {
          scheduled_date: -1
        }
      },
      {
        $skip: skip
      }, {
        $limit: limit
      }
    ]
  )

  let itemCount = await Order.aggregate([...query, {
    $count: "count"
  }])

  if (itemCount.length > 0) {
    itemCount = itemCount[0].count
  } else {
    itemCount = 0
  }

  const pageCount = Math.ceil(itemCount / limit);

  res.render("admin/bulkorder/list", {
    search, orders, search, itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  })
}

exports.getOrder = async (req, res) => {
  let { order_id } = req.query
  let orders = await Order.aggregate(
    [
      {
        $match: {
          booking_type: "BULK",
          _id: ObjectId(order_id)
        },
      },
      {
        $lookup:
        {
          from: "users",
          let: { user_id: "$user_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$user_id"] },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
              },
            },
          ],
          as: "users",
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
                    // { $eq: ["$is_regular", true] },
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
                approve_status: 1
              },
            },
          ],
          as: "products"
        }
      }
    ]
  )
  let order = null
  if (orders.length > 0) {
    order = orders[0]
  }
  if (order) {
    return res.json({
      status: true,
      order
    })
  } else {
    return res.json({
      status: false,
      message: "Order not found"
    })
  }
}

exports.rejectOrder = async (req, res) => {
  let { order_id, admin_review } = req.body
  let order = await Order.findOne({ _id: ObjectId(order_id) })
  if (order) {
    try {
      order.bulkorder_status = "REJECTED"
      order.bulkorder_review = admin_review
      await order.save()
      return res.json({
        status: true,
        message: "Order rejected successfully"
      })
    } catch (err) {
      console.log(err)
      return res.json({
        status: false,
        message: "Some thing went wrong"
      })
    }
  } else {
    return res.json({
      status: false,
      message: "Could not find order",
      order_id
    })
  }
}

exports.approvedOrder = async (req, res) => {
  let { order_id, price } = req.body
  let order = await Order.findOne({ _id: ObjectId(order_id) })
  if (order) {
    try {
      order.bulkorder_status = "APPROVED"
      order.price = price
      await order.save()
      return res.json({
        status: true,
        message: "Order approved successfully"
      })
    } catch (err) {
      console.log(err)
      return res.json({
        status: false,
        message: "Some thing went wrong"
      })
    }
  } else {
    return res.json({
      status: false,
      message: "Could not find order",
      order_id
    })
  }
}