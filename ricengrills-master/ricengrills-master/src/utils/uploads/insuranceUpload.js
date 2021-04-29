const multer = require("multer");
var mkdirp = require('mkdirp');
const pify = require("pify");
const path = require("path");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        mkdirp.sync("public/files/vehicles/insurance" + req.session._id);
        cb(null, "public/files/vehicles/insurance" + req.session._id);
    },
    filename: (req, file, cb) => {
        var ext = path.extname(file.originalname);
        if (ext.match(/\.(jpg|jpeg|png)$/i)) {
            //console.log(ext);
            var filename = "avatarThumb" + "-" + Date.now() + ext;
            cb(null, filename);
        } else {
            console.log(ext + ' is not allowed');
        }
    },
    limits: (req, file, cb) => {
        files = 1; // allow only 1 file per request
        fileSize = 1024 * 1024; // 1 MB (max file size)
    },
});
let upload = pify(multer({ storage: storage }).fields([{ name: "insurance" }]));
module.exports = upload;