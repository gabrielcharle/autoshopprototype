// reporting_logic.js

// FINAL FIX: Access the globally initialized Airtable Base object
const base = global.airtableBase; 

// Helper to safely get the Airtable table connection 
function getInventoryTable() {
    return base(process.env.INVENTORY_TABLE_NAME);
}

// 1. Stock Overview Report (Adding Chart Data for Location Value Breakdown)
async function getStockOverviewReport() {
    try {
        const records = await getInventoryTable().select({
            fields: ['SKU', 'Part Name', 'Quantity', 'Location ID', 'Unit Cost', 'Reorder Point'],
            maxRecords: 100 
        }).all();

        let totalValue = 0;
        const locationBreakdown = {}; // For Chart Data: Value by Location

        const data = records.map(record => {
            const qty = record.get('Quantity') || 0;
            const cost = record.get('Unit Cost') || 0;
            const location = record.get('Location ID') || 'Unassigned';
            const itemValue = qty * cost;
            
            totalValue += itemValue;

            // Aggregation for Chart: Group by Location and sum value
            locationBreakdown[location] = (locationBreakdown[location] || 0) + itemValue;

            return {
                sku: record.get('SKU'),
                partName: record.get('Part Name'),
                quantity: qty,
                locationId: location,
                unitCost: cost.toFixed(2),
                reorderPoint: record.get('Reorder Point') || 0,
                value: itemValue.toFixed(2)
            };
        });

        // Format chart data: Convert object to array of {label, value} pairs
        const locationChartData = Object.keys(locationBreakdown).map(location => ({
            label: location,
            value: locationBreakdown[location].toFixed(2)
        }));

        return { 
            success: true, 
            data: data,
            totalInventoryValue: totalValue.toFixed(2),
            locationChartData: locationChartData // <-- NEW CHART DATA
        };
    } catch (error) {
        console.error("Error generating Stock Overview report:", error);
        return { success: false, message: "Failed to load stock overview data." };
    }
}

// 2. Low Stock Report (Used for console/email trigger)
async function getLowStockReport() {
    try {
        const lowStockRecords = await getInventoryTable().select({
            fields: ['SKU', 'Part Name', 'Quantity', 'Reorder Point', 'Location ID'],
            filterByFormula: 'NOT({Quantity} >= {Reorder Point})',
            sort: [{field: "Quantity", direction: "asc"}],
        }).all();

        const metrics = lowStockRecords.map(record => ({
            sku: record.get('SKU'),
            partName: record.get('Part Name'),
            quantity: record.get('Quantity') || 0,
            reorderPoint: record.get('Reorder Point') || 0,
            locationId: record.get('Location ID')
        }));
        
        // Chart Data: Simple categorization for a pie chart/bar chart
        const criticalCount = metrics.length;
        const lowStockChartData = [
            { label: 'Critical Items', value: criticalCount },
            { label: 'Items OK', value: 100 - criticalCount } // Placeholder for full picture
        ];

        return { 
            success: true, 
            criticalCount: criticalCount, 
            metrics: metrics,
            lowStockChartData: lowStockChartData // <-- NEW CHART DATA
        };

    } catch (error) {
        console.error("Error generating Low Stock report:", error);
        return { success: false, message: "Failed to load low stock data." };
    }
}


// 3. Transaction History Report (Placeholder)
// reporting_logic.js - getTransactionHistoryReport() (FINAL VERSION with Mapping)

async function getTransactionHistoryReport() {
    const base = global.airtableBase; 
    
    try {
        const records = await base(process.env.TRANSACTION_LOG_TABLE_NAME).select({
            fields: ['Created Time', 'Transaction Model', 'Item SKU', 'Quantity Change', 'Vendor Name', 'Unit Cost'], 
            sort: [{field: "Created Time", direction: "desc"}], 
            maxRecords: 50
        }).all();

        // ----------------------------------------------------------------
        // CRITICAL STEP: MAP raw Airtable records to a simple array of objects
        // ----------------------------------------------------------------
        const mappedData = records.map(record => {
            const qtyChange = record.get('Quantity Change') || 0;
            const cost = record.get('Unit Cost') || 0;
            const transactionModel = record.get('Transaction Model') || 'UNKNOWN';

            return {
                Date: record.get('Created Time') ? new Date(record.get('Created Time')).toLocaleString() : 'N/A',
                Type: transactionModel,
                SKU: record.get('Item SKU'),
                Quantity: qtyChange,
                Value: (qtyChange * cost).toFixed(2), // Calculate transaction value
                Vendor: record.get('Vendor Name') || 'N/A',
            };
        });

        // Return the clean, mapped data
        return { success: true, data: mappedData };

    } catch (error) {
        console.error("Error generating Transaction History report:", error);
        return { success: false, message: "Failed to load transaction history data." };
    }
}


