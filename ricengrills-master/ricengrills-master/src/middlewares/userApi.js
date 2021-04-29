const userApi = async (req, res, next) => {
    let mongoose = require('mongoose')
    let Setting = mongoose.model('settings')
    let setting = await Setting.findOne()

    let { android_version: db_android_version, ios_version: db_ios_version } = setting
    let { 'x-iosversion': ios_version, 'x-androidversion': android_version } = req.headers
    try {
        let ios = 0
        let android = 0
        if (ios_version) {

            ios = parseFloat(ios_version)
            if (ios < db_ios_version) {
                return res.json({
                    status: false,
                    message: "Your application is outdated, Please update to continue",
                    db_android_version,
                    db_ios_version,
                    headers:req.headers
                })
            }
            next()

        } else if (android_version) {   
            android = parseFloat(android_version)              
            if (android < db_android_version) {
                return res.json({
                    status: false,
                    message: "Your application is outdated, Please update to continue",
                    db_android_version,
                    db_ios_version,
                    headers:req.headers
                })
            }
            next()
        } else if (!android_version && !ios_version) {              
            return res.json({
                status: false,
                message: "Your application is outdated, Please update to continue",
                db_android_version,
                db_ios_version,
                headers:req.headers
            })
        }else{
            next()
        }
    } catch (err) {
        console.log(err)
        return res.json({
            status: false,
            message: "Your application is outdated, Please update to continue",
            db_android_version,
            db_ios_version,
            headers:req.headers
        })
    }

}

module.exports = userApi