// reporting_logic.js (FINAL VERSION WITH ALL 6 DASHBOARD LOGIC)

const base = require('./airtable_utils');
const TABLE_NAME = process.env.INVENTORY_TABLE_NAME; 
const TRANSACTION_LOG_TABLE = process.env.TRANSACTION_LOG_TABLE_NAME || 'Transaction'; 


// --- DASHBOARD 1: STOCK OVERVIEW REPORT ---
async function getStockOverviewReport() {
    console.log('[REPORTING] Fetching Stock Overview Report...');
    try {
        const records = await base(TABLE_NAME).select({
            sort: [{field: "SKU", direction: "asc"}] 
        }).all();

        const reportData = records.map(record => {
            const quantity = record.get('Quantity') || 0;
            const unitCost = record.get('Unit Cost') || 0;
            const totalValue = quantity * unitCost;

            return {
                sku: record.get('SKU'),
                partName: record.get('Part Name'),
                quantity: quantity,
                unitCost: unitCost.toFixed(2),
                totalValue: totalValue.toFixed(2),
            };
        });

        console.log(`[REPORTING] Found ${reportData.length} stock items.`);
        return reportData;

    } catch (err) {
        console.error('[REPORTING] Error fetching stock overview data:', err.message);
        return [];
    }
}

// --- DASHBOARD 2: LOW STOCK REPORT ---
async function getLowStockReport() {
    console.log('[REPORTING] Fetching Low Stock Report...');
    try {
        const records = await base(TABLE_NAME).select({
            filterByFormula: '({Quantity} <= {Reorder Point})',
            sort: [{field: "Quantity", direction: "asc"}] 
        }).all();

        const reportData = records.map(record => ({
            sku: record.get('SKU'),
            partName: record.get('Part Name'),
            quantity: record.get('Quantity'),
            reorderPoint: record.get('Reorder Point'),
            location: record.get('Location ID')
        }));

        console.log(`[REPORTING] Found ${reportData.length} critical items.`);
        return reportData;

    } catch (err) {
        console.error('[REPORTING] Error fetching low stock data:', err.message);
        return [];
    }
}


// --- DASHBOARD 3: TRANSACTION HISTORY REPORT ---
async function getTransactionHistoryReport() {
    console.log('[REPORTING] Fetching Transaction History Report...');
    try {
        const records = await base(TRANSACTION_LOG_TABLE).select({
            sort: [{field: "Created Time", direction: "desc"}] 
        }).all();

        const reportData = records.map(record => ({
            timestamp: record.get('Timestamp'),
            sku: record.get('SKU'),
            model: record.get('Transaction Model'),
            quantityChange: record.get('Quantity Change'),
            inventoryRecordID: record.get('Inventory Record ID')
        }));

        console.log(`[REPORTING] Found ${reportData.length} history entries.`);
        return reportData;

    } catch (err) {
        console.error('[REPORTING] Error fetching history data:', err.message);
        return [];
    }
}


// --- DASHBOARD 4: INVENTORY TURNS & AGED STOCK REPORT ---
async function getInventoryTurnsReport() {
    console.log('[REPORTING] Fetching Inventory Turns and Aged Stock...');
    try {
        // --- 1. Calculate Simulated COGS (Total Cost of Items Issued) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const issuedRecords = await base(TRANSACTION_LOG_TABLE).select({
            filterByFormula: `AND({Transaction Model} = 'ISSUE', IS_AFTER({Created Time}, '${thirtyDaysAgo.toISOString().split('T')[0]}'))`
        }).all();
        
        let totalIssuedCost = 0;
        
        for (const logRecord of issuedRecords) {
            const sku = logRecord.get('SKU');
            const qtyIssued = Math.abs(logRecord.get('Quantity Change'));
            
            const inventoryRecord = await base(TABLE_NAME).select({
                filterByFormula: `{SKU} = '${sku}'`, maxRecords: 1
            }).firstPage();

            if (inventoryRecord.length > 0) {
                const unitCost = inventoryRecord[0].get('Unit Cost') || 0;
                totalIssuedCost += qtyIssued * unitCost;
            }
        }
        
        // --- 2. Get Average Inventory Value (using current Stock Overview value) ---
        const overview = await getStockOverviewReport();
        const currentInventoryValue = overview.reduce((sum, item) => sum + parseFloat(item.totalValue), 0);
        
        // Inventory Turns = COGS / Average Inventory
        const inventoryTurns = currentInventoryValue > 0 
            ? (totalIssuedCost / currentInventoryValue).toFixed(2) 
            : 0;

        // --- 3. Aged Stock (Items where Date Received is older than 90 days) ---
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const agedRecords = await base(TABLE_NAME).select({
            filterByFormula: `IS_BEFORE({Date Received}, '${ninetyDaysAgo.toISOString().split('T')[0]}')`
        }).all();
        
        const agedStockList = agedRecords.map(record => ({
            sku: record.get('SKU'),
            partName: record.get('Part Name'),
            quantity: record.get('Quantity') || 0,
            dateReceived: record.get('Date Received')
        }));

        console.log(`[REPORTING] Calculated Inventory Turns: ${inventoryTurns}, Found ${agedStockList.length} aged items.`);
        return {
            inventoryTurns: parseFloat(inventoryTurns),
            totalIssuedCost: totalIssuedCost.toFixed(2),
            currentInventoryValue: currentInventoryValue.toFixed(2),
            agedStockList: agedStockList
        };

    } catch (err) {
        console.error('[REPORTING] Error fetching inventory turns data:', err.message);
        return { inventoryTurns: 0, agedStockList: [] };
    }
}


