const mongoose = require('mongoose')
const Setting = mongoose.model('settings')
const moment = require('moment')


exports.dashboard = async (req, res) => {
    return res.render('cp/dashboard')
}

exports.getComingShift = async () => {
    let offset = Math.abs((new Date()).getTimezoneOffset())
	let today = moment().format("YYYY-MM-DD");
	let cur_date = moment().utcOffset(+offset).format("YYYY-MM-DD HH:mm");
    let current_slot = await Setting.aggregate([
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
              duration: {
                $add: ["$duration", 0.5]
              }
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
                $toDate: "$current_date"
              }
            },
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $gte: ["$current_date", "$start"] },
                  { $lte: ["$current_date","$end"] },
                ],
              },
            },
          },
          {
            $sort: {
              start: 1,
            },
          }
    ]);

    let setting = await Setting.aggregate([
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
        {
            $match: {
                $expr: {
                    $and: [{ $gte: ["$start", new Date()] }],
                },
            },
        },
        {
            $sort: {
                start: 1,
            },
        },
    ]);


    let setting2 = await Setting.aggregate([
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
                today: { $toDate: { $concat: [today, " ", "$time"] } }
            },
        },
        {
            $sort: {
                today: 1,
            },
        },
    ]);

    if (current_slot.length > 0) {
        return {
            current_shift: current_slot[0]._id,
            shifts: setting2,
        };
    } else {
        return {
            current_shift: "5f5af9a49030860f71205e09",
            shifts: setting2,
        };
    }
}