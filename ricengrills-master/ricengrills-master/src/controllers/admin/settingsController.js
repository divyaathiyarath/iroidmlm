const mongoose = require("mongoose");
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate");
const { findOne } = require("../../models/settings");
const Setting = mongoose.model("settings");

exports.new = async (req, res) => {
  return res.render("admin/settings/new");
};

exports.save = async (req, res) => {
  try {
    let { food, accessories } = req.body;
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }
    await Setting.updateOne(
      {},
      {
        $set: {
          "price.food": food,
          "price.accessories": accessories,
        },
      }
    );

    return res.json({
      status: true,
      message: "Price added successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not save price",
    });
  }
};

exports.edit = async (req, res) => {
  let setting = await Setting.findOne();
  let price = setting.price;
  return res.render("admin/settings/edit", { price, setting });
};

exports.update = async (req, res) => {
  const { trimMobile } = require('../../utils/general')
  try {
    let { food, delivery_charge, gst, per_hour_charge, per_order_charge,mobilenumber,service_charge_square,service_charge_paypal,min_schedule_hour, cp_commission_per_item } = req.body;
    mobilenumber = trimMobile(mobilenumber)
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }
    await Setting.updateOne(
      {},
      {
        $set: {
          "price.food": food,
          delivery_charge: delivery_charge,
          gst: gst,
          per_hour_charge,
          per_order_charge,
          office_mobile:mobilenumber,
          service_charge_square,
          service_charge_paypal,
          min_schedule_hour,
          cp_commission_per_item
        }
      }
    );

    return res.json({
      status: true,
      message: "Settings updated successfully",
    });
  } catch (err) {
    console.log(err);
    return res.json({
      status: false,
      message: "Could not save settings",
    });
  }
};

exports.list = async (req, res) => {
  let setting = await Setting.findOne();
  let price = setting.price;
  res.render("admin/settings/list", { price, setting });
};
