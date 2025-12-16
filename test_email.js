// test_email.js - Standalone Email Debug Script

// 1. CRITICAL: Load environment variables first
require('dotenv').config();

// 2. Import the required email function
// ASSUMPTION: email_utils.js exports the sendEmail function
const { sendEmail } = require('./email_utils'); 

const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;
const SENDER_EMAIL = process.env.EMAIL_USER;

/**
 * Main function to execute the email test.
 */
async function runEmailTest() {
    console.log("--- STARTING EMAIL DEBUG TEST ---");

    if (!RECIPIENT_EMAIL || !SENDER_EMAIL) {
        console.error("❌ ERROR: RECIPIENT_EMAIL or EMAIL_USER is missing from your .env file.");
        console.error("Please ensure the following variables are set: RECIPIENT_EMAIL, EMAIL_USER, EMAIL_PASS");
        return;
    }
    
    const subject = `[AUTOSHOP DEBUG] Test Email from Node.js System`;
    const body = `
    This is an automatic test email to check the status of your system's notification utility.

    If you receive this email, your configuration and authentication (App Password) are CORRECT.
    
    Sent to: ${RECIPIENT_EMAIL}
    Sent from: ${SENDER_EMAIL}
    Timestamp: ${new Date().toLocaleString()}
    
    If this failed, check the console output for the specific SMTP error message.
    `;

    console.log(`\nAttempting to send test email...`);
    console.log(`To: ${RECIPIENT_EMAIL}`);
    console.log(`From: ${SENDER_EMAIL}`);
    console.log("---------------------------------");
    
    try {
        await sendEmail(RECIPIENT_EMAIL, subject, body);
        console.log("\n✅ SUCCESS: Test email function completed!");
        console.log("Check the inbox for gcharlestestemail@gmail.com.");
    } catch (error) {
        console.error("\n❌ FAILED TO SEND EMAIL ❌");
        console.error("-----------------------------------------------------------------");
        // Log the specific error from the catch block in email_utils.js
        console.error(`ERROR DETAILS: ${error.message}`);
        console.error("-----------------------------------------------------------------");
        console.error("Most common causes of failure:");
        console.error("1. App Password (EMAIL_PASS) is incorrect, expired, or was revoked by Google.");
        console.error("2. 2-Factor Authentication is disabled for the Gmail account.");
        console.error("3. You missed running 'npm install nodemailer'.");
    }
}

runEmailTest();