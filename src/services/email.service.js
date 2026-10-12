const nodemailer = require('nodemailer');
const path = require("path");

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});


const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Banking System" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,

            attachments: [
                {
                    filename: "logo.png",
                    path: path.join(
                        __dirname,
                        "../../public/logo.png"
                    ),
                    cid: "banking-logo",
                },
            ],
        });
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};


const sendRegistrationEmail = async (userEmail, name) => {

    const subject = "Welcome to Banking System!";

    const text = `
Hello ${name || "there"},

Thank you for registering with Banking System.
We're delighted to have you on board!

We're here to help you keep track of your money,
manage your transactions, and stay organized
with confidence.

We're glad you're part of our journey and look
forward to providing you with a simple and
convenient money management experience.

Your security matters to us. Never share your
password, PIN, or OTP with anyone.

Best regards,
Banking System Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">
    <title>Welcome to Banking System</title>
</head>

<body style="
    margin:0;
    padding:0;
    background-color:#f1f5f9;
    font-family:Arial,Helvetica,sans-serif;
    color:#243447;
">

<table role="presentation"
       width="100%"
       cellpadding="0"
       cellspacing="0"
       border="0"
       style="background-color:#f1f5f9;padding:30px 12px;">

    <tr>
        <td align="center">

            <table role="presentation"
                   width="100%"
                   cellpadding="0"
                   cellspacing="0"
                   border="0"
                   style="
                       max-width:600px;
                       background-color:#ffffff;
                       border-radius:12px;
                       overflow:hidden;
                   ">

                <!-- Header -->
                <tr>
                    <td align="center"
                        style="
                            background-color:#102a43;
                            padding:32px 20px;
                        ">

                        <img
                            src="cid:banking-logo"
                            alt="Banking System Logo"
                            width="65"
                            style="
                                display:block;
                                margin:0 auto 15px;
                                border:0;
                                height:auto;
                            "
                        >

                        <h1 style="
                            color:#ffffff;
                            font-size:28px;
                            margin:0;
                            font-weight:bold;
                        ">
                            Banking System
                        </h1>

                        <p style="
                            color:#cbd5e1;
                            font-size:12px;
                            letter-spacing:2px;
                            margin:12px 0 0;
                        ">
                            YOUR MONEY. YOUR CONTROL.
                        </p>

                    </td>
                </tr>

                <!-- Welcome message -->
                <tr>
                    <td style="padding:32px 28px 36px;">

                        <p style="
                            color:#16803d;
                            font-size:12px;
                            font-weight:bold;
                            letter-spacing:1px;
                            margin:0 0 14px;
                        ">
                            REGISTRATION SUCCESSFUL
                        </p>

                        <h2 style="
                            color:#102a43;
                            font-size:27px;
                            line-height:1.4;
                            margin:0 0 18px;
                        ">
                            Welcome, ${name}!
                        </h2>

                        <p style="
                            color:#526171;
                            font-size:15px;
                            line-height:1.8;
                            margin:0 0 16px;
                        ">
                            Thank you for registering with
                            Banking System. We're delighted
                            to have you on board!
                        </p>

                        <p style="
                            color:#526171;
                            font-size:15px;
                            line-height:1.8;
                            margin:0 0 16px;
                        ">
                            We're here to help you keep track
                            of your money, manage your
                            transactions, and stay organized
                            with confidence.
                        </p>

                        <p style="
                            color:#526171;
                            font-size:15px;
                            line-height:1.8;
                            margin:0;
                        ">
                            We're glad you're part of our
                            journey and look forward to
                            providing you with a simple and
                            convenient money management
                            experience.
                        </p>

                    </td>
                </tr>

                <!-- Security message and signature -->
                <tr>
                    <td style="
                        background-color:#f8fafc;
                        border-top:1px solid #e5e7eb;
                        padding:24px 28px;
                    ">

                        <p style="
                            color:#526171;
                            font-size:13px;
                            line-height:1.8;
                            margin:0 0 22px;
                        ">
                            Your security matters to us.
                            Never share your password, PIN,
                            or OTP with anyone.
                        </p>

                        <p style="
                            color:#243447;
                            font-size:14px;
                            line-height:1.8;
                            margin:0;
                        ">
                            Best regards,<br>
                            <strong style="color:#102a43;">
                                Banking System Team
                            </strong>
                        </p>

                        <p style="
                            color:#94a3b8;
                            font-size:11px;
                            text-align:center;
                            margin:24px 0 0;
                        ">
                            &copy; ${new Date().getFullYear()}
                            Banking System. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>

        </td>
    </tr>

</table>

</body>
</html>
    `;

    return await sendEmail(userEmail, subject, text, html);
};

