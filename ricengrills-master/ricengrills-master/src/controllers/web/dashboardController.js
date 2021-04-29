const mongoose = require("mongoose");
const moment = require("moment");
const notification = require("../../jobs/notification");
let ObjectId = mongoose.Types.ObjectId
let User = mongoose.model('users')
let Driver = mongoose.model('drivers')
let Vehicle = mongoose.model('vehicles')
let Product = mongoose.model('products')
let Setting = mongoose.model('settings')
let Suburb = mongoose.model('suburbs')
let Banner = mongoose.model('banners')
let Address = mongoose.model('addresses')
let CollectionPoint = mongoose.model('collectionpoints')
let Notification = mongoose.model('notifications')
let Company = mongoose.model('temp_companies')
const { validateRefillerDriverInputs } = require('../../validators/vehicleValidator')
const { validateCompanyInputs } = require('../../validators/companyValidator')
const {
    validateCollectionPointInputs,
} = require("../../validators/collectionPointValidator");
const driverUpload = require("../../utils/uploads/driverUploads");
const collectionpointUpload = require("../../utils/uploads/collectionpointUpload");
const {
    newCpCreatedMail,
} = require("../../utils/emails/admin/collection_points");
const { trimMobile } = require("../../utils/general")

exports.home = async (req, res) => {
    let setting = await Setting.findOne();
    let banners = await Banner.find({
        delete_status: false,
        type: "HOME"
    })
    // return res.json(banners)
    return res.render('web/index2', {
        banners,
        gst: setting.gst
    })
}

exports.updateDeviceToken = async (req, res) => {
    let { token } = req.body
    if (token) {
        await User.updateOne({
            _id: ObjectId(req.session._id)
        }, {
            $set: {
                device_token: token
            }
        })
    }
    return res.json({
        status: true,
        message: "Token updated"
    })
}


exports.aboutUs = async (req, res) => {
    return res.render('web/about_us')
}

exports.faq = async (req, res) => {
    return res.render('web/faq')
}

exports.menudirect = async (req, res) => {
    return res.render('web/faq')
}

exports.cookies = async (req, res) => {
    return res.render('web/cookies')
}

exports.privacy = async (req, res) => {
    return res.render('web/privacy')
}

exports.termsofuse = async (req, res) => {
    return res.render('web/termsofuse')
}

exports.beOurPartner = async (req, res) => {
    let suburbs = await Suburb.find({ delete_status: false });
    return res.render('web/beourpartner', {
        suburbs
    })
}

exports.beOurDPartner = async (req, res) => {
    return res.render('web/beourdpartner')
}

exports.checkDriverEmailExists = async (email) => {
    driver = await Driver.findOne({ email, delete_status: false }).countDocuments();
    return driver
}

exports.checkDriverMobileExists = async (mobile) => {
    driver = await Driver.findOne({ mobile, delete_status: false }).countDocuments();
    return driver
}

exports.addDeliveryPartner = async (req, res) => {
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
        let { name, email, mobile, address, license_expiry, license_number, type, insurance_validity, registration_number } = req.body
        mobile = trimMobile(mobile)
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

        let { license, police_clearance, insurance } = req.files

        if (typeof license != 'undefined' && license.length > 0) {
            license = license[0].destination + "/" + license[0].filename
        }

        if (typeof police_clearance != 'undefined' && police_clearance.length > 0) {
            police_clearance = police_clearance[0].destination + "/" + police_clearance[0].filename
        }

        if (typeof insurance != 'undefined' && insurance.length > 0) {
            insurance = insurance[0].destination + "/" + insurance[0].filename
        }

        driver = new Driver({
            name,
            email,
            mobile: trimMobile(mobile),
            address,
            license_expiry,
            license_number,
            driving_license: license,
            police_clearance,
            type,
            age_confirm: true,
            profile_completed: true,
            is_approved: false
        })

        await driver.save()

        vehicle = new Vehicle({
            driver_id: driver._id,
            registration_number,
            insurance_validity,
            insurance
        });
        await vehicle.save();

        driver.vehicle_id = vehicle._id
        await driver.save()

        return res.json({
            status: true,
            message: "Delivery partner request send successfully, please wait for admin approval"
        })

    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not add vehicle"
        })
    }
}

