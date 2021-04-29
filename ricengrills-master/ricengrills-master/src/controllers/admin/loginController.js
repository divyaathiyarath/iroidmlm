const mongoose = require('mongoose')
const Admin = mongoose.model('admins')
const { validateLoginInputs } = require('../../validators/adminValidator')

//admin dashboard login
exports.login = async(req, res) => {
    if (req.session.id && req.session.role == "admin") {
        return res.redirect(res.locals.app_url + '/dashboard')
    }
    return res.render('admin/login')
}

//validate login
exports.validateLogin = async(req, res) => {
    let { email, password } = req.body
    const { errors, isValid } = validateLoginInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors });
    }
    let admin = await Admin.findOne({
        email,
        delete_status: false
    })
    try {
        if (admin) {
            if (admin.validatePassword(password)) {
                req.session._id = admin._id
                req.session.role = admin.role
                req.session.name = admin.name
                req.session.image = admin.image
                req.session.role = "admin"
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