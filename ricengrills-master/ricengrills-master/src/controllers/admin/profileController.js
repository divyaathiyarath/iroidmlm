const mongoose = require('mongoose')
let ObjectId = mongoose.Types.ObjectId;

const Admin = mongoose.model("admins");

const profilepic = require("../../utils/uploads/profilepic");

const { validateUpdateProfileInputs, validatePasswordUpdateInputs, ValidateForgotPasswordInput, ValidateForgotUpdatePassword } = require('../../validators/admin/profileValidator')

exports.checkEmailExists = async (email, id) => {
    return await Admin.countDocuments({
        email,
        delete_status: false,
        _id: {
            $ne: id
        }
    })
}

exports.checkMobileExists = async (mobile, id) => {
    return await Admin.countDocuments({
        mobile,
        delete_status: false,
        _id: {
            $ne: id
        }
    })
}

exports.profile = async (req, res) => {
    admin = await Admin.findOne({
        _id: req.session._id
    }, {
        salt: 0,
        hash: 0
    })
    let data = {
        admin
    }
    return res.render('admin/profile', data)
}


exports.updateProfile = async (req, res) => {

    try {
        await profilepic(req, res);
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Could not upload image"
        });
    }

    const { errors, isValid } = validateUpdateProfileInputs(req.body)

    if (!isValid) {
        return res.json({
            status: false,
            errors
        })
    }

    let emailExists = await this.checkEmailExists(req.body.email, req.session._id)
    if (emailExists) {
        return res.json({
            status: false,
            message: 'Email already exists'
        })
    }

    if (req.body.mobile != '') {
        let mobileExists = await this.checkMobileExists(req.body.mobile, req.session._id)
        if (mobileExists) {
            return res.json({
                status: false,
                message: 'Mobile already Exists'
            })
        }
    }

    let admin = await Admin.findOne({ _id: req.session._id })
    let image = null;
    if (req.files.profilepic) {
        image = "/" + req.files.profilepic[0].path || null;
    } else {
        image = admin.image
    }
    admin.name = req.body.name
    admin.email = req.body.email
    admin.image = image
    admin.mobile = req.body.mobile
    try {
        await admin.save();
        req.session.name = req.body.name
        req.session.image = image
        return res.json({ status: true, image, message: 'Profile details updated successfully' })
    } catch (err) {
        console.log(err)
        return res.json({ status: false, message: "failes" })
    }
}

exports.updatePassword = async (req, res) => {
    const { errors, isValid } = validatePasswordUpdateInputs(req.body)

    if (!isValid) {
        return res.json({
            status: false,
            errors
        })
    }


    if (req.body.password == req.body.cpassword) {
        let admin = await Admin.findOne({
            _id: req.session._id
        })
        admin.setPassword(req.body.password)
        await admin.save()
        return res.json({
            status: true,
            message: 'Password has been updated successfully'
        })
    } else {
        return res.json({
            status: false,
            message: 'Password and confirm password should be same'
        })
    }

}

exports.generateToken = () => {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Date.now()
}

exports.forgotPassword = async (req, res) => {

    const { sendMagicLink } = require('../../utils/emails/admin/forgot_password')
    const { errors, isValid } = ValidateForgotPasswordInput(req.body)
    if (!isValid) {
        return res.json({
            status: false,
            errors
        })
    }
    try {
        let {
            email
        } = req.body
        let admin = await Admin.findOne({
            email
        })
        if (admin) {
            console.log(admin)
            let token = this.generateToken()
            await Admin.updateOne({
                _id: admin._id
            }, {
                $set: {
                    token: token,
                    token_expiry: new Date().setHours(new Date().getHours() + 1)
                }
            })
            let reset_link = res.locals.app_url + "/password-reset/" + token
            console.log({ reset_link })
            await sendMagicLink({
                name: admin.name,
                reset_link,
                email
            })
            return res.json({
                status: true,
                message: 'We have e-mailed your password reset link',
                reset_link
            })
        } else {
            return res.json({
                status: false,
                message: 'Email id is not registered with us'
            })
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.resetPassword = async (req, res) => {
    try {
        let { token } = req.params
        let admin = await Admin.findOne({
            token
        })
        if (admin) {
            // if(new Date() > new Date(admin.token_expiry) ) {
            //     return res.send('Token has been expired')
            // } else {
            //     return res.render('admin/reset-password', admin)
            // }
            return res.render('admin/reset-password', admin)
        } else {
            return res.send('The link has been expired')
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.updateNewPassword = async (req, res) => {
    const { errors, isValid } = ValidateForgotUpdatePassword(req.body)
    if (!isValid) {
        return res.json({
            status: false,
            errors
        })
    }
    try {
        let { token, password, cpassword } = req.body
        let admin = await Admin.findOne({
            token
        })
        if (admin) {
            if (password == cpassword) {
                await admin.setPassword(password)
                await admin.save()
                return res.json({
                    status: true,
                    message: 'Your password has been updated successfully'
                })
            } else {
                return res.json({
                    status: false,
                    message: 'Password and confirm password are not matching'
                })
            }
        } else {
            return res.json({
                status: false,
                message: 'User not found'
            })
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.updateDeviceToken = async(req,res)=>{
    let { token } = req.query
    if (token) {
        await Admin.updateOne({
            _id: ObjectId(req.session._id)
        }, {
            $set: {
                device_token: token
            }
        });

    }
    return res.json({
        status: true,
        message: "Token updated"
    })
}