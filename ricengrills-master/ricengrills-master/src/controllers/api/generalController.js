const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Settings = mongoose.model("settings");
const Suburb = mongoose.model('suburbs')
let { getComingShift } = require('../admin/stockController')

const AboutUs = mongoose.model("about_us")
const TermsCondition = mongoose.model("terms_conditions")
const PrivacyPolicy = mongoose.model("privacy_policies")
const TempLog = mongoose.model('temp_logs')
const Stock = mongoose.model('stocks')
const Banner = mongoose.model('banners')
let moment = require('moment')

exports.getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne({}, {
            _id: 0,
            shift_times: 1,
            min_bulk_order_quantity: 1,
            gst: 1,
            delivery_charge: 1,
            service_charge_paypal: 1,
            service_charge_square: 1,
        })

        let { shifts, coming_shift } = await getComingShift()
        console.log(coming_shift)

        let shift = await Settings.findOne({ "shift_times._id": ObjectId(coming_shift) }, { shift_times: { $elemMatch: { _id: ObjectId(coming_shift) } } })
        current_shift = shift.shift_times[0]
        data = {
            gst: settings.gst,
            min_bulk_order_quantity: settings.min_bulk_order_quantity,
            delivery_charge: settings.delivery_charge,
            shift_times: settings.shift_times,
            service_charge_paypal: settings.service_charge_paypal,
            service_charge_square: settings.service_charge_square,
            current_shift
        }
        return res.json({
            status: true,
            data
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.getSuburbs = async (req, res) => {
    try {
        let suburbs = await Suburb.find({
            delete_status: false,
            active: true
        }, {
            _id: 1,
            name: 1,
            location: 1,
        }).sort({name: 1})
        return res.json({
            status: true,
            data: suburbs
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.aboutUs = async (req, res) => {
    try {
        let about_us = await AboutUs.findOne()
        return res.json({
            status: true,
            data: about_us
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.termsConditions = async (req, res) => {
    try {
        let terms = await TermsCondition.findOne()
        return res.json({
            status: true,
            data: terms
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.privacyPolicy = async (req, res) => {
    try {
        let terms = await PrivacyPolicy.findOne()
        return res.json({
            status: true,
            data: terms
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.tempLog = async (req, res) => {
    let { temp_array } = req.body
    if(typeof temp_array == "string"){
        temp_array = JSON.parse(temp_array)
    }
    let { coming_shift } = await getComingShift()
    // let temp_array = { '5B3TV3456YBV34570': 20, '11122223333333333': 40 }
    console.log('#################temp log #########################')
    let boxes = await Stock.aggregate([
        {
            $match: {
                $expr: {
                    $and: [
                        { $eq: ["$driver_id", ObjectId(req.payload._id)] },
                        { $gte: ["$date", new Date(moment().format('YYYY-MM-DD'))] },
                        { $lte: ["$date", new Date(moment().format('YYYY-MM-DD 23:59:000'))] },
                        { $eq:  ["$shift_id", ObjectId(coming_shift)] }
                    ]
                }
            }
        },
        {
            $unwind: "$boxes"
        },
        {
            $lookup: {
                from: "boxes",
                let: {
                    box_id: "$boxes"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$box_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "sensors",
                            let: {
                                sensor_id: "$sensor_id"
                            },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$sensor_id"] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "sensor"
                        }
                    },
                    {
                        $addFields: {
                            sensor_uid: {
                                $arrayElemAt: ["$sensor.uid", 0]
                            }
                        }
                    }
                ],
                as: 'box'
            }
        },
        {
            $addFields: {
                box: {
                    $arrayElemAt: ["$box", 0]
                }
            }
        },
        {
            $project: {
                _id: "$box._id",
                uid: "$box.uid",
                sensor_id: "$box.sensor_id",
                sensor_uid: "$box.sensor_uid",
                stock_id: "$_id"
            }
        },
        {
            $group: {
                _id: "$_id",
                uid: {
                    $first: "$uid"
                },
                sensor_id: {
                    $first: "$sensor_id"
                },
                sensor_uid: {
                    $first: "$sensor_uid"
                },
                stock_ids: {
                    $addToSet: "$stock_id"
                }
            }
        }
    ])

    insert_array = []
    boxes.filter(box => {
        let { _id, stock_ids, sensor_id, sensor_uid } = box
        if (typeof temp_array[sensor_uid] != "undefined") {
            insert_array.push({
                stock_ids: stock_ids,
                box_id: ObjectId(_id),
                sensor_id: ObjectId(sensor_id),
                sensor_uid,
                temperature: temp_array[sensor_uid],
                date: new Date(),
                shift_id: ObjectId(coming_shift),
                user_id : ObjectId(req.payload._id)
            })
        }
    })

    if (insert_array.length > 0)
        await TempLog.insertMany(insert_array)

    return res.json({
        status: true,
        message: "temperature updated"
    })
}

exports.userBanner = async(req,res)=>{

    try {
        let banner = await Banner.find({delete_status:false,type:"USERAPP"},{created_at:0,delete_status:0,_id:0,__v:0,type:0})
        console.log(banner)
        return res.json({
            data:banner,
            status:true
        })
    } catch (error) {
        console.log(error)
        return res.json({
            status:false,
            message:"something went wrong"
        })
    }
}