// issueStock.js

// 1. Import utilities and connection setup
const { base, logTransaction, sendEmailAlert } = require('./airtable_utils');

// Table name is pulled from .env in airtable_utils
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME; 

// Define the transaction details for testing
const targetSKU = "FLT-OIL-300"; 
// CRITICAL: Set to 451. With starting stock of 500 and R.P. of 50, this will TRIGGER the alert.
const issueQuantity = 451; 

// --- ALERT SIMULATION FUNCTION ---
function sendAlert(sku, newQty, reorderPoint) {
    console.log(`\n*** REORDER ALERT ***`);
    console.log(`SKU: ${sku} is critically low!`);
    console.log(`Current Stock: ${newQty} | Reorder Point: ${reorderPoint}`);
    console.log(`*********************\n`);
}

/**
 * Issues stock (reduces quantity) for a given SKU and triggers a reorder alert if needed.
 */
async function issueStock(targetSKU, issueQuantity) {
    console.log(`\n--- BEGINNING TRANSACTION: Issuing ${issueQuantity} units of ${targetSKU} ---`);

    try {
// --- STEP A: FIND THE RECORD ---
const records = await base(TABLE_NAME).select({
    filterByFormula: `{SKU} = '${targetSKU}'`,
    // Use the reliable "Date Received" field for sorting, assuming it is always populated
    // by the receiving script and is the best proxy for "newest."
    sort: [{field: "Date Received", direction: "desc"}], 
    maxRecords: 1 
}).firstPage();

        if (records.length === 0) {
            console.error(`ERROR: SKU ${targetSKU} not found.`);
            return;
        }

        // If multiple records with the same SKU exist (due to the receive runs), 
        // we will use the first one found, which should be the highest/newest quantity.
        const record = records[0]; 
        const recordId = record.getId();
        const currentQty = record.get('Quantity') || 0;
        const reorderPoint = record.get('Reorder Point'); 

        // --- STEP B: NEGATIVE STOCK CHECK (Validation) ---
        if (currentQty < issueQuantity) {
            console.error(`VALIDATION FAILED: Insufficient stock. Current: ${currentQty}, Requested: ${issueQuantity}.`);
            return;
        }

        const newQty = currentQty - issueQuantity;
        const todayDate = new Date().toISOString().slice(0, 10);

        // --- STEP C: UPDATE THE RECORD ---
        await base(TABLE_NAME).update([
            {
                "id": recordId,
                "fields": {
                    "Quantity": newQty,
                    "Last Issue Date": todayDate 
                }
            }
        ]);

        // --- STEP D: AUDIT LOG CALL ---
        await logTransaction(targetSKU, -issueQuantity, "ISSUE", recordId); 

        // --- STEP E: REORDER CHECK (NEW LOGIC) ---
//(Call the new email function)
if (newQty <= reorderPoint) {
    await sendEmailAlert(targetSKU, newQty, reorderPoint); // New email call
}

        console.log('\n--- TRANSACTION SUCCESS ---');
        console.log(`- Old Quantity: ${currentQty}`);
        console.log(`- Issued: ${issueQuantity}`);
        console.log(`- New Quantity: ${newQty}`); 
        console.log('---------------------------');

    } catch (err) {
        console.error('\n--- API WRITE ERROR ---');
        console.error('Error during transaction:', err.message);
        console.error('-----------------------');
    }
}

// --- EXECUTION EXAMPLE ---
issueStock(targetSKU, issueQuantity);