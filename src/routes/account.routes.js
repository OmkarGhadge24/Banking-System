const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const accountController = require('../controllers/account.controller');

const router = express.Router();

/** 
 * - POST /api/accounts/
 * - Create new account
 * - Protected route
*/
router.post("/", authMiddleware.authMiddleware, accountController.createAccountController);

/** 
 * - GET /api/accounts/
 * - Get all accounts of logged-in users
 * - Protected route
*/
router.get("/", authMiddleware.authMiddleware, accountController.getAllUserAccountsController);

/** 
 * - GET /api/accounts/balance/:accountId
 * - Get balance of a specific account
*/
router.get("/balance/:accountId", authMiddleware.authMiddleware, accountController.getAccountBalanceController);

module.exports = router;