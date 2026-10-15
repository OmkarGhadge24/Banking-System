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
 * - Fund an account from the system
*/
router.post("/system/initial", authMiddleware.systemUserMiddleware, transactionController.createInitialSystemTransaction)


/** 
 * - Authenticated transaction history
 */
router.get("/history", authMiddleware.authMiddleware, transactionController.getTransactionHistory);

/** 
 * - Authenticated ledger entries
 */
router.get("/ledger", authMiddleware.authMiddleware, transactionController.getLedgerEntries);

module.exports = router;