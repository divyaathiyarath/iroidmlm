const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;
const paginate = require("express-paginate")

const Driver = mongoose.model('drivers')
const Vehicle = mongoose.model('vehicles')
const Stocks = mongoose.model('stock_requests')
const Aboutus = mongoose.model('about_us')
const Privacypolicy = mongoose.model('privacy_policies')
const TNC = mongoose.model('terms_conditions')
const { validateRefillerDriverInputs, validateVehicleChangeInputs, ValidateDriverApproveInput, ValidateDriverRejectionInput } = require('../../validators/vehicleValidator')
const driverUpload = require("../../utils/uploads/driverUploads");
const {
    newDriverCreatedMail,
} = require("../../utils/emails/admin/collection_points");

//add vehicle
exports.new = async (req, res) => {
    return res.render('admin/drivers/new')
}
//add vehicle
exports.save = async (req, res) => {
    try {
        await driverUpload(req, res)
    } catch (err) {
        console.log(err.message)
        return res.json({ status: false, message: "Could not upload file" })
    }

    const { errors, isValid } = validateRefillerDriverInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }

    try {
        let { name, email, mobile, address, license_expiry, license_number, type,abn } = req.body
        const IS_EMAIL_EXISTS = await this.checkDriverEmailExists(email);
        if (IS_EMAIL_EXISTS) {
            return res.json({
                status: false,
                message: "This email is already registered"
            })
        }

        const IS_MOBILE_EXISTS = await this.checkDriverMobileExists(mobile);
        if (IS_MOBILE_EXISTS) {
            return res.json({
                status: false,
                message: "This mobile is already registered"
            })
        }

        let { license, police_clearance } = req.files

        if (typeof license != 'undefined' && license.length > 0) {
            license = license[0].destination + "/" + license[0].filename
        }

        if (typeof police_clearance != 'undefined' && police_clearance.length > 0) {
            police_clearance = police_clearance[0].destination + "/" + police_clearance[0].filename
        }

        driver = new Driver({
            name,
            email,
            mobile,
            address,
            license_expiry,
            license_number,
            driving_license: license,
            police_clearance,
            type,
            age_confirm: true,
            profile_completed: true,
            is_approved: true,
            abn
        })
        await driver.save()
        await newDriverCreatedMail({
            name: driver.name,
            email: driver.email
        })
        return res.json({
            status: true,
            message: "Driver saved successfully"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not add vehicle"
        })
    }

}
//list vehicles
exports.list = async (req, res) => {
    let { search, page, limit } = req.query
    let refilling_vehicles = await Vehicle.aggregate([{
        $match: {
            delete_status: false,
            // type: 'REFILLING' 
        }
    }, {
        $project: {
            _id: 1,
            registration_number: 1
        }
    }]);
    if (typeof limit == 'undefined') {
        limit = 10
    }
    if (typeof page == 'undefined') {
        page = 1
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
                $or: [{
                    name: regex
                }, {
                    mobile: regex,

                }, { email: regex }]
            }
        })
    }
    query.push({
        $match: {
            profile_completed: true,
            is_approved: true,
            is_rejected: false,
            delete_status: false
        }
    }, {
        $lookup: {
            from: "vehicles",
            localField: "vehicle_id",
            foreignField: "_id",
            as: "vehicle"
        }
    }, {
        $addFields: {
            vehicle: {
                $arrayElemAt: ['$vehicle', 0]
            }
        }
    })

    let drivers = await Driver.aggregate([...query, {
        $skip: skip
    }, {
        $limit: limit
    }])

    let itemCount = await Driver.aggregate([...query, {
        $count: "count"
    }])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit);

    let data = {
        search,
        drivers,
        vehicles: refilling_vehicles,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page,
    }
    return res.render('admin/drivers/list', data)
}

exports.checkDriverEmailExists = async (email) => {
    driver = await Driver.findOne({ email, delete_status: false }).countDocuments();
    return driver
}

exports.checkDriverMobileExists = async (mobile) => {
    driver = await Driver.findOne({ mobile, delete_status: false }).countDocuments();
    return driver
}

