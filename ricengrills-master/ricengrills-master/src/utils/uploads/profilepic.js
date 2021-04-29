const multer = require("multer");
const pify = require("pify");
const path = require("path");
var mkdirp = require('mkdirp')
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    mkdirp.sync("public/files/admin/profile_pic" + req.session._id);
    cb(null, "public/files/admin/profile_pic" + req.session._id);
  },
  filename: (req, file, cb) => {
    var ext = path.extname(file.originalname);
    var filename = file.fieldname + "-" + Date.now() + ext;
    cb(null, filename);
  }
});
let upload = pify(multer({ storage: storage }).fields([{ name: "profilepic" }]));
module.exports = upload;