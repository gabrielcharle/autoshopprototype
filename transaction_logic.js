// transaction_logic.js (FINAL AND ROBUST)

const base = require('./airtable_utils'); 
const INVENTORY_TABLE = process.env.INVENTORY_TABLE_NAME; 
const TRANSACTION_LOG_TABLE = process.env.TRANSACTION_LOG_TABLE_NAME || 'Transaction'; 

/**
 * Creates or updates an inventory record and logs a RECEIVE transaction.
 * @param {Object} formData - Form data including itemSku, quantity, unitCost, vendorName, etc.
 */
async function createReceiving(formData) {
    // 1. Destructure the form data. Assumes form field name is 'itemSku'.
    const { itemSku, partName, quantity, reorderPoint, unitCost, locationID, vendorName } = formData;

    // 2. Clean variables and parse quantity
    const cleanItemSku = (itemSku || '').trim(); 
    const qty = parseInt(quantity);
    
    // 3. ENHANCED VALIDATION CHECK
    if (!cleanItemSku || qty <= 0 || !partName || !vendorName) { 
        return { success: false, message: 'Missing required data (Item SKU, Part Name, Quantity, or Vendor).' };
    }

    try {
        // 4. Search for existing inventory item using the new, clean field name
        let existingRecord = await base(INVENTORY_TABLE).select({
            filterByFormula: `{Input SKU} = '${cleanItemSku}'`, 
            maxRecords: 1
        }).firstPage();

        let recordId;
        
        if (existingRecord.length > 0) {
            // 4a. Update existing record (Increase quantity)
            recordId = existingRecord[0].id;
            const currentQty = existingRecord[0].get('Quantity') || 0;
            const newQty = currentQty + qty;

            await base(INVENTORY_TABLE).update([
                {
                    id: recordId,
                    fields: {
                        'Quantity': newQty,
                        'Unit Cost': parseFloat(unitCost),
                        'Reorder Point': parseInt(reorderPoint),
                        'Location ID': locationID,
                    }
                }
            ]);
        } else {
            // 4b. Create new inventory record
            const newRecord = await base(INVENTORY_TABLE).create([
                {
                    fields: {
                        'Input SKU': cleanItemSku, // Writing to the new, clean SKU field
                        'Part Name': partName,
                        'Quantity': qty,
                        'Unit Cost': parseFloat(unitCost),
                        'Reorder Point': parseInt(reorderPoint),
                        'Location ID': locationID,
                        'Date Received': new Date().toISOString().split('T')[0]
                    }
                }
            ]);
            recordId = newRecord[0].id;
        }

        // 5. Log the transaction 
        await base(TRANSACTION_LOG_TABLE).create([
            {
                fields: {
                    //'Transaction SKU': cleanItemSku, // Writing to the new, clean SKU field
                    'Quantity Change': qty, 
                    'Transaction Model': 'RECEIVE',
                    //'Item SKU': [//recordId], // Assumes linked field is named 'Inventory'
                    'Vendor Name': vendorName
                }
            }
        ]);

        return { success: true, message: `Successfully received ${qty} units of SKU ${cleanItemSku} from ${vendorName}.` };
    } catch (error) {
        console.error('Airtable transaction error (RECEIVE):', error.message);
        return { success: false, message: `Failed to process receipt for SKU ${cleanItemSku}. Error: ${error.message}` };
    }
}


/**
 * Decrements stock quantity and logs an ISSUE transaction.
 * @param {string} itemSku - The SKU to issue (from a form input).
 * @param {string} quantity - The quantity to issue (from a form input).
 */
async function issueStock(itemSku, quantity) {
    const qty = parseInt(quantity);
    const cleanItemSku = (itemSku || '').trim(); 

    if (!cleanItemSku || qty <= 0) {
        return { success: false, message: 'Item SKU and Quantity must be valid.' };
    }
    
    try {
        // 1. Find the inventory record using the new, clean field name
        let existingRecord = await base(INVENTORY_TABLE).select({
            filterByFormula: `{Input SKU} = '${cleanItemSku}'`,
            maxRecords: 1
        }).firstPage();

        if (existingRecord.length === 0) {
            return { success: false, message: `Item SKU ${cleanItemSku} not found in inventory.` };
        }

        const record = existingRecord[0];
        const recordId = record.id;
        const currentQty = record.get('Quantity') || 0;
        
        if (currentQty < qty) {
            return { success: false, message: `Cannot issue ${qty} units. Only ${currentQty} units of Item SKU ${cleanItemSku} available.` };
        }

        // 2. Update existing record (Decrease quantity)
        const newQty = currentQty - qty;

        await base(INVENTORY_TABLE).update([
            {
                id: recordId,
                fields: {
                    'Quantity': newQty,
                }
            }
        ]);

        // 3. Log the transaction
        await base(TRANSACTION_LOG_TABLE).create([
            {
                fields: {
                    //'Transaction SKU': cleanItemSku, // Writing to the new, clean SKU field
                    'Quantity Change': -qty, // Negative change for ISSUE
                    'Transaction Model': 'ISSUE',
                    //'Input SKU': [recordId], // Assumes linked field is named 'Inventory'
                    'Vendor Name': 'N/A' 
                }
            }
        ]);

        return { success: true, message: `Successfully issued ${qty} units of Item SKU ${cleanItemSku}. New quantity: ${newQty}.` };
    } catch (error) {
        console.error('Airtable transaction error (ISSUE):', error.message);
        return { success: false, message: `Failed to issue stock for Item SKU ${cleanItemSku}. Error: ${error.message}` };
    }
}

module.exports = {
    createReceiving,
    issueStock
};