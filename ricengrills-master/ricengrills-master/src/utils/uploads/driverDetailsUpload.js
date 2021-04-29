const multer = require("multer");
var mkdirp = require('mkdirp');
const pify = require("pify");
const path = require("path");
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if(file.fieldname == 'insurance') {
            mkdirp.sync("public/files/vehicles/insurance" + req.payload._id);
            cb(null, "public/files/vehicles/insurance" + req.payload._id);
        }
        mkdirp.sync("public/files/drivers/driver" + req.payload._id);
        cb(null, "public/files/drivers/driver" + req.payload._id);
    },
    filename: (req, file, cb) => {
        var ext = path.extname(file.originalname);
        if (ext.match(/\.(jpg|jpeg|png|pdf|doc|docx)$/i)) {
            //console.log(ext);
            var filename = "driver" + "-" + Date.now() + ext;
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
    { name: "police_clearance" },
    { name: "license" },
    { name: "insurance" },
]));
module.exports = upload;