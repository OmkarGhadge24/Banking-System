const userModel = require("../models/user.model");
const tokenBlackListModel = require("../models/blackList.model");
const { verifyAuthToken, getTokenFromRequest } = require("../config/auth.config");

async function authenticateRequest(
    req,
    res,
    next,
    requireSystemUser = false
) {
    // 1. Extract the JWT from the cookie or Bearer header.
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            Message: "Unauthorized access"
        });
    }

    // 2. Verify the JWT signature and expiration.
    let decoded;

    try {
        decoded = verifyAuthToken(token);
    } catch (error) {
        if (
            typeof error.message === "string" &&
            error.message.startsWith(
                "JWT_SECRET must be configured"
            )
        ) {
            console.error(
                "JWT configuration error:",
                error.message
            );

            return res.status(500).json({
                Message:
                    "Authentication service is not configured correctly"
            });
        }

        return res.status(401).json({
            Message:
                "Unauthorized access, token is invalid or expired"
        });
    }

    // 3. Validate the expected JWT payload.
    if (
        !decoded ||
        typeof decoded !== "object" ||
        typeof decoded.userId !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(decoded.userId)
    ) {
        return res.status(401).json({
            Message:
                "Unauthorized access, invalid token payload"
        });
    }

    // 4. Check token revocation and retrieve the user.
    try {
        const isBlacklisted =
            await tokenBlackListModel.exists({
                token: token
            });

        if (isBlacklisted) {
            return res.status(401).json({
                Message:
                    "Unauthorized access, token has been revoked"
            });
        }

        /*
         * systemUser is excluded by default in the user schema.
         * Explicitly select it so both middleware types can
         * enforce the correct access restrictions.
         */
        const user = await userModel
            .findById(decoded.userId)
            .select("+systemUser");

        // Reject tokens belonging to deleted users.
        if (!user) {
            return res.status(401).json({
                Message:
                    "Unauthorized access, user no longer exists"
            });
        }

        // 5. System-only routes reject ordinary customers.
        if (
            requireSystemUser &&
            user.systemUser !== true
        ) {
            return res.status(403).json({
                Message:
                    "Forbidden access, system-user privileges required"
            });
        }

        // 6. Customer routes reject system users.
        if (
            !requireSystemUser &&
            user.systemUser === true
        ) {
            return res.status(403).json({
                Message:
                    "Forbidden access, system users cannot access customer endpoints"
            });
        }

        // 7. Make the authenticated user available to controllers.
        req.user = user;

        return next();
    } catch (error) {
        console.error(
            "Authentication database error:",
            error.message
        );

        return res.status(500).json({
            Message: "Unable to authenticate request"
        });
    }
}

/**
 * Middleware for ordinary customer endpoints.
 */
async function authMiddleware(req, res, next) {
    return authenticateRequest(
        req,
        res,
        next,
        false
    );
}

/**
 * Middleware for privileged system-user endpoints.
 */
async function systemUserMiddleware(req, res, next) {
    return authenticateRequest(
        req,
        res,
        next,
        true
    );
}

module.exports = { authMiddleware, systemUserMiddleware };