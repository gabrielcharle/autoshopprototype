// lowStockReport.js

// 🚨 CRITICAL FIX: Load environment variables immediately when running this file directly
require('dotenv').config();

// 1. Import utilities and connection setup
// FIX: Using direct assignment because airtable_utils.js exports 'base' directly.
// Use the globally initialized base
const base = global.airtableBase; 

// 1A. IMPORT EMAIL UTILITY 
const { sendEmail } = require('./email_utils'); 

// Load environment variables (now guaranteed to be available)
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME; 
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL; 

/**
 * Retrieves a list of inventory items where the current Quantity is less than or equal to the Reorder Point.
 * Displays the report to the console and sends an email notification if low stock is found.
 */
async function lowStockReport() {
    console.log(`\n--- GENERATING LOW STOCK REPORT ---`);

    try {
        // --- 1. DEFINE THE FILTER FORMULA ---
        const formula = "IF({Quantity} <= {Reorder Point}, TRUE())";

        // --- 2. RETRIEVE RECORDS ---
        const records = await base(TABLE_NAME).select({ 
            filterByFormula: formula,
            sort: [{field: "Quantity", direction: "asc"}] 
        }).all(); 
        
        console.log(`[REPORTING] Found ${records.length} critical items.`); 

        if (records.length === 0) {
            console.log(`\n✅ REPORT: All stock levels are currently OK.`);
            return;
        }

        // --- 3. CONSOLE DISPLAY & EMAIL BODY GENERATION ---
        
        let reportBody = `\n🚨 ${records.length} ITEMS NEED IMMEDIATE ATTENTION 🚨\n`;
        let consoleBody = reportBody;
        
        const header = "-------------------------------------------------------------------\n" +
                       "SKU \t\t| Part Name \t\t\t| Qty | Reorder | Location\n" +
                       "-------------------------------------------------------------------";

        consoleBody += header + '\n';
        reportBody += header + '\n';


        records.forEach(record => {
            const sku = record.get('SKU') || 'N/A';
            const partName = record.get('Part Name') || 'N/A';
            const quantity = record.get('Quantity') || 0;
            const reorderPoint = record.get('Reorder Point') || 0;
            const locationID = record.get('Location ID') || 'N/A';

            const paddedPartName = partName.padEnd(25).substring(0, 25);
            const line = `${sku.padEnd(10)}\t| ${paddedPartName}\t| ${String(quantity).padEnd(3)} | ${String(reorderPoint).padEnd(7)} | ${locationID}\n`;
            
            consoleBody += line;
            reportBody += line;
        });
        
        const footer = "-------------------------------------------------------------------\n";
        consoleBody += footer;
        reportBody += footer;

        console.log(consoleBody);

        // 🚨 4. SEND EMAIL NOTIFICATION (Using robust, individual try/catch) 🚨
        if (RECIPIENT_EMAIL) {
            try {
                console.log(`\n📧 Initiating email alert for ${RECIPIENT_EMAIL}...`);
                await sendEmail(
                    RECIPIENT_EMAIL, 
                    `URGENT: ${records.length} Low Stock Item(s) in Inventory`, 
                    reportBody 
                );
                console.log(`✅ Email sending process COMPLETE.`);
            } catch (emailError) {
                console.error(`\n❌ EMAIL FAILED TO SEND during report: ${emailError.message}`);
            }
        } else {
            console.log(`❌ WARNING: RECIPIENT_EMAIL not set in .env. Skipping email notification.`);
        }


    } catch (err) {
        console.error('\n--- REPORT API ERROR (General) ---');
        console.error('Error during report generation:', err.message);
        console.error('------------------------------------');
    }
}

// -------------------------------------------------------------------

// --- EXPORT ---
// 🚨 CRITICAL FIX: Export the function so server.js can import and call it.
module.exports = {
    lowStockReport 
};


// --- STANDALONE EXECUTION (For running via `node lowStockReport.js`) ---
if (require.main === module) {
    lowStockReport();
}