exports.changeVehicle = async (req, res) => {
    const { errors, isValid } = validateVehicleChangeInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }
    const { driver, vehicle } = req.body;

    await Driver.updateMany({
        vehicle_id: ObjectId(vehicle)
    }, {
        $set: {
            vehicle_id: null
        }
    })

    await Vehicle.updateMany({
       _id: ObjectId(vehicle)
    }, {
        $set: {
            driver_id: null
        }
    })

    await Driver.updateOne({
        _id: ObjectId(driver)
    }, {
        $set: {
            vehicle_id: ObjectId(vehicle)
        }
    })

    await Vehicle.updateOne({
        _id: ObjectId(vehicle)
    }, {
        $set: {
            driver_id: ObjectId(driver)
        }
    })

    return res.json({
        status: true,
        message: "Driver vehicle changed successfully"
    })
}

exports.delete = async (req, res) => {
    const { driver } = req.body
    await Driver.updateOne({
        _id: ObjectId(driver)
    }, {
        $set: {
            delete_status: true,
            deleted_at: Date.now()
        }
    })
    return res.json({
        status: true,
        message: "Driver deleted successfully"
    })
}

exports.one = async (req, res) => {
    const { driver } = req.query
    if(!driver){
        return res.json({
            status: false,
            driver: null
        })
    }
    let drivers = await Driver.findOne({
        _id: ObjectId(driver),
        delete_status: false
    })
    return res.json({
        status: true,
        test:true,
        driver: drivers
    })
}

exports.pendingDrivers = async (req, res) => {
    let { search, page, limit } = req.query
    if (typeof limit == "undefined") limit = 10
    if (typeof page == "undefined") page = 1
    let skip = 0
    if (page > 1) {
        skip = (page - 1) * limit
    }
    let query = []
    if (search) {
        let regex = { $regex: new RegExp(`.*${search.trim()}.*`, "i") }
        query.push(
            {
                $match: {
                    $or: [
                        { name: regex },
                        { mobile: search.trim() },
                        { email: search.trim() }
                    ]
                }
            }
        )
    }
    query.push(
        {
            $match: {
                delete_status: false,
                is_approved: false,
                is_rejected: false
            }
        },
        {
            $lookup: {
                from: 'vehicles',
                localField: 'vehicle_id',
                foreignField: '_id',
                as: "vehicle"
            }
        },
        {
            $addFields: {
                vehicle: {
                    $arrayElemAt: ["$vehicle", 0]
                }
            }
        }
    )
    let drivers = await Driver.aggregate([
        ...query, {
            $skip: skip
        },
        {
            $limit: limit
        }
    ])

    let itemCount = await Driver.aggregate([
        ...query, {
            $count: "count"
        }
    ])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit)

    let data = {
        search,
        drivers,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page
    }
    return res.render('admin/drivers/pending', data)
}