// --- DASHBOARD 5: VENDOR PERFORMANCE TRACKING ---
async function getVendorPerformanceReport() {
    console.log('[REPORTING] Fetching Vendor Performance Report...');
    try {
        // Fetch all RECEIVE transactions
        const receiveRecords = await base(TRANSACTION_LOG_TABLE).select({
            filterByFormula: "{Transaction Model} = 'RECEIVE'",
            sort: [{field: "Created Time", direction: "desc"}] 
        }).all();
        
        const vendorMetrics = {};

        for (const logRecord of receiveRecords) {
            const vendor = logRecord.get('Vendor Name') || 'Unknown Vendor';
            const qtyReceived = logRecord.get('Quantity Change') || 0;
            const itemSKU = logRecord.get('SKU');
            
            // Look up Unit Cost from Inventory
            const inventoryRecord = await base(TABLE_NAME).select({
                filterByFormula: `{SKU} = '${itemSKU}'`, maxRecords: 1
            }).firstPage();

            let unitCost = 0;
            if (inventoryRecord.length > 0) {
                unitCost = inventoryRecord[0].get('Unit Cost') || 0;
            }
            const transactionValue = qtyReceived * unitCost;

            if (!vendorMetrics[vendor]) {
                vendorMetrics[vendor] = {
                    totalValue: 0,
                    totalQuantity: 0,
                    receiptCount: 0,
                };
            }
            
            vendorMetrics[vendor].totalValue += transactionValue;
            vendorMetrics[vendor].totalQuantity += qtyReceived;
            vendorMetrics[vendor].receiptCount += 1;
        }
        
        console.log(`[REPORTING] Found metrics for ${Object.keys(vendorMetrics).length} vendors.`);
        return vendorMetrics;

    } catch (err) {
        console.error('[REPORTING] Error fetching vendor performance data:', err.message);
        return {};
    }
}


// --- DASHBOARD 6: LOCATION BREAKDOWN REPORT ---
async function getLocationBreakdownReport() {
    console.log('[REPORTING] Fetching Location Breakdown Report...');
    try {
        const records = await base(TABLE_NAME).select({
            // No filter, get all
        }).all();

        const breakdown = {};
        
        records.forEach(record => {
            const location = record.get('Location ID') || 'Unassigned';
            
            const itemData = {
                sku: record.get('SKU'),
                partName: record.get('Part Name'),
                quantity: record.get('Quantity') || 0,
            };

            if (!breakdown[location]) {
                breakdown[location] = [];
            }
            breakdown[location].push(itemData);
        });

        const locationCount = Object.keys(breakdown).length;
        console.log(`[REPORTING] Found items in ${locationCount} locations.`);
        return breakdown;

    } catch (err) {
        console.error('[REPORTING] Error fetching location breakdown data:', err.message);
        return {};
    }
}


// Export all reporting functions
module.exports = {
    getStockOverviewReport,
    getLowStockReport,
    getTransactionHistoryReport,
    getInventoryTurnsReport,
    getVendorPerformanceReport,
    getLocationBreakdownReport,
};