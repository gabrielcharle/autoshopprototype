// server.js (FINAL VERSION: ALL 6 DASHBOARDS, AUTHENTICATION, AND RBAC)
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts'); 
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

// Import Logic Modules
const { 
    getStockOverviewReport,
    getLowStockReport, 
    getTransactionHistoryReport, 
    getInventoryTurnsReport,
    getVendorPerformanceReport, // <<< D5 IMPORT
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
    secret: 'A_STRONG_SECRET_KEY_GOES_HERE', 
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
    res.render('mainMenu', { 
        title: 'System Main Menu',
        dashboards: dashboardNames,
        showSidebar: false 
    });
});


// --- ROUTE HANDLER: Six Dedicated Dashboards ---
dashboardNames.forEach((name, index) => {
    const routeNumber = index + 1;
    app.get(`/dashboard/${routeNumber}`, requireLogin, async (req, res) => {
        
        const userRole = req.session.user.role;
        
        // RBAC ENFORCEMENT CHECK
        if (!isAuthorized(userRole, routeNumber)) {
            console.log(`[RBAC DENY] Role ${userRole} attempted to access Dashboard ${routeNumber}.`);
            return res.status(403).render('accessDenied', { 
                title: 'Access Denied', 
                showSidebar: true
            });
        }
        
        // REPORTING LOGIC: All 6 Dashboards now handled
        let reportData = null;
        if (routeNumber === 1) { 
            reportData = await getStockOverviewReport();
        } else if (routeNumber === 2) {
            reportData = await getLowStockReport();
        } else if (routeNumber === 3) {
            reportData = await getTransactionHistoryReport();
        } else if (routeNumber === 4) { 
            reportData = await getInventoryTurnsReport();
        } else if (routeNumber === 5) { // <<< DASHBOARD 5 ROUTING
            reportData = await getVendorPerformanceReport();
        } else if (routeNumber === 6) { 
            reportData = await getLocationBreakdownReport();
        }
        
        res.render('singleDashboard', {
            title: name,
            dashboards: dashboardNames,
            showSidebar: true, 
            dashboardNumber: routeNumber,
            data: reportData 
        });
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
    
    res.redirect(`/?message=${encodeURIComponent(result.message)}&status=${result.success ? 'success' : 'error'}`);
});


// 6. Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    //console.log(`Access at http://localhost:${port}`);
});
