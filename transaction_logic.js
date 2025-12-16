// transaction_logic.js

// FINAL FIX: Access the globally initialized Airtable Base object
const base = global.airtableBase; 
const { lowStockReport } = require('./lowStockReport'); // Ensure this is correctly imported

// Utility to create/update inventory records and add transactions
async function createReceiving(formData) {
    const { itemSku, partName, quantity, reorderPoint, unitCost, locationID, vendorName } = formData;
    
    // Convert necessary strings to numbers
    const qty = parseInt(quantity);
    const rp = parseInt(reorderPoint);
    const cost = parseFloat(unitCost);
    const cleanSku = (itemSku || '').trim().toLowerCase();

    // 🚨 INPUT VALIDATION 🚨
    if (!cleanSku || cleanSku.length < 3) {
        return { success: false, message: 'Item SKU must be provided and valid.' };
    }
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        return { success: false, message: 'Quantity must be a whole positive number.' };
    }
    if (isNaN(rp) || rp < 0 || !Number.isInteger(rp)) {
        return { success: false, message: 'Reorder Point must be a non-negative whole number.' };
    }
    if (isNaN(cost) || cost < 0) {
        return { success: false, message: 'Unit Cost must be a non-negative number.' };
    }
    // -------------------------------------------------------------------

    try {
        // 1. Find the inventory record using the primary {SKU}
        const existingRecords = await base(process.env.INVENTORY_TABLE_NAME).select({
            filterByFormula: `{SKU} = '${cleanSku}'`,
            maxRecords: 1
        }).firstPage();

        let inventoryRecordId;
        let newQuantity;

        if (existingRecords.length > 0) {
            // Record exists (UPDATE)
            const existingRecord = existingRecords[0];
            inventoryRecordId = existingRecord.id;
            const currentQty = existingRecord.get('Quantity') || 0;
            newQuantity = currentQty + qty;
            
            // Update the existing record
            await base(process.env.INVENTORY_TABLE_NAME).update([
                {
                    id: inventoryRecordId,
                    fields: {
                        'Quantity': newQuantity,
                        'Part Name': partName,
                        'Reorder Point': rp,
                        'Unit Cost': cost,
                        'Location ID': locationID,
                        'Date Received': new Date().toISOString().split('T')[0] // Update receipt date
                    }
                }
            ]);

        } else {
            // Record does not exist (CREATE NEW)
            newQuantity = qty;
            const newRecord = await base(process.env.INVENTORY_TABLE_NAME).create([
                {
                    fields: {
                        'SKU': cleanSku,
                        'Part Name': partName,
                        'Quantity': newQuantity,
                        'Reorder Point': rp,
                        'Unit Cost': cost,
                        'Location ID': locationID,
                        'Date Received': new Date().toISOString().split('T')[0]
                    }
                }
            ]);
            inventoryRecordId = newRecord[0].id;
        }

        // 2. Log the transaction (Transaction Log Table)
        await base(process.env.TRANSACTION_LOG_TABLE_NAME).create([
            {
                fields: {
                    'Transaction Model': 'RECEIVE', // ✅ FIXED: Matches confirmed Airtable case
                    'Item SKU': cleanSku,
                    'Quantity Change': qty, 
                    'Related Inventory Item': [inventoryRecordId],
                    'Vendor Name': vendorName
                }
            }
        ]);
        
        return { success: true, message: `Successfully received ${qty} units of ${partName}. New stock level: ${newQuantity}.` };

    } catch (error) {
        console.error("Error creating receiving transaction:", error);
        return { success: false, message: `Failed to process receiving transaction: ${error.message}` };
    }
}

// Utility to issue stock
async function issueStock(itemSku, quantity) {
    const qty = parseInt(quantity);
    const cleanItemSku = (itemSku || '').trim().toLowerCase(); 
    
    console.log(`[ISSUE DEBUG] Attempting to issue ${qty} units of SKU: ${cleanItemSku}`);

    // 🚨 ROBUST VALIDATION CHECK 🚨
    if (!cleanItemSku || cleanItemSku.length < 3) {
        return { success: false, message: 'Item SKU must be provided and valid.' };
    }
    if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
        return { success: false, message: 'Quantity to issue must be a whole positive number.' };
    }
    // -------------------------------------------------------------------

    try {
        // 1. Find the inventory record
        const existingRecords = await base(process.env.INVENTORY_TABLE_NAME).select({
            filterByFormula: `{SKU} = '${cleanItemSku}'`,
            maxRecords: 1
        }).firstPage();

        if (existingRecords.length === 0) {
            return { success: false, message: `SKU '${itemSku}' not found in inventory.` };
        }

        const existingRecord = existingRecords[0];
        const inventoryRecordId = existingRecord.id;
        const currentQty = existingRecord.get('Quantity') || 0;
        const partName = existingRecord.get('Part Name');

        // 🚨 PRECONDITION CHECK 🚨
        if (currentQty < qty) {
            return { success: false, message: `Insufficient stock. Only ${currentQty} units of ${partName} available.` };
        }
        // -------------------------------------------------------------
        
        const newQuantity = currentQty - qty;

        // 2. Update the inventory record
        await base(process.env.INVENTORY_TABLE_NAME).update([
            {
                id: inventoryRecordId,
                fields: {
                    'Quantity': newQuantity
                }
            }
        ]);

        // 3. Log the transaction
        await base(process.env.TRANSACTION_LOG_TABLE_NAME).create([
            {
                fields: {
                    'Transaction Model': 'ISSUE', // ✅ FIXED: Changed to ISSUE (assuming all caps consistency)
                    'Item SKU': cleanItemSku,
                    'Quantity Change': -qty, // ✅ FIXED: Changed to negative quantity for correct logging
                    'Related Inventory Item': [inventoryRecordId],
                }
            }
        ]);

        return { success: true, message: `Successfully issued ${qty} units of ${partName}. Remaining stock: ${newQuantity}.` };

    } catch (error) {
        console.error("Error creating issuing transaction:", error);
        return { success: false, message: `Failed to process issuing transaction: ${error.message}` };
    }
}

module.exports = {
    createReceiving,
    issueStock
};