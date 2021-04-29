const mongoose = require("mongoose");
const moment = require("moment");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const Box = mongoose.model("boxes");
const Sensor = mongoose.model("sensors");
let { validateBoxInputs } = require("../../validators/boxValidator");

exports.new = async (req, res) => {
  let sensors = await Sensor.find();
  return res.render("admin/boxes/new", { sensors });
};

exports.save = async (req, res) => {
  const { errors, isValid } = validateBoxInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  try {
    let { uid, sensor_id } = req.body;

    box = await new Box();
    box.uid = uid;
    box.sensor_id = sensor_id;
    await box.save();

    return res.json({
      status: true,
      message: "Box added successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not save Box",
    });
  }
};

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
      $lookup: {
        from: "sensors",
        localField: "sensor_id",
        foreignField: "_id",
        as: "sensors",
      },
    },
    {
      $addFields: {
        sensor_id: {
          $arrayElemAt: ["$sensors.uid", 0],
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

  let boxes = await Box.aggregate([
    ...query,
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  let itemCount = await Box.aggregate([
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
    boxes,
    itemCount,
    pageCount,
    pages: paginate.getArrayPages(req)(5, pageCount, page),
    activePage: page,
  };
  return res.render("admin/boxes/list", data);
};

exports.delete = async (req, res) => {
  const { box } = req.body;
  await Box.updateOne(
    {
      _id: ObjectId(box),
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
    message: "Box deleted successfully",
  });
};

exports.edit = async (req, res) => {
  let { box_id } = req.params;
  let box = await Box.findOne({ _id: ObjectId(box_id) });
  if (!box) {
    res.redirect(res.locals.app_url + "/boxes/new");
  }
  let sensors = await Sensor.find();
  return res.render("admin/boxes/edit", { box, sensors });
};

exports.update = async (req, res) => {
  const { errors, isValid } = validateBoxInputs(req.body);
  if (!isValid) {
    return res.json({ status: false, errors });
  }

  try {
    let { _id, uid, sensor_id } = req.body;

    box = await Box.findOne({ _id: ObjectId(_id) });

    box.uid = uid;
    box.sensor_id = sensor_id;
    await box.save();
    return res.json({
      status: true,
      message: "Box updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not update Box",
    });
  }
};

exports.search = async (req, res) => {
  let { search, shift_id, driver_id } = req.query;
  if (!search) {
    search = "";
  }
  let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
  let boxes = await Box.aggregate([
    {
      $match: {
        $or: [{ uid: regex }],
      },
    },
    {
      $lookup: {
        from: "stocks",
        let: {
          box_id: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $ne: ["$driver_id", ObjectId(driver_id)],
                  },
                  {
                    $in: ["$$box_id", "$boxes"],
                  },
                  { $eq: ["$date", new Date(moment().format("YYYY-MM-DD"))] },
                  { $eq: ["$shift_id", ObjectId(shift_id)] },
                ],
              },
            },
          },
        ],
        as: "stocks",
      },
    },
    {
      $addFields: {
        is_box_available: {
          $size: "$stocks",
        },
      },
    },
    {
      $match: {
        is_box_available: {
          $lt: 1,
        },
      },
    },
    {
      $project: {
        id: "$_id",
        text: "$uid",
        stocks: 1,
      },
    },
  ]);
  return res.json(boxes);
};
