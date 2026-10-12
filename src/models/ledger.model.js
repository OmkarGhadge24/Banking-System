const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.ObjectId,
        ref: "account",
        required: [true, "Ledger must be associate with account"],
        index: true,
        immutable: true,
    },
    amount: {
        type: Number,
        required: [true, "Amount is required for creating ledger entry"],
        immutable: true,
    },
    transaction: {
        type: mongoose.Schema.ObjectId,
        ref: "transaction",
        required: [true, "Ledger must be associate with transaction"],
        index: true,
        immutable: true,
    },
    type: {
        type: String,
        enum: {
            values: ["DEBIT", "CREDIT"],
            message: "Ledger type must be either DEBIT or CREDIT"
        },
        required: [true, "Ledger type is required"],
        immutable: true,
    }
}, {
    timestamps: true
});

ledgerSchema.pre("save", function () {
    if (!this.isNew) {
        throw new Error("Ledger entries cannot be updated");
    }
});

const blockedOperations = [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
    "remove"
];

for (const operation of blockedOperations) {
    ledgerSchema.pre(operation, function () {
        throw new Error("Ledger entries cannot be updated or deleted");
    });
}

const ledgerModel = mongoose.model("ledger", ledgerSchema);

module.exports = ledgerModel;