// 4. Inventory Turns & Aged Stock (Adding Chart Data for Aged Stock Distribution)
// reporting_logic.js - getInventoryTurnsReport() (FINAL VERSION with KPI Calculations)

async function getInventoryTurnsReport() {
    const base = global.airtableBase;
    
    try {
        const records = await base(process.env.INVENTORY_TABLE_NAME).select({
            // Include Unit Cost for value calculations
            fields: ['SKU', 'Part Name', 'Quantity', 'Unit Cost', 'Date Received', 'Last Issue Date'], 
        }).all();

        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        // --- Aggregation & Mapping Initialization ---
        let totalInventoryValue = 0;
        let agedStockValue = 0;
        let totalIssuedQuantity = 0; // Placeholder for Turns calculation
        let totalInventoryCost = 0; // Used for DIO calculation

        const mappedData = records.map(record => {
            const quantity = record.get('Quantity') || 0;
            const unitCost = record.get('Unit Cost') || 0;
            const itemValue = quantity * unitCost;
            
            // 1. Calculate Total Value
            totalInventoryValue += itemValue;
            totalInventoryCost += itemValue; 
            
            // 2. Calculate Age and Aged Value
            const dateReceived = record.get('Date Received');
            let daysOld = 0;
            if (dateReceived) {
                const date = new Date(dateReceived);
                daysOld = Math.floor((new Date() - date) / MS_PER_DAY);
            }
            
            if (daysOld > 30) {
                agedStockValue += itemValue;
            }
            
            // Categorize age for the bar chart
            let ageCategory;
            if (daysOld < 30) {
                ageCategory = '0-30 Days';
            } else if (daysOld < 90) {
                ageCategory = '31-90 Days';
            } else if (daysOld < 180) {
                ageCategory = '91-180 Days';
            } else {
                ageCategory = '180+ Days';
            }

            return {
                sku: record.get('SKU'),
                partName: record.get('Part Name'),
                quantity: quantity,
                value: itemValue.toFixed(2), // Detail table requires item value
                ageDays: daysOld,
                ageCategory: ageCategory,
                lastIssued: record.get('Last Issue Date') || 'N/A'
            };
        });
        
        // --- Final KPI Calculations ---
        
        // **NOTE:** Inventory Turns and DIO require annual sales/COGS data, which is unavailable in the inventory table.
        // We will use standard dummy values/placeholders until that data is integrated.
        
        // DUMMY DATA FOR TURNS/DIO (Requires Transaction/COGS data for real value)
        const averageCOGS = 50000; // Placeholder: Avg annual cost of goods sold (COGS)
        const avgInventory = totalInventoryCost > 0 ? totalInventoryCost : 1; // Avoid division by zero
        
        const inventoryTurns = (averageCOGS / avgInventory).toFixed(2);
        const dio = (365 / parseFloat(inventoryTurns)).toFixed(0); 

        // Return the final data structure, including the aggregated KPIs
        return { 
            success: true, 
            data: mappedData, // Detail table and chart data
            totalInventoryValue: totalInventoryValue.toFixed(2),
            agedStockValue: agedStockValue.toFixed(2),
            inventoryTurns: inventoryTurns,
            dio: dio 
        };

    } catch (error) {
        console.error("Error generating Inventory Turns report:", error);
        return { success: false, message: "Failed to load Inventory Turns data due to a server error." };
    }
}


// 5. Vendor Performance Tracking (No Chart Data added, primary metrics are the onTimePercentage array)
// reporting_logic.js - getVendorPerformanceReport() (FINAL VERSION for Dashboard 5)

// reporting_logic.js - getVendorPerformanceReport() (FINAL FIX: Reads from new Vendor Metrics table)

