require('dotenv').config();

const app = require('./src/app');
const connectToDB = require('./src/config/db')

connectToDB()

app.listen(3000,()=>{
    console.log("Server is running at port 3000");
})