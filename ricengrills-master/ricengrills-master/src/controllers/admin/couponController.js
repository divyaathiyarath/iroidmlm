const mongoose = require("mongoose");
const { findOne, findById } = require("../../models/coupons");
let ObjectId = mongoose.Types.ObjectId;
const Coupons = mongoose.model("coupons");
const Suburb = mongoose.model("suburbs");
const couponUpload = require("../../utils/uploads/couponUpload");
exports.list = async (req, res) => {
  let { search } = req.query;
  let query = [];
  if (search) {
    let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
    query.push({
      $match: {
        $or: [
          {
            name: regex,
          },
        ],
      },
    });
  }
  let coupon = await Coupons.aggregate([
    ...query,
    {
      $match: { delete_status: false },
    },
    {
      $lookup: {
        from: "suburbs",
        let: { suburbs: "$suburbs" },
        pipeline: [
          {
            $addFields:{
              suburbs : "$$suburbs"
            }
          },
          {
            $addFields:{
              suburbs : { 
                $cond:{
                  if: { $and: [ { $isArray: "$$suburbs" }] },
                  then: "$suburbs",
                  else: []
                }
              }
            }
          },
          {
            $match: {
              $expr: {
                $and: {
                  $in: ["$_id", "$suburbs"]
                }
              }
            }
          },
          {
            $project: {
              name: 1
            }
          }
        ],
        as: "suburbs"
      }
    }, {
      $addFields: {
        suburbs: "$suburbs"
      }
    },
    {
      $sort:{
        _id: -1
      }
    }
  ]);

  let data = {
    coupon,
    search,
  };
  console.log(coupon);
  return res.render("admin/coupons/list", data);
};

exports.delete = async (req, res) => {
  const { coupon } = req.body;
  await Coupons.updateOne(
    {
      _id: ObjectId(coupon),
    },
    {
      $set: {
        delete_status: true,
      },
    }
  );
  return res.json({
    status: true,
    message: "Coupon deleted successfully",
  });
};
exports.new = async (req, res) => {
  let suburb = await Suburb.find({ delete_status: "false" });
  return res.render("admin/coupons/new", { suburb });
};

exports.save = async (req, res) => {
  try {
    await couponUpload(req, res);
  } catch (error) {
    console.log(error);
    return res.json({ status: false, message: "Could not upload file" });
  }
  try {
    let { name, val, code, count, suburbs } = req.body;
    let created_at = Date.now();
    let { image } = req.files;
    if (typeof image != "undefined" && image.length > 0) {
      image = image[0].destination + "/" + image[0].filename;
    }
    coupon = new Coupons({
      name,
      val,
      code,
      count,
      image,
      created_at,
      suburbs
    });
    await coupon.save();
    return res.json({
      status: true,
      message: "coupon saved ",
    });
  } catch (error) {
    console.log(error);
    return res.json({
      status: false,
      message: "could not add coupon",
    });
  }
};

exports.editCoupon = async (req, res) => {
  const { id } = req.params;
  let suburb = await Suburb.find();
  let coupon = await Coupons.findOne({
    _id: id,
  });
  return res.render("admin/coupons/edit", { suburb, coupon });
};

exports.update = async (req, res) => {
  try {
    await couponUpload(req, res);
  } catch (error) {
    console.log(error);
    return res.json({ status: false, message: "Could not upload file" });
  }
  try {
    let { name, val, code, count, suburbs, coupon_id } = req.body;
    let created_at = Date.now();
    let { image } = req.files;
    if (typeof image != "undefined" && image.length > 0) {
      image = image[0].destination + "/" + image[0].filename;
    }
    coupon = await Coupons.findById({ _id: coupon_id });
    coupon.name = name;
    coupon.val = val;
    coupon.code = code;
    coupon.count = count;
    coupon.created_at = created_at;
    coupon.suburbs = suburbs;
    coupon.image = image;
    await coupon.save();
    return res.json({
      status: true,
      message: "coupon updated ",
    });
  } catch (error) {
    console.log(error);
    return res.json({
      status: false,
      message: "could not update coupon",
    });
  }
};

exports.activeStatus = async (req, res) => {
  try {
    const { coupon } = req.body
    coupons = await Coupons.findOne({ _id: ObjectId(coupon) })
    if (coupons) {
      coupons.active_status = !coupons.active_status
      await coupons.save()
      if (coupons.active_status)
        return res.json({
          status: true,
          message: "Coupon has been deactivated",
        });
      else
        return res.json({
          status: true,
          message: "Coupon has been activated",
        });
    } else {
      return res.json({
        status: false,
        message: "Sorry something went wrong",
      });
    }

  } catch (error) {
    if (error) {
      console.log(error)
      return res.json({
        status: false,
        message: 'something went wrong'
      })
    }
  }
}