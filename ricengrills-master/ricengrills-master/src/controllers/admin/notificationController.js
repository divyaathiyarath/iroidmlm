const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")
const Suburb = mongoose.model('suburbs')
const Notification = mongoose.model('notifications')
const { adminNotificationQueue } = require("../../jobs/notification")
const { validateNotificationInputs } = require('../../validators/notificationValidator')
const notificationUpload = require("../../utils/uploads/notificationUpload");
const notifications = require('../../models/notifications');

//new notification page
exports.new = async (req, res) => {
    let suburbs = await Suburb.find({ delete_status: false })
    return res.render('admin/notifications/new', {
        suburbs
    })
}

//save notification
exports.save = async (req, res) => {
    try {
        await notificationUpload(req, res)
    } catch (err) {
        // console.log(err)
        return res.json({ status: false, message: "Could not upload field" })
    }

    const { errors, isValid } = validateNotificationInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {

        let { title, description, suburbs, email } = req.body
        if(!email){
            email = 0
        }
        let suburbs_array = []
        if (suburbs && suburbs.length > 0) {
            suburbs.forEach(suburb => {
                suburbs_array.push(ObjectId(suburb))
            })
        } else {

            suburb_data = await Suburb.find({ delete_status: false })
            suburb_data.forEach(suburb => {
                suburbs_array.push(ObjectId(suburb._id))
            })
        }
        let { image } = req.files
        if (typeof image != 'undefined' && image.length > 0) {
            image = image[0].destination + "/" + image[0].filename
        }

        notification = new Notification({
            title,
            description,
            image,
            suburbs: suburbs_array
        })

        await notification.save()

        adminNotificationQueue.add({ notification_id: notification._id, email});

        //select users


        return res.json({
            status: true,
            message: "Notification send successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not send notification"
        })
    }
}

//list notifications
exports.list = async (req, res) => {
    let { page, limit, search } = req.query
    if (typeof limit == 'undefined') {
        limit = 20
    }

    if (typeof page == 'undefined') {
        page = 1
    }

    let skip = 0
    if (page > 1) {
        skip = (page - 1) * limit
    }

    let query = []
    if (search) {
        let regex = { $regex: new RegExp(".*" + search.trim() + ".*", "i") };
        query.push({
            $match: {
                $or: [
                    { title: regex },
                    { description: regex },
                ]
            }
        })
    }

    query.push({
        $match: {
            delete_status: false
        }
    },
        {
            $sort: {
                created_at: -1
            }
        })

    let notifications = await Notification.aggregate([...query, {
        $skip: skip
    }, {
        $limit: limit
    }])

    let itemCount = await Notification.aggregate([...query, {
        $count: "count"
    }])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit);

    let data = {
        notifications,
        itemCount,
        pageCount,
        search,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page
    }

    return res.render('admin/notifications/list', data)
}

//delete notificaiton
exports.delete = async (req, res) => {
    let { notification } = req.body
    await Notification.updateOne({
        _id: ObjectId(notification)
    }, {
        $set: {
            deleted_at: new Date(),
            delete_status: true
        }
    })

    return res.json({
        status: true,
        message: "Notification deleted successfully"
    })
}
