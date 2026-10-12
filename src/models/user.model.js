const mongoose = require("mongoose");
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required to create account"],
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
        unique: [true, "Email already exists"],
    },
    name: {
        type: String,
        required: [true, "Name is required to create account"],
        minlength: 3,
        maxlength: 30,
        trim: true,
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minLength: 6,
        select: false
    },
    systemUser : {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
    return;
})

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;