# Banking System Backend

This project is a backend banking application built with Node.js, Express, and MongoDB. It provides user authentication, account creation, balance tracking, ledger-based financial history, and email notifications for a secure banking flow.

The project is API-first and does not include a frontend dashboard. It exposes REST endpoints that can be consumed by a web or mobile client.

## Overview

The banking system allows users to:

- Register and log in securely
- Create one or more bank accounts
- View their accounts
- Check account balances using ledger data
- Transfer funds between active accounts
- Maintain immutable debit and credit records
- Receive registration and transaction emails
- Use a system-user flow for internal funding operations

It uses MongoDB with Mongoose for data modeling and JWT for protected API access.

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT authentication
- bcryptjs
- cookie-parser
- Nodemailer
- dotenv

## Project Structure

```text
Banking System/
├── public/
│   └── logo.png
├── scripts/
│   └── provision-system-user.js
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── auth.config.js
│   │   └── db.js
│   ├── controllers/
│   │   ├── account.controller.js
│   │   ├── auth.controller.js
│   │   └── transaction.controller.js
│   ├── middlewares/
│   │   └── auth.middleware.js
│   ├── models/
│   │   ├── account.model.js
│   │   ├── blackList.model.js
│   │   ├── ledger.model.js
│   │   ├── transaction.model.js
│   │   └── user.model.js
│   ├── routes/
│   │   ├── account.routes.js
│   │   ├── auth.routes.js
│   │   └── transaction.routes.js
│   └── services/
│       └── email.service.js
├── .env
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
├── server.js
└── public/
```

## Core Modules

### Authentication
- `src/controllers/auth.controller.js` handles register, login, and logout
- `src/middlewares/auth.middleware.js` verifies JWTs and restricts routes based on user type
- `src/config/auth.config.js` contains token creation, verification, and cookie parsing logic
- `src/models/blackList.model.js` stores revoked tokens used after logout

### Account management
- `src/models/account.model.js` defines the account model
- `src/controllers/account.controller.js` creates accounts and fetches account details
- Account status can be `ACTIVE`, `FROZEN`, or `CLOSED`
- Balance is derived from ledger records instead of a stored mutable balance field

### Transaction and ledger processing
- `src/models/transaction.model.js` stores transaction metadata and idempotency keys
- `src/models/ledger.model.js` stores immutable debit and credit entries
- `src/controllers/transaction.controller.js` handles transfers and funding operations

### Email service
- `src/services/email.service.js` sends registration and transfer confirmation emails using Gmail OAuth2 credentials

### System user setup
- `scripts/provision-system-user.js` creates the system user and default account used for internal funding tasks

## Features

### User authentication and security
- Email/password registration with validation
- Password hashing via `bcryptjs`
- JWT-based authentication
- Cookie support for token handling
- Logout support using token blacklisting
- Route restrictions for privileged system-user access

### Account features
- Create multiple accounts per user
- Account ownership checks
- Account status validation
- Balance computed from ledger totals

### Transaction features
- Transfer between active accounts
- Prevent same-account transfers
- Amount validation and positivity checks
- Idempotency keys to reduce duplicate processing
- Ledger-based debit and credit entries
- MongoDB transaction session support
- Transaction lifecycle values: `PENDING`, `SUCCESS`, `FAILED`, `REVERSED`

### System funding flow
- Internal route to credit a customer account
- Restricted to a valid system-user account
- Used for operational or startup funding

### Email notifications
- Welcome email after registration
- Transaction email after successful transfer

## API Endpoints

All routes are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in with email and password |
| POST | `/api/auth/logout` | Log out the current user and revoke the token |

### Accounts

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/accounts/` | Create an account for the logged-in user |
| GET | `/api/accounts/` | Get all accounts of the logged-in user |
| GET | `/api/accounts/balance/:accountId` | Get the balance of a specific account |

### Transactions

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/transactions/` | Transfer funds between customer accounts |
| POST | `/api/transactions/system/initial` | Credit a customer account through the system-user flow |

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_very_secure_secret
NODE_ENV=development
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REFRESH_TOKEN=your_gmail_oauth_refresh_token
EMAIL_USER=your_email@gmail.com
SYSTEM_USER_EMAIL=system_user_email@example.com
SYSTEM_USER_NAME=Banking System
SYSTEM_USER_PASSWORD=strong_system_user_password
```

### Variable explanations
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret used to sign and verify JWTs
- `NODE_ENV`: Application environment (for example `development` or `production`)
- `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`: Gmail OAuth credentials for outbound email
- `EMAIL_USER`: Email address used to send automated mail
- `SYSTEM_USER_EMAIL`: Internal privileged user email
- `SYSTEM_USER_NAME`: Name for the internal system user
- `SYSTEM_USER_PASSWORD`: Strong secret used for the internal system user account

## Installation

1. Clone the repository:

```bash
git clone https://github.com/OmkarGhadge24/Banking-System.git
cd "Banking System"
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root and add the required variables listed above.

4. Start the server:

```bash
npm start
```

5. Run the app in development mode with automatic restarts:

```bash
npm run dev
```

The server runs on port `3000` by default.

## License

This project is licensed under the ISC License.