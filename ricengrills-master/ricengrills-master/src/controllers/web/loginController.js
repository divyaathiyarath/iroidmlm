const mongoose = require('mongoose')
const User = mongoose.model('users')
const Company = mongoose.model('temp_companies')
const Suburb = mongoose.model('suburbs')
const Address = mongoose.model('addresses')
const Coupon = mongoose.model('coupons')
const { ValidateUserInputWeb, ValidateUserSignUpInputs } = require('../../validators/usersValidator')
const { sendUserSignInSms } = require('../../jobs/sendSms')
const { trimMobile } = require('../../utils/general')
const { v4: uuidv4 } = require('uuid')
const { forgotPassword } = require('../../utils/emails/user/forgot_password')
let ObjectId = mongoose.Types.ObjectId

exports.getRndInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
}

exports.login = async (req, res) => {
    if (req.session.id && req.session.role == "user") {
        return res.redirect(res.locals.app_url + '/home')
    }
    return res.render('web/login')
}

exports.sendOtp = async (req, res) => {
    let { mobile } = req.body
    mobile = trimMobile(mobile)
    const { errors, isValid } = ValidateUserInputWeb(req.body)
    if (!isValid) {
        return res.json({ status: false, errors });
    }
    let user = await User.findOne({
        mobile,
        delete_status: false
    })
    try {
        if (user) {
            user.otp = this.getRndInteger(111111, 999999)
            await user.save()
            sendUserSignInSms.add({
                user_id: user._id
            });
            return res.json({
                status: true,
                message: "OTP send to your mobile number",
                mobile: user.mobile
            })
        } else {
            return res.json({
                status: false,
                message: "Mobile number not exists"
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

exports.validateLogin = async (req, res) => {
    let { email, password } = req.body
    let user = await User.findOne({
        email,
        delete_status: false
    })
    try {
        if (user.validatePassword(password)) {
            req.session._id = user._id
            req.session.name = user.name
            req.session.image = user.profile_pic
            req.session.email = user.email
            req.session.mobile = user.mobile
            req.session.role = "user"
            let redirect_to_cart = 0
            if (typeof req.session.cart != 'undefined') {
                redirect_to_cart = 0
            }
            return res.json({
                status: true,
                message: "Login success, redirecting...",
                redirect_to_cart
            })
        } else {
            return res.json({
                status: false,
                message: "Invalid user credentials"
            })
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Invalid user credentials"
        })
    }
}

exports.signup = async (req, res) => {
    let { ref } = req.query
    if (req.session.id && req.session.role == "user") {
        return res.redirect(res.locals.app_url + '/home')
    }
    let companies = await Company.find({ delete_status: false })
    let suburbs = await Suburb.find({ delete_status: false });
    return res.render('web/signup', {
        ref,
        companies,
        suburbs
    })
}

exports.checkEmailExists = async (email, id) => {
    let query = {
        delete_status: false,
        email,
    };
    if (id != null) {
        query._id = {
            $ne: id,
        };
    }
    return await User.countDocuments(query);
};

// check mobile exists
exports.checkMobileExists = async (mobile, id) => {
    mobile = trimMobile(mobile)
    let query = {
        delete_status: false,
        mobile,
    };
    if (id != null) {
        query._id = {
            $ne: id,
        };
    }
    return await User.countDocuments(query);
};

exports.randomString = (length) => {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
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

exports.addUser = async (req, res) => {
    const { welcomeMail } = require("../../utils/emails/user/welcome_mail")
    const { errors, isValid } = ValidateUserSignUpInputs(req.body);
    if (!isValid) {
        return res.json({
            status: false,
            message: errors[0],
        });
    }
    try {
        let {
            name,
            email,
            mobile,
            ref: refferer_code,
            password,
            has_company,
            company_id,
            company_name,
            company_email,
            company_mobile,
            company_address1,
            company_address2,
            suburb_id,
            lat,
            lng
        } = req.body;
        reffered_by = null
        if (refferer_code) {
            let referer = await User.findOne({ refferal_code: refferer_code })
            if (referer) {
                reffered_by = referer._id
            }
        }
        mobile = trimMobile(mobile)

        if (await this.checkEmailExists(email, null)) {
            return res.json({
                status: false,
                message: "Email already registered with us",
            });
        }
        if (await this.checkMobileExists(mobile, null)) {
            return res.json({
                status: false,
                message: "Mobile number already registered with us",
            });
        }

        if(company_id == "other"){
            company_mobile = trimMobile(company_mobile)
            if (company_email) {
                let is_email_exists = await this.checkCompanyEmailExists(company_email);
                if (is_email_exists) {
                    return res.json({ status: false, message: "Email already exists" });
                }
            }
            if (company_mobile) {
                let is_mobile_exists = await this.checkCompanyMobileExists(company_mobile);
                if (is_mobile_exists) {
                    return res.json({ status: false, message: "Company mobile already exists" });
                }
            }
        }

        if (has_company == "yes") {
            if (!company_id) {
                return res.json({
                    status: false,
                    message: "Please select company from the list",
                });
            }
        }

        let refferal_code = this.randomString(8)

        let user = new User({
            name,
            email,
            mobile,
            otp: null,
            refferal_code,
            reffered_by,
            first_order: true,
        });

        if (company_id && company_id != "other") {
            user.company_id = ObjectId(company_id)
        }
        user.setPassword(password)
        await user.save();

        await welcomeMail({
            name: user.name,
            to_email: user.email,
            mobile: user.mobile,
          });
        if (user) {

            if(company_id == "other"){

                let company = new Company({
                    name : company_name,
                    email : company_email,
                    mobile : company_mobile,
                    user_id: user._id
                })
        
                let address = new Address({
                    address_line1 : company_address1,
                    address_line2 : company_address2,
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
            }
        


            req.session._id = user._id
            req.session.name = user.name
            req.session.image = user.profile_pic
            req.session.role = "user"
            let redirect_to_cart = 0
            if (typeof req.session.cart != 'undefined') {
                redirect_to_cart = 0
            }
            return res.json({
                status: true,
                message: "Login success, redirecting...",
                redirect_to_cart
            })
        } else {
            return res.json({
                status: false,
                message: "Sorry something went wrong"
            })
        }

    } catch (err) {
        console.log(err);
        return res.json({
            status: false,
            message: "Sorry something went wrong",
        });
    }
};

exports.forgotPassword = async (req, res) => {
    return res.render('web/forgot')
}

exports.sendForgotPassword = async (req, res) => {
    let { email } = req.body
    if (email) {
        let user = await User.findOne({ email: email })
        if (user) {
            user.token = uuidv4();
            await user.save()
            await forgotPassword({
                name: user.name,
                to_email: user.email,
                link: `${res.locals.app_url}/resetpassword?token=${user.token}`
            })
            return res.json({
                status: true,
                message: "Reset mail send to your mail id"
            })
        } else {
            return res.json({
                status: false,
                message: "No such email id exists"
            })
        }
    } else {
        return res.json({
            status: false,
            message: "Mail id is required"
        })
    }
}

exports.resetPassword = async (req, res) => {
    let { token } = req.query
    return res.render('web/resetpassword', { token })
}

exports.setResetPassword = async (req, res) => {
    let { password, confirm_password, token } = req.body

    if (!token) {
        return res.json({
            status: false,
            message: "Token expired"
        })
    }

    if (password != confirm_password) {
        return res.json({
            status: false,
            message: "Password and confirm password must be the same"
        })
    }

    let user = await User.findOne({ token: token })
    if (!user) {
        return res.json({
            status: false,
            message: "Token expired"
        })
    }

    user.setPassword(password)
    user.token = ""
    await user.save();

    if (user.validatePassword(password)) {
        req.session._id = user._id
        req.session.name = user.name
        req.session.image = user.profile_pic
        req.session.email = user.email
        req.session.mobile = user.mobile
        req.session.role = "user"
        return res.json({
            status: true,
            message: "Login success, redirecting...",
        })
    } else {
        return res.json({
            status: false,
            message: "Invalid user credentials"
        })
    }

}

exports.setOffice = async (req, res) => {
    let { office_id } = req.body
    if (!office_id) {
        return res.json({
            status: false,
            message: "Please select office"
        })
    }

    let user = await User.findOne({ _id: ObjectId(req.session._id) })
    if (user) {
        user.company_id = ObjectId(office_id)
        await user.save()
        return res.json({
            status: true,
            message: "Your current workplace set successfully"
        })
    } else {
        return res.json({
            status: false,
            message: "Something went wrong"
        })
    }
}
//generate admin cred
// admin = new Admin()
// admin.name = "Admin"
// admin.email = "admin@gmail.com"
// admin.setPassword('123456')
// await admin.save()