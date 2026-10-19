const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken')
const emailService = require('../services/email.service');
const tokenBlackListModel = require('../models/blackList.model');

function getCurrentUserController(req, res) {
    return res.status(200).json({
        user: {
            _id: req.user._id,
            email: req.user.email,
            name: req.user.name,
            systemUser: req.user.systemUser === true
        }
    });
}

/**
 * - User register controller
 * - POST /api/auth/register
*/
async function userRegisterController(req, res) {
    const { email, password, name } = req.body;
    const isExist = await userModel.findOne({ email: email });

    if (isExist) {
        return res.status(422).json({
            Message: "User already exist with this email",
            Status: "Failed"
        })
    }

    const user = await userModel.create({
        email,
        password,
        name
    })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })
    res.cookie("token", token);
    res.status(201).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            systemUser: false
        },
        token
    })

    await emailService.sendRegistrationEmail(user.email, user.name)
}

/**
 * User login controller
 * POST /api/auth/login
 */
async function userLoginController(req, res) {
    const { email, password } = req.body;

    // Step 1: Validate the required input.
    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            Message: "Email and password are required"
        });
    }

    // Step 2: Normalize the email address.
    const normalizedEmail = email.trim().toLowerCase();

    // Step 3: Find the user and explicitly retrieve the password hash.
    const user = await userModel
        .findOne({ email: normalizedEmail })
        .select("+password +systemUser");

    // Step 4: Reject an email address that does not exist.
    if (!user) {
        return res.status(401).json({
            Message: "Email or password is invalid"
        });
    }

    // Step 5: Wait for bcrypt to compare the passwords.
    const isValidPassword = await user.comparePassword(password);

    // Step 6: Reject an incorrect password.
    if (!isValidPassword) {
        return res.status(401).json({
            Message: "Email or password is invalid"
        });
    }

    // Step 7: Create a JWT only after successful verification.
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "3d" }
    );

    // Step 8: Preserve your existing response structure.
    res.cookie("token", token);

    return res.status(200).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            systemUser: user.systemUser === true
        },
        token
    });
}

/**
 * - User logout controller
 * - POST /api/auth/logout
*/
async function userLogoutController(req, res) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(400).json({
            Message: "User logged out successfully"
        })
    }

    await tokenBlackListModel.create({
        token : token
    });

    res.clearCookie("token");

    res.status(200).json({
        Message : "User logout successfully"
    })
}

module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController,
    getCurrentUserController
};