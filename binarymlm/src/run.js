const { app } = require('./server');
const { mongoose } = require('./db')
const config = require('config')

async function run() {
    console.log(config.mongoURI);
    mongoose
        .connect(config.mongoURI, options)
         .then(() => {
             console.log("Connected to DB");
         })                             
         .catch(err => {
             console.log(err);
         })

    app.listen(3000, () => {
        console.log("Server started on http://localhost:3000");
    })
}
run();