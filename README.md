# Banking System

A secure backend banking application built with Node.js, Express, and MongoDB. This project provides user authentication, account management, ledger-based balance tracking, and internal money transfers with transaction safety checks and email notifications.

It is designed as an API-first banking system and focuses on core banking operations rather than a frontend interface.

## Overview

The Banking System allows users to:

- Register and log in securely
- Create one or more bank accounts
- View their account list
- Check account balances from ledger activity
- Transfer money between active accounts
- Maintain ledger integrity using immutable debit/credit entries
- Receive registration and transaction emails
- Use a system-user flow for initial funding operations

The application uses MongoDB with Mongoose to model users, accounts, transactions, and ledger entries, and JWT for protected API access.

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs for password hashing
- Nodemailer for email services
- dotenv for environment configuration

## Project Structure

```text
banking-system/
├── public/
│   └── logo.png
├── src/
│   ├── app.js
│   ├── config/
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
├── package.json
├── server.js
└── README.md
```

## Features

### Authentication and security

- User registration with email validation
- Password hashing using bcryptjs
- JWT-based auth with cookie support
- Logout token blacklisting to invalidate old tokens
- System-user middleware for restricted administrative funding endpoints

### Account management

- User-specific account creation
- Account status tracking: ACTIVE, FROZEN, CLOSED
- Balance computation based on ledger records
- Account ownership checks for secure access

### Transaction processing

- Funds transfer between accounts with validation
- Insufficient-balance checks before transfer
- Idempotency key enforcement to prevent duplicate transactions
- Transaction lifecycle states: PENDING, SUCCESS, FAILED, REVERSED
- Ledger entries for debit and credit operations
- MongoDB transaction session for atomic transfer updates

### Email notifications

- Welcome email after registration
- Successful transaction email with transfer details
- Gmail OAuth-based mail configuration

## API Endpoints

All routes are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in an existing user |
| POST | `/api/auth/logout` | Log out and blacklist the current token |

### Accounts

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/accounts/` | Create a new account for the logged-in user |
| GET | `/api/accounts/` | Fetch all accounts for the logged-in user |
| GET | `/api/accounts/balance/:accountId` | Check balance for a specific account |

### Transactions

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/transactions/` | Transfer money between active accounts |
| POST | `/api/transactions/system/initial` | Fund a user account via the system-user route |

## Environment Variables

Create a `.env` file in the project root with values like:

```env
MONGO_URI=your_mongodb_url
JWT_SECRET=your_super_secure_secret_key
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REFRESH_TOKEN=your_gmail_oauth_refresh_token
EMAIL_USER=your_email@gmail.com
```

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd "Banking System"
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables in `.env`.

4. Start the server:

```bash
npm start
```

5. For development with auto-reload:

```bash
npm run dev
```

The app runs on port `3000` by default.

## License

This project is licensed under the ISC License.
