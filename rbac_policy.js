// rbac_policy.js

/*
|--------------------------------------------------------------------------
| RBAC Policy: Maps Roles to Dashboard Access
|--------------------------------------------------------------------------
|
| This configuration defines which of the 6 dashboards each department role
| is authorized to view. Management is implicitly granted ALL access.
|
| Dashboard Index (1-6) mapping:
| 1: Stock Overview (Value & Quantity)
| 2: Low Stock & Reorder Report
| 3: Transaction History Log
| 4: Inventory Turns & Aged Stock
| 5: Vendor Performance Tracking
| 6: Location Stock Breakdown
*/

const ACCESS_MAP = {
    'Management': [1, 2, 3, 4, 5, 6], // Access to ALL dashboards
    'Sales': [1, 6],                   // Stock Overview, Location Breakdown
    'Warehouse': [2, 3, 6],            // Low Stock, History, Location Breakdown
    'Procurement': [2, 5],             // Low Stock, Vendor Performance
    'Finance': [1, 4, 5],              // Stock Overview, Inventory Turns, Vendor Performance
    'Logistics': [3, 6]                // Transaction History, Location Breakdown
};

/**
 * Checks if a given role is authorized to view a specific dashboard.
 * @param {string} role - The user's role (e.g., 'Sales').
 * @param {number} dashboardNumber - The index of the dashboard (1-6).
 * @returns {boolean} True if the role is authorized.
 */
function isAuthorized(role, dashboardNumber) {
    const allowedDashboards = ACCESS_MAP[role];
    if (!allowedDashboards) {
        return false; // Role not recognized
    }
    
    // Management is explicitly defined to have all access, but this check handles it too.
    return allowedDashboards.includes(dashboardNumber);
}

module.exports = {
    isAuthorized,
    ACCESS_MAP 
};