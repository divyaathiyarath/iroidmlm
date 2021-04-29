const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId
const paginate = require("express-paginate")
const Box = mongoose.model('boxes')
const Sensor = mongoose.model('sensors')
const Setting = mongoose.model('settings')
let { validateShiftInputs } = require('../../validators/shiftValidator')
const shiftIconUpload = require('../../utils/uploads/shiftIconUpload')

exports.new = async(req, res) => {
    return res.render('admin/shifts/new')
}

exports.getTwentyFourHourTime = (amPmString) => {
    var d = new Date("1/1/2013 " + amPmString);
    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}

exports.save = async(req, res) => {
    try {
        await shiftIconUpload(req, res)
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not upload icon"
        })
    }
    const { errors, isValid } = validateShiftInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }
    try {
        let setting = await Setting.findOne()
        if (!setting) {
            setting = new Setting()
            await setting.save()
        }

        let { name, duration, time } = req.body
        let { icon } = req.files
        if(typeof icon != 'undefined' && icon.length > 0) {
            icon = icon[0].destination + "/" + icon[0].filename
        }
        // time = this.getTwentyFourHourTime(time)

        await Setting.updateOne({}, {
            $addToSet: {
                shift_times: {
                    name,
                    duration,
                    time,
                    icon
                }
            }
        })

        return res.json({
            status: true,
            message: "Shift added successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not save Box"
        })
    }
}


exports.list = async(req, res) => {
    let setting = await Setting.findOne()
    let shifts = setting.shift_times
    return res.render('admin/shifts/list', { shifts });
}


exports.delete = async(req, res) => {
    const { shift } = req.body
    await Setting.updateOne({}, {
        $pull: { shift_times: { _id: ObjectId(shift) } }
    })
    return res.json({
        status: true,
        message: "Shift deleted successfully"
    })
}

exports.edit = async(req, res) => {
    let { shift_id } = req.params;
    let shift = await Setting.findOne({ "shift_times._id": ObjectId(shift_id) }, { shift_times: { $elemMatch: { _id: ObjectId(shift_id) } } })
    if (typeof shift.shift_times != "undefined" && shift.shift_times.length > 0) {
        shift = shift.shift_times[0]
    }
    if (!shift) {
        res.redirect(res.locals.app_url + "/shifts/new")
    }
    return res.render('admin/shifts/edit', { shift })
}

exports.update = async(req, res) => {
    try {
        await shiftIconUpload(req, res)
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not upload icon"
        })
    }
    const { errors, isValid } = validateShiftInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { _id, name, duration, time } = req.body
        let { icon } = req.files

        if (typeof icon != 'undefined' && icon.length > 0) {
            icon = icon[0].destination + "/" + icon[0].filename
        }
        if(icon) {
            await Setting.updateOne({
                shift_times: { $elemMatch: { _id: { $eq: ObjectId(_id) } } }
            }, { $set: { "shift_times.$.name": name, "shift_times.$.duration": duration, "shift_times.$.time": time, "shift_times.$.icon": icon } })
        } else {
            await Setting.updateOne({
                shift_times: { $elemMatch: { _id: { $eq: ObjectId(_id) } } }
            }, { $set: { "shift_times.$.name": name, "shift_times.$.duration": duration, "shift_times.$.time": time } })
        }
        return res.json({
            status: true,
            message: "Shift updated successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not update Shift"
        })
    }
}