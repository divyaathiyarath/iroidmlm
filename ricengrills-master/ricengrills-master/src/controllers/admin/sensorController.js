const mongoose = require("mongoose");
const Sensor = mongoose.model("sensors");
let ObjectId = mongoose.Types.ObjectId;
const Templogs = mongoose.model('temp_logs');
const paginate = require("express-paginate");

exports.list = async (req, res) => {
  let { search, page, limit } = req.query;
  if (typeof limit == "undefined") {
    limit = 10;
  }
  if (typeof page == "undefined") {
    page = 1;
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
        $or: [{ uid: regex }],
      },
    });
  }
  query.push(
    {
      $match: {
        delete_status: {
          $ne: true,
        },
      },
    },
    {
      $project: {
        _id: 1,
        uid: 1,
        sensor_id: 1,
      },
    }
  );

  let sensors = await Sensor.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  let itemCount = await Sensor.aggregate([
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

  let data = {
    search,
    sensors,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/sensors/listSensors", data);
};

exports.new = async (req, res) => {
  return res.render("admin/sensors/new");
};

exports.save = async (req, res) => {
  try {
    let { uid } = req.body;

    sensor = await new Sensor();
    sensor.uid = uid;
    await sensor.save();

    return res.json({
      status: true,
      message: "Sensor added successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not save sensor",
    });
  }
};

exports.delete = async (req, res) => {
  try {
    let { sensor } = req.body;
    await Sensor.updateOne(
      {
        _id: ObjectId(sensor),
      },
      {
        $set: {
          delete_status: true,
          deleted_at: new Date(),
        },
      }
    );
    return res.json({
      status: true,
      message: "Sensor deleted successfully",
    });
  } catch (err) {
    console.log(err)
    return res.json({
      status: false,
      message: 'Sorry something went wrong'
    })
  }
};

exports.temperature_logs = async(req,res)=>{

  let logs = await Templogs.aggregate([
    {
      $lookup:{
        from:"boxes",
        let:{box_id:"$box_id"},
        pipeline:[
          {
            $match:{
              $expr:{
                $eq:["$_id","$$box_id"]
              }
            }
          },
          {
            $project:{
              uid:1,
              _id:0
            }
          }
        ],
        as:"Box"
      }
    },
    {
      $lookup:{
        from:"settings",
        let:{shift_id:"$shift_id"},
        pipeline:[
          {
            $unwind:"$shift_times"
          },
          {
            $match:{
              $expr:{
                $and:[
                  {$eq:["$shift_times._id","$$shift_id"]}
                ]
              }
            }
          },
          {
            $project:{
              name:"$shift_times.name",
              time:"$shift_times.time"
            }
          }
        ],
        as:"shifts"
      }
    },
    {
      $unwind:"$stock_ids"
    },
    {
      $lookup:{
        from:"stocks",
        let:{stock_id:"$stock_ids" },
        pipeline:[
          {
            $match:{
              $expr:{
                $and:[{$eq:["$_id","$$stock_id"]}]
              }
            }
          },
          {
            $unwind:"$products"
          },
          {
            $project:{
              product_id:"$products.product_id",
              stock:"$products.stock"
            }
          },
          {
            $lookup:{
              from:"products",
              let:{product_id:"$product_id"},
              pipeline:[
                {
                  $match:{
                    $expr:{
                      $and:[{$eq:["$_id","$$product_id"]}]
                    }
                  }
                },
                {
                  $project:{
                    name:1
                  }
                }
              ],
              as:"product"
            }
          },
          {
            $project:{
              _id:0,
              name:"$product.name",
              stock:1
            }
          }
        ],
        as:"stocks"
      }
    },

    {
      $group:{
        _id:"$stock_ids",
        products:{
          $first:"$stocks"
        },
        box:{
          $first:"$Box"
        },
        shift:{
          $first:"$shifts"
        },
        sensor_uid:{
          $first:"$sensor_uid"
        },
        temperature:{
          $first:"$temperature"
        }
      }
    },
  ])
  // return res.json(logs)
  return res.render('admin/sensors/temp_logs',{logs})
}