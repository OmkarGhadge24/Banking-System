const express = require('express');
const authController = require('../controllers/auth.controller');
const { sessionAuthMiddleware } = require('../middlewares/auth.middleware');

const router = express.Router();

/** POST /api/auth/register */
router.post("/register",authController.userRegisterController);

/** POST /api/auth/login */
router.post("/login", authController.userLoginController);

/** POST /api/auth/logout */
router.post("/logout", authController.userLogoutController);

/** GET /api/auth/me */
router.get("/me", sessionAuthMiddleware, authController.getCurrentUserController);

module.exports = router;