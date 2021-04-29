const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")
const Banner = mongoose.model('banners')
const bannerUpload = require("../../utils/uploads/bannerUpload");

//new notification page
exports.new = async (req, res) => {
    return res.render('admin/banners/new')
}

//save notification
exports.save = async (req, res) => {
    try {
        await bannerUpload(req, res)
    } catch (err) {
        // console.log(err)
        return res.json({ status: false, message: "Could not upload field" })
    }

    try {

        let { type } = req.body
        let { image } = req.files
        if (typeof image != 'undefined' && image.length > 0) {
            image = image[0].destination + "/" + image[0].filename
        }

        banner = new Banner({
            type,
            image
        })

        await banner.save()

        return res.json({
            status: true,
            message: "Banner saved successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not save Banner"
        })
    }
}

//list notifications
exports.list = async (req, res) => {
    let { page, limit, type } = req.query
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
    if(type){
        query.push({
            $match:{
                type
            }
        })
    }
    query.push({
        $match:{
            delete_status:false
        }
    },
    {
        $sort:{
            created_at:-1
        }
    })

    let banners = await Banner.aggregate([...query,{
        $skip: skip
    }, {
        $limit: limit
    }])

    let itemCount = await Banner.aggregate([...query, {
        $count: "count"
    }])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit);

    let data = {
        banners,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
        type
    }

    return res.render('admin/banners/list',data)
}

//delete notificaiton
exports.delete = async (req, res) => {
    let {banner} = req.body
    await Banner.updateOne({
        _id:ObjectId(banner)
    },{
        $set:{
            deleted_at:new Date(),
            delete_status:true
        }
    })

    return res.json({
        status:true,
        message:"Banner deleted successfully"
    })
}
