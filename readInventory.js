// readInventory.js

// 1. Load environment variables from .env file
require('dotenv').config();

// 2. Import the Airtable library
const Airtable = require('airtable');

// 3. Retrieve credentials from environment variables
const API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME;

// 4. Initialize the Airtable base connection
// The API Token is used for authentication
const base = new Airtable({ apiKey: API_TOKEN }).base(BASE_ID);

/**
 * Function to fetch and display the first 10 records from the Inventory table.
 */
function readInventory() {
    console.log(`\nAttempting to connect to Base ID: ${BASE_ID}`);
    console.log(`Fetching data from table: "${TABLE_NAME}"...`);

    // Use the .select() method to query the table
    base(TABLE_NAME).select({
        // Limit the request to the first 10 records for quick testing
        maxRecords: 10,
        // View to use (often 'Grid view' is used as the default)
        view: "Grid view", 
        // Example: Sort by a field to organize the output
        sort: [{field: "SKU", direction: "asc"}] 
    }).eachPage(function page(records, fetchNextPage) {
        
        // This function will be called for each "page" of records fetched

        records.forEach(function(record) {
            // Log the record ID and a key field (e.g., 'Part ID')
            console.log(
                'Retrieved record ID:', 
                record.getId(), 
                '| SKU:', 
                record.get('SKU')
            );
            // You can access other fields like: record.get('Qty On Hand')
        });

        // To fetch the next page of records, call fetchNextPage
        // If there are no more records, fetchNextPage will not be called
        fetchNextPage();

    }, function done(err) {
        // This runs when all pages have been fetched or if an error occurs
        if (err) {
            console.error('\n--- API ERROR ---');
            console.error('Error fetching inventory:', err.message);
            console.error('Check your API Token and Base ID in the .env file.');
            console.error('Also ensure the table name is correct ("' + TABLE_NAME + '").');
            console.error('-----------------');
            return;
        }
        console.log('\n--- Data Retrieval Complete ---');
    });
}

// Execute the function
readInventory();