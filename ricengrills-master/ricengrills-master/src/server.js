const express = require('express')
const path = require('path')
const session = require('express-session')
let vhost = require('vhost')
const app = express()
require('../src/models')
const admin_routes = require('./routes/admin')
const web_routes = require('./routes/site')
const api_routes = require('./routes/api')
const cp_routes = require('./routes/cp')
const driver_routes = require('./routes/driver-panel')
const routes = require('./routes')
const moment = require('moment')
const paginate = require('express-paginate')

const redis = require('redis')
let RedisStore = require('connect-redis')(session)
let redisClient = redis.createClient()


app.use(express.static(path.join(__dirname + '../public')))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use("/public", express.static("public"))
app.use("/",express.static("public/js"))
app.set('view engine', 'ejs')

app.use(
    [session({
        store: new RedisStore({ client: redisClient }),
        secret: "rIcEnGrILLs",
        resave: true,
        saveUninitialized: false
    }), (req, res, next) => {
        res.locals.moment = moment
        next()
    }, paginate.middleware(20, 50)]
);

app.use(vhost('www.ricengrills.com.au', web_routes))
app.use(vhost('ricengrills.com.au', web_routes))
app.use(vhost('admin.ricengrills.com.au', admin_routes))
app.use(vhost('driver.ricengrills.com.au', driver_routes))
app.use(vhost('cp.ricengrills.com.au', cp_routes))
app.use(vhost('api.ricengrills.com.au', api_routes))

//test server
app.use(vhost('www.rngtesting.live', web_routes))
app.use(vhost('rngtesting.live', web_routes))
app.use(vhost('admin.rngtesting.live', admin_routes))
app.use(vhost('driver.rngtesting.live', driver_routes))
app.use(vhost('cp.rngtesting.live', cp_routes))
app.use(vhost('api.rngtesting.live', api_routes))

app.use(vhost('localhost', routes))
app.use(vhost('3.25.120.209', routes))
module.exports = {
    app
}