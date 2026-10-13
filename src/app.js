const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

app.get("/", (req, res) => {
    res.send("Services are running")
})

/**
 * - Routes required
*/
const authRouter = require('./routes/auth.routes');
const accountRouter = require('./routes/account.routes');
const transactionRouter = require('./routes/transaction.routes');

app.use(express.json());
app.use(cookieParser());

/**
 * - Use routes
*/
app.use("/api/auth", authRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/transactions", transactionRouter);

module.exports = app;