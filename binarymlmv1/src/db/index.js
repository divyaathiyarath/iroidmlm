const mongoose = require('mongoose');

options = {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
}

mongoose.set("debug", true);

module.exports = {
    mongoose
}