async function getVendorPerformanceReport() {
    const base = global.airtableBase; 
    
    // NOTE: This function assumes a new table named 'Vendor Metrics' is set up
    const VENDOR_METRICS_TABLE = 'Vendor Metrics'; 

    try {
        // Fetch all records from the new Vendor Metrics table
        const records = await base(VENDOR_METRICS_TABLE).select({
            // Fetching all necessary scoring fields
            fields: ['Vendor', 'Quality Score', 'Delivery Score', 'Cost Adherence', 'Measurement Date'],
        }).all();

        // Object to hold aggregated (averaged) data for each vendor
        const vendorAggregates = {};

        records.forEach(record => {
            // Vendor is a Linked Record field, so we access the array element [0]
            const vendorName = record.get('Vendor') ? record.get('Vendor')[0] : 'Unknown Vendor';
            
            // Get score values (using the confirmed field names from the new table)
            const quality = record.get('Quality Score') || 0; 
            const delivery = record.get('Delivery Score') || 0; 
            const cost = record.get('Cost Adherence') || 0; 
            
            if (!vendorAggregates[vendorName]) {
                vendorAggregates[vendorName] = { 
                    totalQuality: 0, 
                    totalDelivery: 0, 
                    totalCost: 0, 
                    count: 0 
                };
            }
            
            // Sum the scores for later averaging
            vendorAggregates[vendorName].totalQuality += quality;
            vendorAggregates[vendorName].totalDelivery += delivery;
            vendorAggregates[vendorName].totalCost += cost;
            vendorAggregates[vendorName].count += 1;
        });

        // Map aggregated data into the final structured report
        const mappedData = Object.keys(vendorAggregates).map(vendorName => {
            const agg = vendorAggregates[vendorName];
            const count = agg.count;
            
            // Calculate the average score for each metric
            const avgDelivery = (agg.totalDelivery / count).toFixed(1);
            const avgQuality = (agg.totalQuality / count).toFixed(1);
            const avgCost = (agg.totalCost / count).toFixed(1);
            
            // Calculate Overall Score: Average of the three metrics
            const overallScore = ((parseFloat(avgDelivery) + parseFloat(avgQuality) + parseFloat(avgCost)) / 3).toFixed(1);

            return {
                vendorName: vendorName,
                deliveryScore: parseFloat(avgDelivery),
                qualityScore: parseFloat(avgQuality),
                costAdherence: parseFloat(avgCost),
                overallScore: parseFloat(overallScore)
            };
        }).filter(item => item.vendorName !== 'Unknown Vendor')
          .sort((a, b) => b.overallScore - a.overallScore); // Rank vendors by score

        return { success: true, data: mappedData };

    } catch (error) {
        console.error("Error generating Vendor Performance report:", error);
        return { success: false, message: "Failed to load vendor performance data." };
    }
}

// 6. Location Stock Breakdown (Adding Chart Data for Quantity Breakdown)
async function getLocationBreakdownReport() {
    try {
        const records = await getInventoryTable().select({
            fields: ['SKU', 'Part Name', 'Quantity', 'Location ID'],
            filterByFormula: '{Quantity} > 0',
        }).all();
        
        const locationQuantityBreakdown = {}; // For Chart Data

        const data = records.map(record => {
            const qty = record.get('Quantity') || 0;
            const location = record.get('Location ID') || 'Unassigned';

            // Aggregation for Chart: Group by Location and sum quantity
            locationQuantityBreakdown[location] = (locationQuantityBreakdown[location] || 0) + qty;
            
            return {
                sku: record.get('SKU'),
                partName: record.get('Part Name'),
                quantity: qty,
                locationId: location
            };
        });

        // Format chart data: Convert object to array of {label, value} pairs
        const locationChartData = Object.keys(locationQuantityBreakdown).map(location => ({
            label: location,
            value: locationQuantityBreakdown[location]
        }));


        return { 
            success: true, 
            data: data,
            locationChartData: locationChartData // <-- NEW CHART DATA
        };

    } catch (error) {
        console.error("Error generating Location Breakdown report:", error);
        return { success: false, message: "Failed to load location breakdown data." };
    }
}

module.exports = {
    getStockOverviewReport,
    getLowStockReport,
    getTransactionHistoryReport,
    getInventoryTurnsReport,
    getVendorPerformanceReport,
    getLocationBreakdownReport,
};