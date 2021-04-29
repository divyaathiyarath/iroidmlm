const isAuth = (req, res, next) => {
    res.header("Cache-Control", "private, no-cache, no-store, must-revalidate")
    res.header("Expires", "-1")
    res.header("Pragma", "no-cache")
    let session = req.session
    res.locals.session = session

    // let url = req.originalUrl
    // let uri_segments = url.split('/')
    // let group = uri_segments[1]
    if (session && session._id && session.role == 'admin') {
        next()
    } else {
        return res.redirect(res.locals.app_url)
    }
}

module.exports = isAuth