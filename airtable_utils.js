// airtable_utils.js

const Airtable = require('airtable');

// Initialize the Airtable base once and store it in a globally accessible object.
// This bypasses module loading issues (circular dependency) that were causing the error.
global.airtableBase = new Airtable({ 
    apiKey: process.env.AIRTABLE_API_KEY 
}).base(process.env.AIRTABLE_BASE_ID);

// This file now only serves to initialize the connection globally.
// No explicit module.exports is strictly needed for the 'base' function itself.