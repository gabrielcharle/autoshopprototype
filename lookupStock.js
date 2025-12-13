// lookupStock.js

// 1. Import utilities and connection setup
const { base } = require('./airtable_utils');

// Table name is pulled from .env in airtable_utils
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME; 

/**
 * Retrieves and displays the current inventory details for a given SKU.
 * @param {string} sku The Stock Keeping Unit to look up.
 */
async function lookupStock(sku) {
    console.log(`\n--- LOOKUP: Searching for SKU: ${sku} ---`);

    try {
        // Use the Airtable select method to filter records by the SKU
        const records = await base(TABLE_NAME).select({
            maxRecords: 1,
            filterByFormula: `{SKU} = '${sku}'`
        }).firstPage();

        if (records.length === 0) {
            console.log(`\n❌ ERROR: SKU "${sku}" not found in inventory.`);
            return;
        }

        const record = records[0];
        
        // Retrieve the necessary fields from the found record
        const partName = record.get('Part Name');
        const quantity = record.get('Quantity');
        const locationID = record.get('Location ID');
        const reorderPoint = record.get('Reorder Point');
        const lastIssueDate = record.get('Last Issue Date');
        const dateReceived = record.get('Date Received');
        
        // --- DISPLAY REPORT ---
        console.log(`\n✅ STOCK REPORT for ${partName} (${sku})`);
        console.log(`-------------------------------------------`);
        console.log(`Current Quantity: \t${quantity}`);
        console.log(`Storage Location: \t${locationID}`);
        console.log(`Reorder Point: \t\t${reorderPoint}`);
        console.log(`Last Received: \t\t${dateReceived || 'N/A'}`);
        console.log(`Last Issued: \t\t${lastIssueDate || 'N/A'}`);
        
        // Simple stock level analysis
        if (quantity <= reorderPoint) {
            console.log(`\n🚨 STATUS: CRITICAL - REORDER NEEDED`);
        } else {
            console.log(`\n🟢 STATUS: OK`);
        }
        console.log(`-------------------------------------------`);

    } catch (err) {
        console.error('\n--- LOOKUP API ERROR ---');
        console.error('Error during lookup:', err.message);
        console.error('--------------------------');
    }
}

// --- EXECUTION EXAMPLE ---
// Use the SKU we created/updated: FLT-OIL-300
lookupStock("FLT-OIL-300");