exports.approveDriver = async (req, res) => {
    const { driver_approved } = require("../../utils/emails/admin/drivers")
    try {
        const { errors, isValid } = ValidateDriverApproveInput(req.body)
        if (!isValid) {
            return res.json({
                status: false,
                message: errors[0]
            })
        }
        let { driver } = req.body
        await Driver.updateOne({
            _id: driver
        }, {
            $set: {
                is_approved: true,
                is_rejected: false
            }
        })
        driver = await Driver.findOne({
            _id: ObjectId(driver)
        })
        await driver_approved({
            name: driver.name,
            email: driver.email,
            asset_url: res.locals.asset_url
        })
        return res.json({
            status: true,
            message: 'Driver has been approved'
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.rejectDriver = async (req, res) => {
    const { driver_rejected } = require("../../utils/emails/admin/drivers")
    const { errors, isValid } = ValidateDriverRejectionInput(req.body)
    if (!isValid) {
        return res.json({
            status: false,
            message: errors[0]
        })
    }
    try {
        let { driver, admin_review } = req.body

        driver = await Driver.findOne({
            _id: ObjectId(driver)
        })

        let email_resp = {
            name: driver.name,
            email: driver.email,
            asset_url: res.locals.asset_url,
            admin_review: driver.admin_review
        }

        await Driver.updateOne({
            _id: driver
        }, {
            $set: {
                admin_review,
                is_approved: false,
                is_rejected: true
            }
        })

        await driver_rejected(email_resp)
        
        return res.json({
            status: true,
            message: 'Driver has been rejected'
        })
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.rejectedDrivers = async (req, res) => {
    let { search, page, limit } = req.body
    if (typeof limit == "undefined") limit = 10
    if (typeof page == "undefined") page = 1
    let skip = 0
    if (page > 1) {
        skip = (page - 1) * limit
    }
    let query = []
    if (search) {
        let regex = new RegExp(`.*${search.trim()}.*`, "i")
        query.push(
            {
                $match: {
                    $or: [
                        { name: regex },
                        { mobile: search.trim() },
                        { email: search.trim() }
                    ]
                }
            }
        )
    }
    query.push(
        {
            $match: {
                delete_status: false,
                is_approved: false,
                is_rejected: true
            }
        },
        {
            $lookup: {
                from: 'vehicles',
                localField: 'vehicle_id',
                foreignField: '_id',
                as: "vehicle"
            }
        },
        {
            $addFields: {
                vehicle: {
                    $arrayElemAt: ["$vehicle", 0]
                }
            }
        }
    )
    let drivers = await Driver.aggregate([
        ...query, {
            $skip: skip
        },
        {
            $limit: limit
        }
    ])

    let itemCount = await Driver.aggregate([
        ...query, {
            $count: "count"
        }
    ])

    if (itemCount.length > 0) {
        itemCount = itemCount[0].count
    } else {
        itemCount = 0
    }

    const pageCount = Math.ceil(itemCount / limit)

    let data = {
        search,
        drivers,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page
    }
    return res.render('admin/drivers/rejected', data)
}

exports.stockRequests = async (req, res) => {
    const eStocks = await Stocks.aggregate([
        {
            $lookup:
            {
                from: "drivers",
                let: { driver_id: "$driver_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$_id", "$$driver_id"] },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                        },
                    },
                ],
                as: "drivers",
            },
        },
        {
            $lookup: {
                from: "products",
                let: { requests: "$requests" },
                pipeline: [
                    {
                        $addFields: {
                            requests: "$$requests",
                        },
                    },
                    {
                        $unwind: "$requests",
                    },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$requests.product_id"] },
                                    { $eq: ["$is_regular", true] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            cover_pic: 1,
                            type: 1,
                            image: 1,
                            quantity: "$requests.quantity",
                            approve_status: 1
                        },
                    },
                ],
                as: "requests"
            }
        }
    ])
    console.log(eStocks);
    res.render("admin/drivers/stockrequests", { eStocks })
}

exports.aboutus = async(req,res)=>{
    const aboutus = await Aboutus.findOne()
    return res.render("admin/drivers/aboutus",{aboutus})
}

exports.saveaboutus = async(req,res)=>{
 let {editordata,title} = req.body
 let aboutus = await Aboutus.findOne()
    try {
        aboutus.title = title
        aboutus.description = editordata
        await aboutus.save()
        return res.json({
            status:true,
            message:"About Us has been updated"
        })
    } catch (error) {
        return res.json({
            status:false,
            message:"Something went wrong"
        })
    }
}

exports.privacypolicy = async(req,res)=>{
    const privacypolicy = await Privacypolicy.findOne()
    return res.render("admin/drivers/privacypolicy",{privacypolicy})
}

exports.saveprivacypolicy = async(req,res)=>{
    let {title,editordata} = req.body
    let privacy_policy = await Privacypolicy.findOne()
    try {
        privacy_policy.title = title
        privacy_policy.description = editordata
        await privacy_policy.save()
        return res.json({
            status: true,
            message:"Privacy policy updated"
        })
    } catch (error) {
        console.log(error)
        return res.json({
            status:false,
            message:"somthing went wrong"
        })
    }
}

exports.termsnconditions = async(req,res)=>{
    const tnc = await TNC.findOne()
    return res.render("admin/drivers/termsncond",{tnc})
}

exports.savetnc = async(req,res)=>{
    let {title,editordata} = req.body
    let tnc = await TNC.findOne()
    try {
        tnc.title = title
        tnc.description = editordata
        await tnc.save()
        return res.json({
            status:true,
            message:"Terms and Conditions Updated"
        })
    } catch (error) {
        return res.json({
            status: false,
            message:"something went wrong"
        })
    }
}

exports.tempLogs = async(req,res)=>{
    
}