exports.checkCpEmailExists = async (email, id = null) => {
    let query = { email, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await CollectionPoint.findOne(query).countDocuments();
    return cp;
};

exports.checkCpMobileExists = async (mobile, id = null) => {
    let query = { mobile, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await CollectionPoint.findOne(query).countDocuments();
    return cp;
};

exports.addCollectionPoint = async (req, res) => {
    try {
        await collectionpointUpload(req, res);
    } catch (err) {
        return res.json({ status: false, message: "Could not upload image" });
    }

    const { errors, isValid } = await validateCollectionPointInputs(req.body);
    if (!isValid) {
        return res.json({ status: false, errors });
    }

    try {
        let {
            name,
            contact_name,
            email,
            mobile,
            address_line1,
            address_line2,
            lat,
            lng,
            suburb_id,
        } = req.body;
        let { image } = req.files;

        mobile = trimMobile(mobile)

        if (typeof image != "undefined" && image.length > 0) {
            image = image[0].destination + "/" + image[0].filename;
        }

        let is_email_exists = await this.checkCpEmailExists(email);
        if (is_email_exists) {
            return res.json({ status: false, message: "Email already exists" });
        }

        let is_mobile_exists = await this.checkCpMobileExists(mobile);
        if (is_mobile_exists) {
            return res.json({ status: false, message: "Mobile already exists" });
        }

        cp = new CollectionPoint({
            name,
            contact_name,
            email,
            mobile: trimMobile(mobile),
            image,
            approved: false,
        });
        let password = "rng" + Date.now();
        cp.setPassword(password);
        await cp.save();

        if (cp._id) {
            let address = new Address({
                collectionpoint_id: cp._id,
                type: "COLLECTION_POINT",
                address_line1,
                address_line2,
                suburb_id,
                location: {
                    coordinates: [lng, lat],
                    type: "Point",
                },
            });
            await address.save();
        }

        // await newCpCreatedMail({
        //     name: cp.name,
        //     email: cp.email,
        //     password,
        //     asset_url: res.locals.asset_url,
        //     app_url: res.locals.cp_url,
        // });

        return res.json({
            status: true,
            message: "Collection point request submitted successfully, waiting for admin approval",
        });
    } catch (err) {
        console.log(err);
        return res.json({
            status: false,
            message: "Could not request for collection point",
        });
    }
};

exports.confirmJob = async (req, res) => {
    return res.json({
        status: false,
        message: "Could not confirm the job request"
    })
}

exports.getRegularProducts = async (req, res) => {
    let { food_only } = req.query
    let filter_types = ["FOOD", "ACCESSORIES"]
    if (food_only == "1") {
        filter_types = ["FOOD"]
    }
    let products = await Product.aggregate([
        {
            $match: {
                delete_status: false,
                is_regular: true,
                type: {
                    $in: filter_types
                }
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                image: 1,
                type: 1,
                is_veg: 1,
                allergen_contents: 1,
                container_size: 1,
                ingredients: 1,
                description: 1,
                price: 1
            }
        },
        {
            $sort: {
                type: -1
            }
        }
    ])
    return res.json({ status: true, products })
}

exports.notifications = async (req, res) => {
    let address = await Address.findOne({
        delete_status: false,
        user_id: ObjectId(req.session._id),
        active_location: true
    })
    if (!address) {
        address = await Address.findOne({
            delete_status: false,
            user_id: ObjectId(req.session._id)
        })
    }
    let suburb_id = null
    if (address) {
        suburb_id = ObjectId(address.suburb_id)
    }
    let notifications = await Notification.aggregate([
        {
            $match: {
                delete_status: false,
                $expr: {
                    $or: [
                        { $in: [suburb_id, '$suburbs'] },
                        { $eq: [ObjectId(req.session._id), '$user_id'] }
                    ]
                }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                image: 1,
                created_at: 1
            }
        }
    ])
    // return res.json({
    //     notifications,
    //     suburb_id,
    //     address,
    //     user_id: req.session._id
    // })
    return res.render('web/notifications', { notifications })
}

exports.company = async (req, res) => {
    let suburbs = await Suburb.find({ delete_status: false });
    return res.render('web/company', { suburbs })
}

exports.checkCompanyEmailExists = async (email, id = null) => {
    let query = { email, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await Company.findOne(query).countDocuments();
    return cp;
};

exports.checkCompanyMobileExists = async (mobile, id = null) => {
    let query = { mobile, delete_status: false };
    if (id) {
        query._id = {
            $ne: id,
        };
    }
    cp = await Company.findOne(query).countDocuments();
    return cp;
};

exports.saveCompany = async (req, res) => {

    let { name, email, mobile, address_line1, address_line2, lat, lng, suburb_id } = req.body
    
    const { errors, isValid } = await validateCompanyInputs(req.body);
    if (!isValid) {
        return res.json({ status: false, errors });
    }

    mobile = trimMobile(mobile)

    if (email) {
        let is_email_exists = await this.checkCompanyEmailExists(email);
        if (is_email_exists) {
            return res.json({ status: false, message: "Email already exists" });
        }
    }

    if (mobile) {
        let is_mobile_exists = await this.checkCompanyMobileExists(mobile);
        if (is_mobile_exists) {
            return res.json({ status: false, message: "Mobile already exists" });
        }
    }

    try {

        let company = new Company({
            name,
            email,
            mobile
        })

        let address = new Address({
            address_line1,
            address_line2,
            location: {
                type: 'Point',
                coordinates: [
                    lng,
                    lat
                ]
            },
            suburb_id: ObjectId(suburb_id),
            type: "OFFICE",
            address_type: "OFFICE"
        })

        await company.save()
        address.company_id = company._id
        await address.save()

        return res.json({
            status: true,
            message: "Company information submitted successfully"
        })

    } catch (err) {
        return res.json({
            status: false,
            message: "Could not register company"
        })
    }
}