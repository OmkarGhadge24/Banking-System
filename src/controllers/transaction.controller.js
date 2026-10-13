const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");

/**
 * Create a new customer transaction.
 *
 * Transfer flow:
 * 1. Validate request inputs.
 * 2. Validate account IDs, amount and idempotency key.
 * 3. Verify sender ownership and recipient existence.
 * 4. Check account currencies and statuses.
 * 5. Check sender balance.
 * 6. Create transaction and ledger entries.
 * 7. Commit the MongoDB transaction.
 * 8. Send transaction email.
 */

async function createTransaction(req, res) {
    const {
        debitAccount,
        creditAccount,
        amount,
        idempotencyKey
    } = req.body || {};

    // 1. Validate MongoDB ObjectId strings.
    const isValidAccountId = (id) => {
        return (
            typeof id === "string" &&
            /^[a-fA-F0-9]{24}$/.test(id)
        );
    };

    if (
        !isValidAccountId(debitAccount) ||
        !isValidAccountId(creditAccount)
    ) {
        return res.status(400).json({
            Message:
                "Debit account and Credit account must be valid account IDs"
        });
    }

    // 2. Prevent transfers to the same account.
    if (
        debitAccount.toLowerCase() ===
        creditAccount.toLowerCase()
    ) {
        return res.status(400).json({
            Message:
                "Debit account and Credit account must be different"
        });
    }

    // 3. Validate the monetary amount.
    if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(
            amount * 100 - Math.round(amount * 100)
        ) > 1e-8
    ) {
        return res.status(400).json({
            Message:
                "Amount must be a positive number with at most two decimal places"
        });
    }

    // 4. Validate and normalize the idempotency key.
    if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length === 0 ||
        idempotencyKey.length > 128
    ) {
        return res.status(400).json({
            Message:
                "Idempotency key must be a non-empty string of at most 128 characters"
        });
    }

    const normalizedIdempotencyKey =
        idempotencyKey.trim();

    // 5. Find the sender's account and verify ownership.
    const debitUserAccount = await accountModel.findOne({
        _id: debitAccount,
        user: req.user._id
    });

    // 6. Find the recipient's account.
    const creditUserAccount = await accountModel
        .findOne({
            _id: creditAccount
        })
        .populate("user", "name");

    // 7. Reject nonexistent or inaccessible accounts.
    if (!debitUserAccount || !creditUserAccount) {
        return res.status(400).json({
            Message:
                "Debit account or Credit account is invalid or unavailable"
        });
    }

    // Ensure the recipient has a valid owner.
    if (!creditUserAccount.user) {
        return res.status(400).json({
            Message: "Credit account owner is invalid"
        });
    }

    // 8. Require matching currencies.
    if (
        debitUserAccount.currency !==
        creditUserAccount.currency
    ) {
        return res.status(400).json({
            Message:
                "Debit account and Credit account must use the same currency"
        });
    }

    /*
     * 9. Check idempotency.
     *
     * Concurrent duplicate-request protection will be
     * addressed in Fix 8.
     */
    const isTransactionAlreadyExists =
        await transactionModel.findOne({
            idempotencyKey: normalizedIdempotencyKey
        });

    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "SUCCESS") {
            return res.status(200).json({
                Message: "Transaction already completed",
                Transaction: isTransactionAlreadyExists
            });
        }

        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                Message: "Transaction is still pending"
            });
        }

        if (isTransactionAlreadyExists.status === "FAILED") {
            return res.status(500).json({
                Message:
                    "Transaction failed, please try again"
            });
        }

        if (isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(500).json({
                Message:
                    "Transaction was reversed, please try again"
            });
        }
    }

    // 10. Both accounts must be active.
    if (
        debitUserAccount.status !== "ACTIVE" ||
        creditUserAccount.status !== "ACTIVE"
    ) {
        return res.status(400).json({
            Message:
                "Debit account and Credit account must be ACTIVE"
        });
    }

    // 11. Derive the sender's balance from the ledger.
    const balance = await debitUserAccount.getBalance();

    if (balance < amount) {
        return res.status(400).json({
            Message:
                `Insufficient balance. Current balance is ${balance}`
        });
    }

    /*
     * 12. Create the transaction and ledger entries.
     *
     * Session cleanup and concurrency improvements are
     * reserved for their respective roadmap fixes.
     */
    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        debitAccount,
        creditAccount,
        amount,
        idempotencyKey: normalizedIdempotencyKey,
        status: "PENDING"
    });

    await transaction.save({ session });

    // Record the debit.
    await ledgerModel.create(
        [
            {
                account: debitAccount,
                type: "DEBIT",
                amount,
                transaction: transaction._id
            }
        ],
        { session }
    );

    // Record the credit.
    await ledgerModel.create(
        [
            {
                account: creditAccount,
                type: "CREDIT",
                amount,
                transaction: transaction._id
            }
        ],
        { session }
    );

    // Mark the transaction successful within the session.
    transaction.status = "SUCCESS";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 13. Send the transaction email.
    await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        creditAccount,
        creditUserAccount.user.name
    );

    return res.status(200).json({
        Message: "Transaction completed successfully",
        Transaction: transaction
    });
}

