// auth_logic.js (FINAL CORRECTED VERSION)

// FINAL FIX: Access the globally initialized Airtable Base object
const base = global.airtableBase; 
const USER_TABLE_NAME = "Users"; // Ensure your table name matches this

/**
 * Looks up user in Airtable and validates credentials.
 * @param {string} email - The user's email (login).
 * @param {string} password - The user's plaintext password (for prototype).
 * @returns {Promise<Object|null>} The user object (Role, Department, Email) or null.
 */
async function lookupUser(email, password) {
    try {
        const records = await base(USER_TABLE_NAME).select({
            filterByFormula: `AND({Email} = '${email}', {Password Hash} = '${password}')`,
            maxRecords: 1 
        }).firstPage();

        if (records.length > 0) {
            const userRecord = records[0];
            return {
                id: userRecord.id,
                email: userRecord.get('Email'),
                role: userRecord.get('Role'), // Management, Sales, etc.
                department: userRecord.get('Department')
            };
        }
        return null; // User not found or password incorrect

    } catch (err) {
        // The error message will now be cleaner if an Airtable error occurs (e.g., bad filter)
        console.error('Error during user lookup:', err.message); 
        return null;
    }
}

module.exports = {
    lookupUser
};