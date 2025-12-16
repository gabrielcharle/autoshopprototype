// email_utils.js

const nodemailer = require('nodemailer');
// We rely on server.js/lowStockReport.js to load dotenv, but we pull the variables here.
const SENDER_EMAIL = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASS; 

// --- Configure the Transporter for Gmail ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: SENDER_EMAIL,
        pass: EMAIL_PASSWORD, 
    },
    connectionTimeout: 10000, 
    socketTimeout: 10000 
});

/**
 * Sends an email using the configured transporter.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} text - Plain text body of the email.
 */
async function sendEmail(to, subject, text) {
    if (!SENDER_EMAIL || !EMAIL_PASSWORD) {
        console.error("EMAIL UTILS ERROR: SENDER_EMAIL or EMAIL_PASS not set in .env file.");
        return;
    }

    const mailOptions = {
        from: SENDER_EMAIL,
        to: to,
        subject: subject,
        text: text,
    };

    try {
        console.log(`Attempting to send email to ${to} from ${SENDER_EMAIL}...`);
        let info = await transporter.sendMail(mailOptions);
        console.log("Email successfully sent: %s", info.messageId); 
    } catch (error) {
        console.error("EMAIL SENDING FAILED:", error.message);
        throw new Error(`Failed to send email. Check Nodemailer configuration and credentials.`);
    }
}

module.exports = {
    sendEmail
};