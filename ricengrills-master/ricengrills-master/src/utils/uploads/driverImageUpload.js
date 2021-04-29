const multer = require("multer");
var mkdirp = require('mkdirp');
const pify = require("pify");
const path = require("path");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        mkdirp.sync("public/files/drivers/profile_image");
        cb(null, "public/files/drivers/profile_image");
    },
    filename: (req, file, cb) => {
        var ext = path.extname(file.originalname);
        if (ext.match(/\.(jpg|jpeg|png)$/i)) {
            //console.log(ext);
            var filename = "driver_profile_image" + "-" + Date.now() + ext;
            cb(null, filename);
        } else {
            console.log(ext + ' is not allowed');
        }
    },
    limits: (req, file, cb) => {
        files = 2; // allow only 1 file per request
        fileSize = 1024 * 1024 * 2; // 2 MB (max file size)
    },
});
let upload = pify(multer({ storage: storage }).fields([
    { name: "image" },
]));
module.exports = upload;