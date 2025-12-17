// email_utils.js

const nodemailer = require('nodemailer');

// These pull from your Render Environment Variables
const SENDER_EMAIL = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASS; 

// --- Configure the Transporter (REPLACES the 'service: gmail' block) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,         // Secure SSL port (fixes Render timeout issues)
    secure: true,      // Required for port 465
    auth: {
        user: SENDER_EMAIL,
        pass: EMAIL_PASSWORD, 
    },
    connectionTimeout: 15000, // 15 seconds to allow for cloud network latency
    socketTimeout: 15000
});

/**
 * Sends an email using the configured transporter.
 */
async function sendEmail(to, subject, text) {
    if (!SENDER_EMAIL || !EMAIL_PASSWORD) {
        console.error("EMAIL UTILS ERROR: SENDER_EMAIL or EMAIL_PASS not set.");
        return;
    }

    const mailOptions = {
        from: SENDER_EMAIL,
        to: to,
        subject: subject,
        text: text,
    };

    try {
        console.log(`Attempting to send email to ${to} from ${SENDER_EMAIL} via Port 465...`);
        let info = await transporter.sendMail(mailOptions);
        console.log("✅ Email successfully sent: %s", info.messageId); 
    } catch (error) {
        console.error("❌ EMAIL SENDING FAILED:", error.message);
        // Throwing the error ensures lowStockReport.js knows it failed
        throw new Error(`Failed to send email. Check Nodemailer configuration and credentials.`);
    }
}

module.exports = {
    sendEmail
};