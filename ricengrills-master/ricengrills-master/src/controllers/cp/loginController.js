const mongoose = require('mongoose')
const CP = mongoose.model('collectionpoints')
const { validateLoginInputs } = require('../../validators/collectionPointValidator')

//admin dashboard login
exports.login = async(req, res) => {
    if (req.session.id && req.session.role == "cp") {
        return res.redirect(res.locals.app_url + '/dashboard')
    }
    return res.render('cp/login')
}

//validate login
exports.validateLogin = async(req, res) => {
    let { email, password } = req.body
    const { errors, isValid } = validateLoginInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors });
    }
    let cp = await CP.findOne({
        email,
        delete_status: false,
        approved:true
    })
    try {
        if (cp) {
            if (cp.validatePassword(password)) {
                req.session._id = cp._id
                req.session.name = cp.name
                req.session.image = cp.image
                req.session.role = "cp"
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