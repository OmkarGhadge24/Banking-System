const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    debitAccount: {
        type: mongoose.Schema.ObjectId,
        ref: "account",
        required: [true, "Transaction must be associate with Debit account"],
        index: true
    },
    creditAccount: {
        type: mongoose.Schema.ObjectId,
        ref: "account",
        required: [true, "Transaction must be associate with Credit account"],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ["PENDING", "SUCCESS", "FAILED", "REVERSED"],
            message: "Status must be either PENDING, SUCCESS, FAILED or REVERSED"
        },
        default: "PENDING",
    },
    amount: {
        type: Number,
        required: [true, "Transaction amount is required"],
        min: [0, "Transaction amount should not be negative"],
    },
    idempotencyKey: {
        type: String,
        required: [true, "Transaction idempotencyKey is required"],
        index: true,
        unique: true,
    }
}, {
    timestamps: true
});

const transactionModel = mongoose.model("transaction",transactionSchema);

module.exports = transactionModel;