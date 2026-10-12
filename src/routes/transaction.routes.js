const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const transactionController = require('../controllers/transaction.controller');

const router = express.Router();

/** 
 * - POST /api/transactions/
 * - Create new transaction
*/
router.post("/", authMiddleware.authMiddleware, transactionController.createTransaction);

/**
 * - POST /api/transactions/system/initial
 * - Inital amount to system account
*/
router.post("/system/initial", authMiddleware.systemUserMiddleware, transactionController.createInitialSystemTransaction)

module.exports = router;