const sendTransactionEmail = async (userEmail, name, amount, creditAccount, recipientName) => {
    const currency = creditAccount.currency || "INR";

    const formattedAmount = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format(Number(amount));

    const subject = "Transaction Successful - Banking System";

    const text = `Hello ${name || "there"},

Your money transfer has been completed successfully.

Amount Transferred: ${formattedAmount}
Transferred To: ${recipientName}

This email is for your transaction records.

Best regards,
Banking System Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">
    <title>Transaction Successful</title>
</head>

<body style="
    margin:0;
    padding:20px 10px;
    background-color:#f1f5f9;
    font-family:Arial,Helvetica,sans-serif;
    color:#243447;
">

<table role="presentation" width="100%"
       cellpadding="0" cellspacing="0" border="0">
    <tr>
        <td align="center">

            <table role="presentation" width="100%"
                   cellpadding="0" cellspacing="0" border="0"
                   style="
                       max-width:500px;
                       background:#ffffff;
                       border-radius:10px;
                       overflow:hidden;
                   ">

                <tr>
                    <td align="center"
                        style="background:#102a43;padding:22px 15px;">

                        <img src="cid:banking-logo"
                             alt="Banking System Logo"
                             width="48"
                             style="display:block;margin:0 auto 10px;border:0;height:auto;">

                        <h2 style="color:#ffffff;font-size:22px;margin:0;">
                            Banking System
                        </h2>

                        <p style="color:#cbd5e1;font-size:10px;
                                  letter-spacing:1.5px;margin:8px 0 0;">
                            YOUR MONEY. YOUR CONTROL.
                        </p>

                    </td>
                </tr>

                <tr>
                    <td style="padding:25px 22px;">

                        <h2 style="color:#16803d;font-size:21px;
                                   margin:0 0 18px;">
                            &#10003; Transaction Successful
                        </h2>

                        <p style="color:#334155;font-size:14px;
                                  margin:0 0 12px;">
                            Hello ${name || "there"}!
                        </p>

                        <p style="color:#526171;font-size:14px;
                                  line-height:1.7;margin:0 0 20px;">
                            Your money transfer has been completed
                            successfully.
                        </p>

                        <table role="presentation" width="100%"
                               cellpadding="0" cellspacing="0" border="0"
                               style="background:#f8fafc;
                                      border:1px solid #e5e7eb;
                                      border-radius:8px;">

                            <tr>
                                <td style="padding:18px;">

                                    <p style="color:#64748b;font-size:12px;
                                              margin:0 0 8px;">
                                        Amount Transferred
                                    </p>

                                    <h1 style="color:#102a43;font-size:27px;
                                               margin:0 0 18px;">
                                        ${formattedAmount}
                                    </h1>

                                    <div style="border-top:1px solid #e5e7eb;
                                                margin-bottom:15px;"></div>

                                    <p style="color:#64748b;font-size:12px;
                                              margin:0 0 7px;">
                                        Transferred To
                                    </p>

                                    <p style="color:#102a43;font-size:15px;
                                              font-weight:bold;margin:0;
                                              overflow-wrap:anywhere;">
                                        ${recipientName}
                                    </p>

                                </td>
                            </tr>
                        </table>

                        <p style="color:#526171;font-size:12px;
                                  line-height:1.7;margin:20px 0;">
                            This email is for your transaction records.
                        </p>

                        <p style="color:#334155;font-size:13px;
                                  line-height:1.8;margin:0;">
                            Best regards,<br>
                            <strong style="color:#102a43;">
                                Banking System Team
                            </strong>
                        </p>

                    </td>
                </tr>

                <tr>
                    <td align="center"
                        style="background:#f8fafc;
                               border-top:1px solid #e5e7eb;padding:14px;">

                        <p style="color:#94a3b8;font-size:11px;margin:0;">
                            &copy; ${new Date().getFullYear()}
                            Banking System
                        </p>

                    </td>
                </tr>

            </table>

        </td>
    </tr>
</table>

</body>
</html>
    `;

    return await sendEmail(
        userEmail,
        subject,
        text,
        html
    );
};

module.exports = { sendEmail, sendRegistrationEmail, sendTransactionEmail };