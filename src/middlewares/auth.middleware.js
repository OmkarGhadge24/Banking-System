const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');


async function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authMiddleware.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            Message: "Unauthorized access"
        })
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);
        req.user = user;
        return next()
    }
    catch (err) {
        return res.status(401).json({
            Message: "Unauthorized access, token is invalid"
        })
    }
}

module.exports = { authMiddleware };