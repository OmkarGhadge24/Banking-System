const jwt = require("jsonwebtoken");

const JWT_EXPIRES_IN = "3d";
const JWT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (typeof secret !== "string" || secret.length < 32) {
        throw new Error(
            "JWT_SECRET must be configured with at least 32 characters"
        );
    }

    return secret;
}

function signAuthToken(userId) {
    return jwt.sign(
        { userId: userId.toString() },
        getJwtSecret(),
        {
            expiresIn: JWT_EXPIRES_IN,
            algorithm: "HS256"
        }
    );
}

function verifyAuthToken(token) {
    return jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"]
    });
}

function getAuthCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: JWT_MAX_AGE_MS,
        path: "/"
    };
}

function getTokenFromRequest(req) {
    // Prefer the authentication cookie when present.
    if (req.cookies?.token) {
        return req.cookies.token;
    }

    // Accept only a properly formatted Bearer authorization header.
    const authorization = req.headers.authorization;

    if (typeof authorization !== "string") {
        return null;
    }

    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    return match ? match[1] : null;
}

module.exports = { signAuthToken, verifyAuthToken, getAuthCookieOptions, getTokenFromRequest };
