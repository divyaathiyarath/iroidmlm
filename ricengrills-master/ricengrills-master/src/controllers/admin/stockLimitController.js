const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const moment = require("moment");

const ScheduledStockLimit = mongoose.model("scheduled_stock_limits");
const Setting = mongoose.model("settings");
const Product = mongoose.model("products");
const Suburb = mongoose.model("suburbs");

let { ValidateStockLimitInput } = require("../../validators/stockValidator");

exports.list = async (req, res) => {
  try {
    let { suburb_id, product_id, shift_id, page, limit } = req.query;
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
          delete_status: false,
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
                  $and: [{ $eq: ["$shift_times._id", "$$shift_id"] }],
                },
              },
            },
            {
              $project: {
                _id: "$shift_times._id",
              },
            },
          ],
          as: "shift",
        },
      },
      {
        $addFields: {
          shift_id: {
            $arrayElemAt: ["$shift._id", 0],
          },
        },
      },
      {
        $match: {
          $expr: {
            $and: [{ $gt: ["$shift_id", null] }],
          },
        },
      },
    ];
    if (suburb_id) {
      query.push({
        $match: {
          suburb_id: ObjectId(suburb_id),
        },
      });
    }
    if (product_id) {
      query.push({
        $match: {
          product_id: ObjectId(product_id),
        },
      });
    }
    if (shift_id) {
      query.push({
        $match: {
          shift_id: ObjectId(shift_id),
        },
      });
    }
    query.push(
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
                  $eq: ["$$suburb_id", "$_id"],
                },
              },
            },
          ],
          as: "suburb",
        },
      },
      {
        $lookup: {
          from: "products",
          let: {
            product_id: "$product_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$$product_id", "$_id"],
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
          product: {
            $arrayElemAt: ["$product", 0],
          },
          suburb: {
            $arrayElemAt: ["$suburb", 0],
          },
        },
      }
    );
    let scheduled_limits = await ScheduledStockLimit.aggregate([
      ...query,
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
    let itemCount = await ScheduledStockLimit.aggregate([
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
    let today = moment().format("YYYY-MM-DD");
    let tomorrow = moment().add(1, "days").format("YYYY-MM-DD");
    let shifts = await Setting.aggregate([
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
          tomorrow: { $toDate: { $concat: [tomorrow, " ", "$time"] } },
        },
      },
      {
        $sort: {
          today: 1,
        },
      },
    ]);
    let products = await Product.find({
      delete_status: false,
      is_regular: true,
    });
    let suburbs = await Suburb.find({
      delete_status: false,
    });
    let data = {
      shifts,
      shift_id,
      product_id,
      suburb_id,
      products,
      suburbs,
      scheduled_limits,
      itemCount,
      pageCount,
      pages: paginate.getArrayPages(req)(5, pageCount, page),
      activePage: page,
    };
    return res.render("admin/scheduled_limit/list", data);
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

// exports.save = async (req, res) => {
//   try {
//     const { errors, isValid } = ValidateStockLimitInput(req.body);
//     if (!isValid) {
//       return res.json({
//         status: false,
//         message: errors[0],
//       });
//     }
//     let { product_id, shift_id, suburb_id, limit, id } = req.body;
//     if(product_id.length == 0) {
//       return res.json({
//         status: false,
//         message: 'Products required'
//       })
//     }
//     if(suburb_id.length == 0) {
//       return res.json({
//         status: false,
//         message: 'Suburbs is required'
//       })
//     }
//     let message = ""
//     if(id) {
//       var stock_limit = await ScheduledStockLimit.findOne({
//         _id: id,
//       });
//       message = "Schedule stock limit updated";
//     } else {
//       let stock = await ScheduledStockLimit.findOne({
//         product_id:product_id, 
//         shift_id:shift_id,
//         suburb_id
//       })
//       console.log(stock)
//       if (stock) {
//         return res.json({
//           status:false,
//           message:"stock exists"
//         })
//       } 
//       stock_limit = new ScheduledStockLimit()
//       message = "Scheduled stock limit added";
//     }
    
//     (stock_limit.product_id = product_id),
//       (stock_limit.shift_id = shift_id),
//       (stock_limit.suburb_id = suburb_id),
//       (stock_limit.limit = limit);
//     await stock_limit.save();
//     return res.json({
//       status: true,
//       message,
//     });
//   } catch (err) {
//     console.log(err);
//     return res.json({
//       status: false,
//       message: "Sorry something went wrong",
//     });
//   }
// };

exports.save = async (req, res) => {
  try {
    const { errors, isValid } = ValidateStockLimitInput(req.body);
    if (!isValid) {
      return res.json({
        status: false,
        message: errors[0],
      });
    }
    let { product_id, shift_id, suburb_id, limit, id } = req.body;
    if(product_id.length == 0) {
      return res.json({
        status: false,
        message: 'Products required'
      })
    }
    if(suburb_id.length == 0) {
      return res.json({
        status: false,
        message: 'Suburbs is required'
      })
    }
    let message = ""
    let insert_array = []
    for(var i = 0; i < suburb_id.length; i++) {
      for(var j = 0; j < product_id.length; j++) {
        let obj = {
          suburb_id: suburb_id[i],
          shift_id: shift_id,
          limit: limit,
          product_id: product_id[j]
        }
        insert_array.push(obj)
      }
    }
    // return res.json({
    //   insert_array
    // })
    for(var i = 0; i < insert_array.length; i++) {
      let stock_lim = await ScheduledStockLimit.findOne({
        product_id: insert_array[i].product_id,
        shift_id: insert_array[i].shift_id,
        suburb_id: insert_array[i].suburb_id
      })
      if(!stock_lim) {
        stock_lim = new ScheduledStockLimit()
      }
      stock_lim.product_id = insert_array[i].product_id,
      stock_lim.shift_id = insert_array[i].shift_id,
      stock_lim.suburb_id = insert_array[i].suburb_id,
      stock_lim.limit = insert_array[i].limit
      await stock_lim.save()
    }

    return res.json({
      status: true,
      message: 'Stock limit updated'
    })
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.delete = async (req, res) => {
  try {
    let { id } = req.body;
    await ScheduledStockLimit.updateOne(
      {
        _id: id,
      },
      {
        $set: {
          delete_status: true,
        },
      }
    );
    return res.json({
      status: true,
      message: "Stock limit has been deleted",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Sorry something went wrong",
    });
  }
};

exports.editStockLimit = async(req, res) => {
  try {
    let {id} = req.params
    let shifts = await Setting.aggregate([
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
    ]);
    let products = await Product.find({
      delete_status: false,
      is_regular: true,
    });
    let suburbs = await Suburb.find({
      delete_status: false,
    });
    let stock_limit = await ScheduledStockLimit.findOne({
      _id: id
    })
    let data = {
      stock_limit,
      shifts,
      products,
      suburbs
    }
    return res.render("admin/scheduled_limit/edit", data);
  } catch(err) {
    console.log(err)
    return res.json({
      status: false,
      message: 'Sorry something went wrong'
    })
  }
}

exports.updateStockLimit = async(req, res) => {
  try {
    let {shift_id, product_id, suburb_id, limit, id} = req.body
    await ScheduledStockLimit.updateOne({
      _id: id
    }, {
      $set: {
        shift_id,
        product_id,
        suburb_id,
        limit
      }
    })
    return res.json({
      status: true,
      message: "Stock limit updated"
    })
  } catch(err) {
    console.log(err)
    return res.json({
      status: false,
      message: 'Sorry something went wrong'
    })
  }
}