const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");

function isTransactionUnsupportedError(error) {
    const message = String(error?.message || "").toLowerCase();

    return (
        error?.code === 20 ||
        message.includes("transaction numbers are only allowed") ||
        message.includes("transactions are not supported") ||
        message.includes("does not support transactions") ||
        message.includes("replica set member or mongos")
    );
}

function getFundingFailureCode(error) {
    if (isTransactionUnsupportedError(error)) {
        return "MONGODB_TRANSACTIONS_UNAVAILABLE";
    }

    if (error?.code === 11000) {
        return "DUPLICATE_IDEMPOTENCY_KEY";
    }

    if (error?.name === "ValidationError") {
        return "TRANSACTION_VALIDATION_FAILED";
    }

    if (typeof error?.code === "number") {
        return `MONGODB_${error.code}`;
    }

    if (typeof error?.name === "string") {
        return error.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    }

    return "UNKNOWN";
}

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
        .populate({
            path: "user",
            select: "name +systemUser"
        });

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

    if (creditUserAccount.user.systemUser === true) {
        return res.status(400).json({
            Message: "Transfers to system-user accounts are not allowed"
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
    let transaction;

    try {
        session.startTransaction();

        transaction = new transactionModel({
            debitAccount,
            creditAccount,
            amount,
            idempotencyKey: normalizedIdempotencyKey,
            status: "PENDING"
        });

        await transaction.save({ session });

        await ledgerModel.create(
            [
                {
                    account: debitAccount,
                    type: "DEBIT",
                    amount,
                    transaction: transaction._id
                },
                {
                    account: creditAccount,
                    type: "CREDIT",
                    amount,
                    transaction: transaction._id
                }
            ],
            { session, ordered: true }
        );

        transaction.status = "SUCCESS";
        await transaction.save({ session });
        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("Transfer transaction failed:", error);
        return res.status(500).json({
            Message: "Unable to complete the transfer. No funds were moved."
        });
    } finally {
        await session.endSession();
    }

    // Email delivery must not delay confirmation of a committed transfer.
    emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        creditAccount,
        creditUserAccount.user.name
    ).catch((error) => {
        console.error("Transfer confirmation email failed:", error);
    });

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
    let transaction;

    try {
        session.startTransaction();

        transaction = new transactionModel({
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
                    account: debitUserAccount._id,
                    type: "DEBIT",
                    amount,
                    transaction: transaction._id
                },
                {
                    account: creditUserAccountExist._id,
                    type: "CREDIT",
                    amount,
                    transaction: transaction._id
                }
            ],
            { session, ordered: true }
        );

        transaction.status = "SUCCESS";
        await transaction.save({ session });
        await session.commitTransaction();
    } catch (error) {
        if (session.inTransaction()) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error(
                    "Initial funding transaction rollback failed:",
                    abortError
                );
            }
        }

        console.error("Initial funding transaction failed:", error);
        if (isTransactionUnsupportedError(error)) {
            return res.status(503).json({
                Code: "MONGODB_TRANSACTIONS_UNAVAILABLE",
                Message:
                    "MongoDB transactions are not supported by the configured database. Configure MongoDB as a replica set or use MongoDB Atlas, then restart the backend."
            });
        }

        const failureCode = getFundingFailureCode(error);
        const statusCode = error?.code === 11000 ? 409 : 500;

        return res.status(statusCode).json({
            Code: failureCode,
            Message:
                `Unable to complete initial funding (${failureCode}). No funds were moved. Check the backend logs for the matching transaction error.`
        });
    } finally {
        await session.endSession();
    }

    return res.status(200).json({
        Message:
            "Initial system transaction completed successfully",
        Transaction: transaction
    });
}

async function getTransactionHistory(req, res) {
    try {
        const accounts = await accountModel
            .find({ user: req.user._id })
            .select("_id currency");

        const accountIds = accounts.map((account) => account._id);

        const transactions = await transactionModel
            .find({
                $or: [
                    { debitAccount: { $in: accountIds } },
                    { creditAccount: { $in: accountIds } }
                ]
            })
            .populate("debitAccount", "_id currency status")
            .populate("creditAccount", "_id currency status")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({ transactions });
    } catch (error) {
        console.error("Transaction history error:", error);

        return res.status(500).json({
            Message: "Unable to retrieve transaction history"
        });
    }
}

async function getLedgerEntries(req, res) {
    try {
        const accounts = await accountModel
            .find({ user: req.user._id })
            .select("_id currency");

        const accountIds = accounts.map((account) => account._id);

        const entries = await ledgerModel
            .find({ account: { $in: accountIds } })
            .populate("account", "_id currency status")
            .populate("transaction", "status amount createdAt debitAccount creditAccount")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return res.status(200).json({ entries });
    } catch (error) {
        console.error("Ledger entries error:", error);

        return res.status(500).json({
            Message: "Unable to retrieve ledger entries"
        });
    }
}

async function getSystemCustomerAccounts(req, res) {
    try {
        const accounts = await accountModel
            .find({ user: { $ne: req.user._id } })
            .populate({
                path: "user",
                match: { systemUser: false },
                select: "name"
            })
            .select("_id currency status user createdAt")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            accounts: accounts.filter((account) => account.user)
        });
    } catch (error) {
        console.error("System customer account lookup failed:", error);
        return res.status(500).json({
            Message: "Unable to retrieve customer accounts"
        });
    }
}

async function getSystemLedgerEntries(req, res) {
    try {
        const systemAccounts = await accountModel
            .find({ user: req.user._id })
            .select("_id");
        const accountIds = systemAccounts.map((account) => account._id);
        const transactions = await transactionModel
            .find({ debitAccount: { $in: accountIds } })
            .select("_id")
            .lean();
        const transactionIds = transactions.map(
            (transaction) => transaction._id
        );

        const entries = await ledgerModel
            .find({ transaction: { $in: transactionIds } })
            .populate("account", "_id currency status")
            .populate(
                "transaction",
                "status amount createdAt debitAccount creditAccount"
            )
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        return res.status(200).json({ entries });
    } catch (error) {
        console.error("System ledger lookup failed:", error);
        return res.status(500).json({
            Message: "Unable to retrieve system funding ledger"
        });
    }
}

module.exports = {
    createTransaction,
    createInitialSystemTransaction,
    getTransactionHistory,
    getLedgerEntries,
    getSystemCustomerAccounts,
    getSystemLedgerEntries
};
