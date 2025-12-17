const nodemailer = require('nodemailer');

const SMTP_USER = process.env.EMAIL_USER; 
const SMTP_PASS = process.env.EMAIL_PASS; 

const transporter = nodemailer.createTransport({
    host: 'mail.smtp2go.com',
    port: 2525, // Optimized for Render
    secure: false, 
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS, 
    }
});

async function sendEmail(to, subject, text) {
    const mailOptions = {
        // 🚨 CHANGE: This MUST look like a real email address
        from: '20201126@roytec.edu',
        to: to,
        subject: subject,
        text: text,
    };

    try {
        console.log(`🚀 Sending via SMTP2GO to ${to} from ${mailOptions.from}...`);
        let info = await transporter.sendMail(mailOptions);
        console.log("✅ SUCCESS: Email sent! ID: %s", info.messageId); 
    } catch (error) {
        console.error("❌ SMTP2GO SENDING FAILED:", error.message);
        throw new Error(`Email failed. Check SMTP2GO sender verification.`);
    }
}

module.exports = { sendEmail };