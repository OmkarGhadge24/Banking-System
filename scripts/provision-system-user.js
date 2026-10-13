require("dotenv").config();
const mongoose = require("mongoose");
const userModel = require("../src/models/user.model");
const accountModel = require("../src/models/account.model");

async function provisionSystemUser() {
    const {
        MONGO_URI,
        SYSTEM_USER_EMAIL,
        SYSTEM_USER_NAME,
        SYSTEM_USER_PASSWORD
    } = process.env;

    // 1. Validate the required environment variables.
    if (
        !MONGO_URI ||
        !SYSTEM_USER_EMAIL ||
        !SYSTEM_USER_NAME ||
        !SYSTEM_USER_PASSWORD
    ) {
        throw new Error(
            "MONGO_URI, SYSTEM_USER_EMAIL, SYSTEM_USER_NAME and SYSTEM_USER_PASSWORD are required"
        );
    }

    const email = SYSTEM_USER_EMAIL.trim().toLowerCase();
    const name = SYSTEM_USER_NAME.trim();

    if (!email || !name) {
        throw new Error(
            "System-user email and name cannot be empty"
        );
    }

    if (SYSTEM_USER_PASSWORD.length < 16) {
        throw new Error(
            "SYSTEM_USER_PASSWORD must contain at least 16 characters"
        );
    }

    let connected = false;
    let createdUser = null;

    try {
        // 2. Connect to MongoDB.
        await mongoose.connect(MONGO_URI);
        connected = true;

        // 3. Do not promote an existing user.
        const existingUser = await userModel.findOne({
            email
        });

        if (existingUser) {
            throw new Error(
                "A user with this email already exists. Use a dedicated new email; this script will not promote an existing user."
            );
        }

        // 4. Create a dedicated system user.
        // The user model's password hook should hash the password.
        createdUser = await userModel.create({
            email,
            name,
            password: SYSTEM_USER_PASSWORD,
            systemUser: true
        });

        // 5. Create the system user's INR account.
        const systemAccount = await accountModel.create({
            user: createdUser._id,
            currency: "INR"
        });

        console.log("System user provisioned successfully.");

        console.log({
            userId: createdUser._id.toString(),
            email: createdUser.email,
            accountId: systemAccount._id.toString()
        });
    } catch (error) {
        // Attempt cleanup if account creation fails.
        if (createdUser) {
            const cleanupResults = await Promise.allSettled([
                accountModel.deleteMany({
                    user: createdUser._id
                }),
                userModel.deleteOne({
                    _id: createdUser._id
                })
            ]);

            for (const result of cleanupResults) {
                if (result.status === "rejected") {
                    console.error(
                        "Provisioning cleanup failed:",
                        result.reason.message
                    );
                }
            }
        }

        throw error;
    } finally {
        if (connected) {
            await mongoose.disconnect();
        }
    }
}

provisionSystemUser().catch((error) => {
    console.error(
        "System-user provisioning failed:",
        error.message
    );

    process.exitCode = 1;
});
