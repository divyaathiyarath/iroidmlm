const mongoose = require('mongoose')
const Driver = mongoose.model('drivers')
const { validateLoginInputs } = require('../../validators/collectionPointValidator')

//admin dashboard login
exports.login = async(req, res) => {
    if (req.session.id && req.session.role == "cp") {
        return res.redirect(res.locals.app_url + '/dashboard')
    }
    return res.render('driver-panel/login')
}

//validate login
exports.validateLogin = async(req, res) => {
    let { email, password } = req.body
    const { errors, isValid } = validateLoginInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors });
    }
    let driver = await Driver.findOne({
        email,
        delete_status: false
    })
    // driver.setPassword('123456')
    // return res.json({
    //     status: false,
    //     pass:driver.password
    // })
    try {
        if (driver) {
            if (driver.validatePassword(password)) {
                if (!driver.type == "REFILLING") {
                    return res.json({
                        status: false,
                        errors: ["You are not authorized to login to driver panel"]
                    })
                }
                req.session._id = driver._id
                req.session.name = driver.name
                req.session.image = driver.image
                req.session.role = "driver"
                req.session.type = driver.type
                return res.json({
                    status: true,
                    message: "Login success"
                })
            } else {
                return res.json({
                    status: false,
                    errors: ["Invalid login credentials"]
                })
            }
        } else {
            return res.json({
                status: false,
                message: "Email not exists"
            })
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Invalid login credentials"
        })
    }
}

//generate admin cred
// admin = new Admin()
// admin.name = "Admin"
// admin.email = "admin@gmail.com"
// admin.setPassword('123456')
// await admin.save()