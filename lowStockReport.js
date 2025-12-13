// lowStockReport.js

// 1. Import utilities and connection setup
const { base } = require('./airtable_utils');

// Table name is pulled from .env in airtable_utils
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME; 

/**
 * Retrieves and displays a list of all inventory items where 
 * the current Quantity is less than or equal to the Reorder Point.
 */
async function lowStockReport() {
    console.log(`\n--- GENERATING LOW STOCK REPORT ---`);

    try {
        // --- 1. DEFINE THE FILTER FORMULA ---
        // This Airtable formula returns true if Quantity <= Reorder Point.
        const formula = "IF({Quantity} <= {Reorder Point}, TRUE())";

        // --- 2. RETRIEVE RECORDS ---
        const records = await base(TABLE_NAME).select({
            // Using the formula to filter results
            filterByFormula: formula,
            // Sort by Quantity to show the emptiest stock first
            sort: [{field: "Quantity", direction: "asc"}] 
        }).all(); // Use .all() to retrieve all matching records

        if (records.length === 0) {
            console.log(`\n✅ REPORT: All stock levels are currently OK.`);
            return;
        }

        // --- 3. DISPLAY RESULTS ---
        console.log(`\n🚨 ${records.length} ITEMS NEED IMMEDIATE ATTENTION 🚨`);
        console.log("-------------------------------------------------------------------");
        console.log("SKU \t\t| Part Name \t\t\t| Qty | Reorder | Location");
        console.log("-------------------------------------------------------------------");

        records.forEach(record => {
            const sku = record.get('SKU');
            const partName = record.get('Part Name');
            const quantity = record.get('Quantity');
            const reorderPoint = record.get('Reorder Point');
            const locationID = record.get('Location ID');

            // Pad the part name for clean display
            const paddedPartName = partName.padEnd(25).substring(0, 25);
            
            console.log(`${sku.padEnd(10)}\t| ${paddedPartName}\t| ${String(quantity).padEnd(3)} | ${String(reorderPoint).padEnd(7)} | ${locationID}`);
        });

        console.log("-------------------------------------------------------------------");

    } catch (err) {
        console.error('\n--- REPORT API ERROR ---');
        console.error('Error during report generation:', err.message);
        console.error('--------------------------');
    }
}

// --- EXECUTION EXAMPLE ---
lowStockReport();