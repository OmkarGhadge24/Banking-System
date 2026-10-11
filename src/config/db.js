const mongoose = require('mongoose');

function connectToDB(){
    mongoose.connect(process.env.MONGO_URI)
    .then(()=>{
        console.log("Connected to Database");
    })
    .catch( err => {
        console.log("Error connecting to Database", err);
        process.exit(1);
    })
}

module.exports = connectToDB;