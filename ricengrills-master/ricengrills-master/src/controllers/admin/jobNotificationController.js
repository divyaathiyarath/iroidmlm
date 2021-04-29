const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")
const JobNotification = mongoose.model('job_notifications')
const { driverJobNotificationQueue, sendJobApproval } = require("../../jobs/notification")
const { getComingShift } = require("../admin/stockController")
const moment = require('moment');
const notification = require('../../jobs/notification');
const Excel = require('exceljs');
const { app } = require('firebase');

//new notification page
exports.new = async (req, res) => {
    let { shifts, coming_shift } = await getComingShift();
    return res.render('admin/job_notifications/new', {
        shifts,
        coming_shift
    })
}

exports.checkJobNotification = async (shift, date) => {
    let count = await JobNotification.find({ shift_id: ObjectId(shift), date: new Date(date) }).countDocuments()
    console.log({ count, shift })
    return count
}

exports.save = async (req, res) => {
    let { shift_id, date } = req.body
    console.log({ shift_id })
    let check_exists = await this.checkJobNotification(shift_id, date)
    if (check_exists) {
        return res.json({
            status: false,
            message: "Job notification for this shift is already send "
        })
    }
    try {
        let job = new JobNotification()
        job.shift_id = ObjectId(shift_id)
        job.date = new Date(moment(date).format('YYYY-MM-DD'))
        await job.save()
        driverJobNotificationQueue.add({ job_id: job._id, date: job.date });
        return res.json({
            status: true,
            message: "Job notification send to all delivery drivers"
        })
    } catch (err) {
        return res.json({
            status: false,
            message: "Could not send job notification"
        })
    }
}

exports.list = async (req, res) => {
    let notifications = await JobNotification.aggregate([
        {
            $match: {
                delete_status: false,
                date: {
                    $gte: new Date()
                }
            }
        },
        {
            $lookup: {
                from: "settings",
                let: {
                    shift_id: "$shift_id"
                },
                pipeline: [
                    {
                        $unwind: "$shift_times",
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$shift_times._id", "$$shift_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: "$shift_times._id",
                            name: "$shift_times.name",
                            duration: "$shift_times.duration",
                            time: "$shift_times.time",
                        }
                    }
                ],
                as: "shift"
            }
        },
        {
            $addFields: {
                shift: {
                    $arrayElemAt: ["$shift", 0]
                },
                accepted_drivers: {
                    $size: "$accepted_drivers"
                },
                rejected_drivers: {
                    $size: "$rejected_drivers"
                },
                approved_drivers: {
                    $size: "$approved_drivers"
                },
            }
        },
        {
            $project: {
                _id: 1,
                shift: 1,
                accepted_drivers: 1,
                rejected_drivers: 1,
                approved_drivers: 1,
                date: 1,
                created_at: 1
            }
        },
        {
            $sort: {
                date: -1
            }
        }
    ])
    return res.render("admin/job_notifications/list", {
        notifications
    })
}

