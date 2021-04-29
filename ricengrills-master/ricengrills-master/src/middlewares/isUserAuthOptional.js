const isAuth = async (req, res, next) => {
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate")
    res.header("Expires", "-1")
    res.header("Pragma", "no-cache")
    let session = req.session
    res.locals.session = session
    if (session && session._id && session.role == 'user') {
        const mongoose = require('mongoose')
        let ObjectId = mongoose.Types.ObjectId;
        const User = mongoose.model('users')
        const Address = mongoose.model('addresses')
        let user = await User.findOne({ _id: ObjectId(req.session._id) })
        let has_address = await Address.find({ user_id: ObjectId(user._id),  delete_status: false }).countDocuments()
        if (!has_address && req.path != "/addresses" && req.path != "/logout" && req.path != "/address" ) {
            return res.redirect(res.locals.app_url + "/addresses")
        }
        let food_credits = 0
        if (typeof user.credits != "undefined" && user.credits) {
            let { food } = user.credits
            if (typeof food != 'undefined' && food) {
                food_credits = food
            }
        }
        res.locals.food_credits = food_credits
    }
    next()
}
module.exports = isAuth