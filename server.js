// server.js (FINAL, CORRECTED EXECUTION ORDER)



// server.js (Modification)

// ADD THIS LINE
const path = require('path');
// ADD THIS LINE
const appDir = path.dirname(require.main.filename); 

require('dotenv').config();

// 🚨🚨 CRITICAL FIX: INITIALIZE AIRTABLE BASE FIRST! 🚨🚨
// This MUST happen before any local module that uses the global.airtableBase variable.
require('./airtable_utils');
// ... (rest of the file remains the same) romove lines 5 = 17 for presentation locally





require('dotenv').config();

// 🚨🚨 CRITICAL FIX: INITIALIZE AIRTABLE BASE FIRST! 🚨🚨
// This MUST happen before any local module that uses the global.airtableBase variable.
require('./airtable_utils');

// 1. Core Express Setup
const express = require('express');
const expressLayouts = require('express-ejs-layouts'); 
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;


// 2. IMPORT AUTOMATION AND LOGIC MODULES (Now imported *after* Airtable is initialized)
const { lowStockReport } = require('./lowStockReport');
const { 
    getStockOverviewReport,
    getLowStockReport, 
    getTransactionHistoryReport, 
    getInventoryTurnsReport,
    getVendorPerformanceReport,
    getLocationBreakdownReport 
} = require('./reporting_logic'); 
const { createReceiving, issueStock } = require('./transaction_logic'); 
const { lookupUser } = require('./auth_logic'); 
const { isAuthorized, ACCESS_MAP } = require('./rbac_policy'); 

// 1. Configuration Data
const dashboardNames = [
    'Stock Overview (Value & Quantity)',
    'Low Stock & Reorder Report',
    'Transaction History Log',
    'Inventory Turns & Aged Stock',
    'Vendor Performance Tracking',
    'Location Stock Breakdown'
];

// --- MIDDLEWARE SETUP ---
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout'); 

app.use(session({
    secret: '8959b17a3498aa6fc8d0c8efa949dcf8',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } 
})); 

app.use(express.urlencoded({ extended: true })); 
app.use(express.static('public')); 


// --- AUTHENTICATION & ACCESS CONTROL MIDDLEWARE ---

function requireLogin(req, res, next) {
    if (req.session.user) {
        res.locals.currentUser = req.session.user; 
        res.locals.ACCESS_MAP = ACCESS_MAP; 
        res.locals.dashboards = dashboardNames; 
        
        next(); 
    } else {
        res.redirect('/login'); 
    }
}

// --- LOGIN/LOGOUT ROUTES ---
app.get('/login', (req, res) => {
    const errorMessage = req.query.error;
    res.render('login', { layout: false, title: 'Staff Login', error: errorMessage }); 
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await lookupUser(email, password); 

    if (user) {
        req.session.user = user; 
        res.redirect('/');
    } else {
        res.redirect('/login?error=Invalid credentials');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
});


// --- APPLICATION ROUTES (ALL PROTECTED) ---

// --- ROUTE HANDLER: Main Menu (Home Page) ---
app.get('/', requireLogin, async (req, res) => {
    const message = req.query.message;
    const status = req.query.status;
    
    res.render('mainMenu', { 
        title: 'System Main Menu',
        dashboards: dashboardNames,
        showSidebar: false,
        message: message, 
        status: status     
    });
});


// --- ROUTE HANDLER: Six Dedicated Dashboards (Unified Logic for Custom Templates) ---
app.get('/dashboard/:id', requireLogin, async (req, res) => {
    const dashboardId = parseInt(req.params.id);
    const userRole = req.session.user.role;
    const title = dashboardNames[dashboardId - 1];
    let reportData = null;
    let templateName = 'report_generic_table'; 

    // RBAC ENFORCEMENT CHECK
    if (!isAuthorized(userRole, dashboardId)) {
        console.log(`[RBAC DENY] Role ${userRole} attempted to access Dashboard ${dashboardId}.`);
        return res.status(403).render('accessDenied', { 
            title: 'Access Denied', 
            showSidebar: true
        });
    }

    // REPORTING LOGIC & TEMPLATE SELECTION
    switch (dashboardId) {
        case 1: // Stock Overview (KPIs and Value)
            reportData = await getStockOverviewReport();
            templateName = 'report_stock_overview'; 
            break;
            
        case 2: // Low Stock & Reorder Report
            reportData = await getLowStockReport();
            templateName = 'report_low_stock'; 
            break;

        case 3: // Transaction History Log
            reportData = await getTransactionHistoryReport();
            templateName = 'report_transaction_history'; 
            break;

        case 4: // Inventory Turns & Aged Stock
            reportData = await getInventoryTurnsReport();
            templateName = 'report_inventory_turns'; 
            break;

        case 5: // Vendor Performance Tracking
            reportData = await getVendorPerformanceReport();
            templateName = 'report_vendor_performance'; 
            break;

        case 6: // Location Stock Breakdown
            reportData = await getLocationBreakdownReport();
            templateName = 'report_location_breakdown';
            break;

        default:
            return res.redirect('/?message=Invalid dashboard ID.&status=error');
    }

    if (reportData && reportData.success === false) {
        return res.redirect(`/?message=${encodeURIComponent(reportData.message)}&status=error`);
    }
    
    // Render the report using the wrapper container and the selected template partial
    res.render('dashboard_container', {
        title: title,
        showSidebar: true, 
        dashboardNumber: dashboardId,
        reportData: reportData, 
        reportTemplate: templateName
    });
});


// --- TRANSACTION ROUTES (Receiving & Issuing) ---
app.get('/receive', requireLogin, (req, res) => {
    res.render('transactionForm', { 
        title: 'Receive Stock',
        formAction: '/api/receive',
        fields: ['itemSku', 'partName', 'quantity', 'reorderPoint', 'unitCost', 'locationID', 'vendorName'], 
        dashboards: dashboardNames,
        showSidebar: false 
    });
});

app.post('/api/receive', requireLogin, async (req, res) => {
    const formData = req.body;
    const result = await createReceiving(formData);
    
    // 🚨 AUTOMATION TRIGGER: Check stock and send email immediately after a successful receipt.
    if (result.success) {
        lowStockReport(); // Triggers external email/notification logic
    }

    res.redirect(`/?message=${encodeURIComponent(result.message)}&status=${result.success ? 'success' : 'error'}`);
});


app.get('/issue', requireLogin, (req, res) => {
    res.render('transactionForm', { 
        title: 'Issue Stock',
        formAction: '/api/issue',
        fields: ['sku', 'quantity'], 
        dashboards: dashboardNames,
        showSidebar: false 
    });
});

app.post('/api/issue', requireLogin, async (req, res) => {
    const { sku, quantity } = req.body;
    const result = await issueStock(sku, quantity);
    
    // 🚨 AUTOMATION TRIGGER: Check stock and send email immediately after a successful issue.
    if (result.success) {
        lowStockReport(); // Triggers external email/notification logic
    } 
    res.redirect(`/?message=${encodeURIComponent(result.message)}&status=${result.success ? 'success' : 'error'}`);
});


// 6. Start the server
/*p.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);*/
    
    // 🚨 STARTUP AUTOMATION: Run Low Stock Report on Server Startup 🚨
    /*
    lowStockReport(); */
    /*
}); */

// Export all reporting functions
module.exports = {
    getStockOverviewReport,
    getLowStockReport,
    getTransactionHistoryReport,
    getInventoryTurnsReport,
    getVendorPerformanceReport,
    getLocationBreakdownReport,
};

// AFTER DEPLOYMENT: Export the app for Vercel and Node.js
module.exports = app;