exports.jobNotificationExcel = async (req, res) => {
    const { id } = req.query

    //get notification
    let notifications = await JobNotification.aggregate([
        {
            $match: {
                _id: ObjectId(id)
            }
        },
        {
            $lookup: {
                from: "settings",
                let: {
                    shift_id: "$shift_id"
                },
                pipeline: [
                    {
                        $unwind: "$shift_times",
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$shift_times._id", "$$shift_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: "$shift_times._id",
                            name: "$shift_times.name",
                            duration: "$shift_times.duration",
                            time: "$shift_times.time",
                        }
                    }
                ],
                as: "shift"
            }
        },
        {
            $addFields: {
                shift: {
                    $arrayElemAt: ["$shift", 0]
                }
            }
        },
        {
            $lookup: {
                from: "drivers",
                let: {
                    accepted_drivers: "$accepted_drivers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$_id", "$$accepted_drivers"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            mobile: 1
                        }
                    }
                ],
                as: "accepted_drivers"
            }
        },
        {
            $lookup: {
                from: "drivers",
                let: {
                    rejected_drivers: "$rejected_drivers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$_id", "$$rejected_drivers"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            mobile: 1
                        }
                    }
                ],
                as: "rejected_drivers"
            }
        },
        {
            $lookup: {
                from: "drivers",
                let: {
                    approved_drivers: "$approved_drivers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$_id", "$$approved_drivers"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            mobile: 1
                        }
                    }
                ],
                as: "approved_drivers"
            }
        },
        {
            $project: {
                _id: 1,
                shift: 1,
                accepted_drivers: 1,
                rejected_drivers: 1,
                approved_drivers: 1,
                date: 1,
                created_at: 1
            }
        }
    ])

    if (notifications.length > 0) {
        let notification = notifications[0]
        let { shift: { name: shift_name }, accepted_drivers, rejected_drivers, approved_drivers, date } = notification

        //accpeted drivers work sheet
        const workbooks = new Excel.Workbook();

        const worksheet3 = workbooks.addWorksheet(`${moment(date).format('YYYY-MM-DD')} - ${shift_name} | Approved Drivers`, {
            properties: { tabColor: { argb: "FFC0000" } },
        });

        worksheet3.columns = [
            { header: "ID", key: "booking_id", width: 20 },
            { header: "Name", key: "booking_type", width: 20 },
            { header: "Email", key: "delivery_type", width: 20 },
            { header: "Mobile", key: "products._id", width: 20 },
        ];

        approved_drivers.forEach(driver => {
            let { _id, name, email, mobile } = driver
            const rows = [
                _id,
                name,
                email,
                mobile
            ]
            worksheet3.addRow(rows)
        })

        const worksheet = workbooks.addWorksheet(`${moment(date).format('YYYY-MM-DD')} - ${shift_name} | Accepted Drivers`, {
            properties: { tabColor: { argb: "FFC0000" } },
        });

        worksheet.columns = [
            { header: "ID", key: "booking_id", width: 20 },
            { header: "Name", key: "booking_type", width: 20 },
            { header: "Email", key: "delivery_type", width: 20 },
            { header: "Mobile", key: "products._id", width: 20 },
        ];

        accepted_drivers.forEach(driver => {
            let { _id, name, email, mobile } = driver
            const rows = [
                _id,
                name,
                email,
                mobile
            ]
            worksheet.addRow(rows)
        })

        const worksheet2 = workbooks.addWorksheet(`${moment(date).format('YYYY-MM-DD')} - ${shift_name} | Rejected Drivers`, {
            properties: { tabColor: { argb: "FFC0000" } },
        });

        worksheet2.columns = [
            { header: "ID", key: "booking_id", width: 20 },
            { header: "Name", key: "booking_type", width: 20 },
            { header: "Email", key: "delivery_type", width: 20 },
            { header: "Mobile", key: "products._id", width: 20 },
        ];

        rejected_drivers.forEach(driver => {
            let { _id, name, email, mobile } = driver
            const rows = [
                _id,
                name,
                email,
                mobile
            ]
            worksheet2.addRow(rows)
        })

        await workbooks.xlsx
            .writeFile(`public/reports/cp-${req.session._id}.xlsx`)
            .then(() => {
                return res.redirect(
                    res.locals.asset_url + `/public/reports/cp-${req.session._id}.xlsx`
                );
            })
            .catch((err) => {
                return res.redirect(res.locals.app_url + `/dashboard`);
            });

    } else {
        return res.redirect(res.locals.app_url + `/jobnotifications`);
    }
}

exports.accepted = async (req, res) => {
    const { id: job_id } = req.query
    let drivers = await JobNotification.aggregate([
        {
            $match: {
                _id: ObjectId(job_id)
            }
        },
        {
            $lookup: {
                from: "settings",
                let: {
                    shift_id: "$shift_id"
                },
                pipeline: [
                    {
                        $unwind: "$shift_times",
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$shift_times._id", "$$shift_id"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: "$shift_times._id",
                            name: "$shift_times.name",
                            duration: "$shift_times.duration",
                            time: "$shift_times.time",
                        }
                    }
                ],
                as: "shift"
            }
        },
        {
            $addFields: {
                shift: {
                    $arrayElemAt: ["$shift", 0]
                }
            }
        },
        {
            $lookup: {
                from: "drivers",
                let: {
                    accepted_drivers: "$accepted_drivers"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$_id", "$$accepted_drivers"] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            mobile: 1
                        }
                    }
                ],
                as: "accepted_drivers"
            }
        },
        {
            $unwind: "$accepted_drivers"
        },
        {
            $addFields: {
                accepted: {
                    $cond: { if: { $in: ["$accepted_drivers._id", "$approved_drivers"] }, then: true, else: false }
                }
            }
        },
        {
            $project: {
                _id: "$accepted_drivers._id",
                name: "$accepted_drivers.name",
                email: "$accepted_drivers.email",
                mobile: "$accepted_drivers.mobile",
                accepted: 1
            }
        }
    ])

    return res.render("admin/job_notifications/accepted", {
        drivers,
        job_id
    })
}


exports.approveJob = async (req, res) => {
    let { id, approve, job_id } = req.body
    if (approve) {
        await JobNotification.updateOne({
            _id: ObjectId(job_id)
        }, {
            $addToSet: {
                approved_drivers: ObjectId(id)
            }
        })
    } else {
        await JobNotification.updateOne({
            _id: ObjectId(job_id)
        }, {
            $pull: { approved_drivers: ObjectId(id) }
        })
    }
    return res.json({
        status: true
    })
}

exports.sendJobApprovalNotification = async (req, res) => {
    let { notification } = req.body
    sendJobApproval.add({ notification_id: notification });
    return res.json({
        status: true,
        message: "Notifications send successfully"
    })
}