/**
 * Create an initial system-funding transaction.
 *
 * This operation must be accessible only through
 * systemUserMiddleware in transaction.routes.js.
 *
 * It credits an eligible customer account from the
 * authenticated system user's funding operation.
 */
async function createInitialSystemTransaction(req, res) {
    const {
        creditAccount,
        amount,
        idempotencyKey
    } = req.body || {};

    // 1. Validate the recipient account ID.
    if (
        typeof creditAccount !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(creditAccount)
    ) {
        return res.status(400).json({
            Message: "Credit account must be a valid account ID"
        });
    }

    // 2. Validate the amount.
    if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(
            amount * 100 - Math.round(amount * 100)
        ) > 1e-8
    ) {
        return res.status(400).json({
            Message:
                "Amount must be a positive number with at most two decimal places"
        });
    }

    // 3. Validate and normalize the idempotency key.
    if (
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length === 0 ||
        idempotencyKey.length > 128
    ) {
        return res.status(400).json({
            Message:
                "Idempotency key must be a non-empty string of at most 128 characters"
        });
    }

    const normalizedIdempotencyKey =
        idempotencyKey.trim();

    // 4. Find the recipient account and load its owner.
    const creditUserAccountExist = await accountModel
        .findById(creditAccount)
        .populate({
            path: "user",
            select: "name +systemUser"
        });

    if (
        !creditUserAccountExist ||
        !creditUserAccountExist.user
    ) {
        return res.status(400).json({
            Message:
                "Credit account or account owner is invalid"
        });
    }

    // 5. Only active customer accounts may receive initial funding.
    if (creditUserAccountExist.status !== "ACTIVE") {
        return res.status(400).json({
            Message:
                "Initial funding requires an ACTIVE customer account"
        });
    }

    // 6. Prevent initial funding into a system user's account.
    if (creditUserAccountExist.user.systemUser === true) {
        return res.status(400).json({
            Message:
                "Initial funding is available only for customer accounts"
        });
    }

    /*
     * 7. Check idempotency.
     *
     * Concurrent duplicate-request protection is reserved
     * for Fix 8.
     */
    const isTransactionAlreadyExists =
        await transactionModel.findOne({
            idempotencyKey: normalizedIdempotencyKey
        });

    if (isTransactionAlreadyExists) {
        if (isTransactionAlreadyExists.status === "SUCCESS") {
            return res.status(200).json({
                Message: "Transaction already completed",
                Transaction: isTransactionAlreadyExists
            });
        }

        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                Message: "Transaction is still pending"
            });
        }

        return res.status(500).json({
            Message:
                `Transaction is ${isTransactionAlreadyExists.status.toLowerCase()}, please try again`
        });
    }

    // 8. Find the authenticated system user's account.
    const debitUserAccount = await accountModel.findOne({
        user: req.user._id
    });

    if (!debitUserAccount) {
        return res.status(400).json({
            Message: "System user account not found"
        });
    }

    /*
     * 9. Record the initial funding transaction.
     *
     * Initial funding records a credit for the recipient.
     * Session lifecycle hardening is reserved for Fix 6.
     */
    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        debitAccount: debitUserAccount._id,
        creditAccount: creditUserAccountExist._id,
        amount,
        idempotencyKey: normalizedIdempotencyKey,
        status: "PENDING"
    });

    await transaction.save({ session });

    await ledgerModel.create(
        [
            {
                account: creditUserAccountExist._id,
                type: "CREDIT",
                amount,
                transaction: transaction._id
            }
        ],
        { session }
    );

    transaction.status = "SUCCESS";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
        Message:
            "Initial system transaction completed successfully",
        Transaction: transaction
    });
}

module.exports = { createTransaction, createInitialSystemTransaction };