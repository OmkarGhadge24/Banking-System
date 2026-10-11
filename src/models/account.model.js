const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "user",
        required: [true, "Account must be associate with user"],
        index: true,
    },
    status: {
        type: String,
        enum: ["ACTIVE", "FROZEN", "CLOSED"],
        message: "Status must be either ACTIVE, FROZEN or CLOSED",
        default : "ACTIVE"
    },
    currency: {
        type: String,
        required: [true, "Currency is required"],
        default: "INR"
    }
}, {
    timestamps: true
});

accountSchema.index({ user: 1, status: 1 });

const accountModel = mongoose.model("account", accountSchema);

module.exports = accountModel;