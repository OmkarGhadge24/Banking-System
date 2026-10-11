const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();

/**
 * - Routes required
*/
const authRouter = require('./routes/auth.routes');
const accountRouter = require('./routes/account.routes');

app.use(express.json());
app.use(cookieParser());

/**
 * - Use routes
*/
app.use("/api/auth", authRouter);
app.use("/api/accounts", accountRouter);

module.exports = app;