const transactionModel = require('../models/transaction.model');
const ledgerModel = require("../models/ledger.model");
const emailService = require('../services/email.service');
const accountModel = require("../models/account.model");
const mongoose = require('mongoose');

/**
 * Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
    * 1. Validate request
    * 2. Validate idempotency key
    * 3. Check account status
    * 4. Derive sender balance from ledger
    * 5. Create transaction (PENDING)
    * 6. Create DEBIT ledger entry
    * 7. Create CREDIT ledger entry
    * 8. Mark transaction COMPLETED
    * 9. Commit MongoDB session
    * 10. Send email notification
 */

async function createTransaction(req, res) {
    /**
     * 1. Validate request
     */
    const { debitAccount, creditAccount, amount, idempotencyKey } = req.body;

    if (!debitAccount || !creditAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            Message: "Debit account, Credit account, Amount and Idempotency key are required"
        })
    }

    const debitUserAccount = await accountModel.findOne({ _id: debitAccount });
    const creditUserAccount = await accountModel.findOne({ _id: creditAccount }).populate('user', 'name');

    if (!debitUserAccount || !creditUserAccount) {
        return res.status(400).json({
            Message: "Debit account, Credit account are Invalid"
        })
    }

    /**
     * 2. Validate idempotency key
     */

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    })

    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "SUCCESS") {
            return res.status(200).json({
                Message: "Transaction already completed",
                Transaction: isTransactionAlreadyExists
            })
        }
        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                Message: "Transaction is still pending",
            })
        }
        if (isTransactionAlreadyExists.status === "FAILED") {
            return res.status(500).json({
                Message: "Transaction is failed, please try again",
            })
        }
        if (isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(500).json({
                Message: "Transaction is reversed, please try again",
            })
        }
    }

    /**
     * 3. Check account status
     */

    if (debitUserAccount.status !== "ACTIVE" || creditUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            Message: "Debit account and Credit account must be ACTIVE"
        })
    }

    /**
     * 4. Derive sender balance from ledger
     */

    const balance = await debitUserAccount.getBalance();

    if (balance < amount) {
        return res.status(400).json({
            Message: `Insufficient balance. Current balance is ${balance}`
        })
    }

    /**
     * 5. Create transaction (PENDING)
     * 6. Create DEBIT ledger entry
     * 7. Create CREDIT ledger entry
     * 8. Mark transaction COMPLETED
     * 9. Commit MongoDB session
     */

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        debitAccount,
        creditAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    });

    const debitLedgerEntry = await ledgerModel.create([{
        account: debitAccount,
        type: "DEBIT",
        amount: amount,
        transaction: transaction._id
    }], { session });

    const creditLedgerEntry = await ledgerModel.create([{
        account: creditAccount,
        type: "CREDIT",
        amount: amount,
        transaction: transaction._id
    }], { session });

    transaction.status = "SUCCESS";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    /**
     * 10. Send email notification
     */

    await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, creditAccount, creditUserAccount.user.name );

    return res.status(200).json({
        Message: "Transaction completed successfully",
        Transaction: transaction
    })
}

async function createInitialSystemTransaction(req, res) {
    const { creditAccount, amount, idempotencyKey } = req.body;

    if (!creditAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            Message: "Credit account, Amount and Idempotency key are required"
        })
    }

    const creditUserAccountExist = await accountModel.findOne({ _id: creditAccount });
    if (!creditUserAccountExist) {
        return res.status(400).json({
            Message: "Credit account are Invalid"
        })
    }

    const debitUserAccount = await accountModel.findOne({
        user: req.user._id
    });

    if(!debitUserAccount){
        return res.status(400).json({
            Message: "System user account not found"
        })
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        debitAccount : debitUserAccount._id,
        creditAccount,
        amount,
        idempotencyKey,
        status: "PENDING"
    });

    const debitLedgerEntry = await ledgerModel.create([{
        account: debitUserAccount._id,
        type: "DEBIT",
        amount: amount,
        transaction: transaction._id
    }], { session });

    const creditLedgerEntry = await ledgerModel.create([{
        account: creditAccount,
        type: "CREDIT",
        amount: amount,
        transaction: transaction._id
    }], { session });

    transaction.status = "SUCCESS";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
        Message: "Initial system transaction completed successfully",
        Transaction: transaction
    })
}

module.exports = { createTransaction, createInitialSystemTransaction };