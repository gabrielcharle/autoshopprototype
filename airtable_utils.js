// airtable_utils.js (SIMPLIFIED EXPORT)

const Airtable = require('airtable');

// Ensure you use the token variable name exactly as it is in your .env
const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN; 
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;

const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE);

// Export the base object directly
module.exports = base;