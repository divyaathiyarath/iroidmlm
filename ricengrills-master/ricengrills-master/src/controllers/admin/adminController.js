const mongoose = require('mongoose')
const paginate = require("express-paginate")

const uploadProfilePic = require('../../utils/uploads/profilepic')
const { validateNewAdminInputs } = require('../../validators/adminValidator')
const { response } = require('express')

const Admin = mongoose.model('admins')

exports.checkMailExists = async(email, id) => {
    let where = {
        email,
        delete_status: false,
    }
    if(id != null) {
        where._id = {
            $ne: id
        }
    }
    return await Admin.countDocuments(where)
}

exports.checkMobileExists = async(mobile, id) => {
    let where = {
        mobile,
        delete_status: false,
    }
    if(id != null) {
        where._id = {
            $ne: id
        }
    }
    return await Admin.countDocuments(where)
}

exports.adminLists = async(req, res) => {
    let { search, limit, skip, page } = req.query
    var query = {}
    if(search) {
        let regex = { $regex: new RegExp(".*" + search.trim() + ".*", 'i') }
        query = {
            $or: [
                { name: regex },
                { email: search },
                { mobile: search }
            ]
        }
    }
    query.delete_status = false
    query.role = 'ADMIN'
    const [ admins, itemCount ] = await Promise.all([
        Admin.find(query, {
            hash: 0,
            salt: 0,
            otp: 0,
            is_admin: 0,
            token: 0,
            token_expiry: 0,
            updated_at: 0,
            deleted_at: 0,
        }).sort({
            _id: -1
        }).limit(limit)
        .skip(skip)
        .lean()
        .exec(),
        Admin.countDocuments(query)
    ])
    const pageCount = Math.ceil(itemCount / limit)
    let data = {
        search,
        admins,
        itemCount,
        pageCount,
        pages: paginate.getArrayPages(req)(5, pageCount, page),
        activePage: page
    }
    return res.render('admin/admins/list', data)
}

exports.newAdmin = async(req, res) => {
    return res.render('admin/admins/new')
}

exports.save = async(req, res) => {
    const { newAdminCreatedMail } = require('../../utils/emails/admin/new_admin')
    try {
        await uploadProfilePic(req, res)
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Could not upload file'
        })
    }

    const { errors, isValid } = validateNewAdminInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }
    try {
        let { name, email, mobile } = req.body
        let { profilepic } = req.files
        if(await this.checkMailExists(email, null)) {
            return res.json({
                status: false,
                message: 'Email already exists'
            })
        }
        if(mobile != '') {
            if(await this.checkMobileExists(mobile, null)) {
                return res.json({
                    status: false,
                    message: 'Mobile number already exists'
                })
            }
        }
        let image = null
        if(profilepic)
            image = "/" + profilepic[0].path || null
        else
            image = null
        let password = Math.random().toString(36).substr(2)
        admin = new Admin({
            name,
            email,
            mobile,
            image
        })
        admin.setPassword(password)
        await admin.save()
        await newAdminCreatedMail({
            name,
            email,
            password
        })
        return res.json({
            status: true,
            message: 'New admin has been created'
        })
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.delete = async(req, res) => {
    try {
        let { id } = req.body
        let admin = await Admin.updateOne({
            _id: id
        }, {
            $set: {
                delete_status: true
            }
        })
        if(admin) {
            return res.json({
                status: true,
                message: 'Admin has been deleted'
            })
        } else {
            return res.json({
                status: false,
                message: 'Sorry something went wrong'
            })
        }
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.editAdmin = async(req, res) => {
    try {
        let { id } = req.params
        let admin = await Admin.findOne({
            _id: id
        })
        let data = {
            admin
        }
        return res.render('admin/admins/edit', data)
    } catch(err) {
        console.log(err)
    }
}

exports.updateAdmin = async(req, res) => {
    try {
        await uploadProfilePic(req, res)
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Could not upload file'
        })
    }

    const { errors, isValid } = validateNewAdminInputs(req.body)
    if (!isValid) {
        return res.json({ status: false, errors })
    }
    try {
        let { id, name, email, mobile } = req.body
        let { profilepic } = req.files

        let admin = await Admin.findOne({
            _id: id
        })
        if(!admin) {
            return res.json({
                status: false,
                message: 'User not found'
            })
        }
        if(await this.checkMailExists(email, id)) {
            return res.json({
                status: false,
                message: 'Email already exists'
            })
        }
        if(mobile != '') {
            if(await this.checkMobileExists(mobile, id)) {
                return res.json({
                    status: false,
                    message: 'Mobile number already exists'
                })
            }
        }
        let image = admin.image
        if(profilepic)
            image = "/" + profilepic[0].path || null
        else
            image = admin.image
        admin.name = name
        admin.email = email
        admin.mobile = mobile
        admin.image = image
        if(await admin.save()) {
            return res.json({
                status: true,
                message: 'Admin details has been updated'
            })
        } else {
            return res.json({
                status: false,
                message: 'Sorry something went wrong'
            })
        }
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        })
    }
}

exports.resetPassword = async(req, res) => {
    const { adminPasswordUpdatedMail } = require('../../utils/emails/admin/password_updated')
    try {
        let { id } = req.body
        let password = Math.random().toString(36).substr(2)
        let admin = await Admin.findOne({
            _id: id
        })
        admin.setPassword(password)
        await admin.save()
        await adminPasswordUpdatedMail({
            name: admin.name,
            email: admin.email,
            password
        })
        return res.json({
            status: true,
            message: 'New password has been e-mailed to users mail address'
        })
    } catch(err) {
        console.log(err)
        return res.json({
            status: false,
            message: 'Sorry something went wrong'
        }) 
    }
}