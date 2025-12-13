// api/index.js (Vercel/Serverless Entry Point)

// 1. Load Environment Variables (Path adjusted for root directory context)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); 

const express = require('express');
const expressLayouts = require('express-ejs-layouts'); 
const session = require('express-session');
const app = express();
const path = require('path');
const bodyParser = require('body-parser'); // Not strictly needed if using express.urlencoded, but included for completeness

// Import Logic Modules
const { 
    getStockOverviewReport,
    getLowStockReport, 
    getTransactionHistoryReport, 
    getInventoryTurnsReport,
    getVendorPerformanceReport,
    getLocationBreakdownReport 
} = require('../reporting_logic'); 
const { createReceiving, issueStock } = require('../transaction_logic'); 
const { lookupUser } = require('../auth_logic'); 
const { isAuthorized, ACCESS_MAP } = require('../rbac_policy'); 

// 1. Configuration Data (Copied from server.js)
const dashboardNames = [
    'Stock Overview (Value & Quantity)',
    'Low Stock & Reorder Report',
    'Transaction History Log',
    'Inventory Turns & Aged Stock',
    'Vendor Performance Tracking',
    'Location Stock Breakdown'
];

// --- MIDDLEWARE SETUP ---
// Adjust paths to correctly reference 'views' and 'public' from the api folder context
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', path.join(__dirname, '../views/layout')); // Explicitly set path for layout

app.use(session({
    secret: process.env.SESSION_SECRET || 'A_DEFAULT_FALLBACK_SECRET', // Use environment variable for secret
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' } // Secure cookies in production
})); 

// Use express's built-in parser instead of body-parser for simplicity
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, '../public'))); 


// --- AUTHENTICATION & ACCESS CONTROL MIDDLEWARE (Copied from server.js) ---

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

// --- LOGIN/LOGOUT ROUTES (Copied from server.js) ---
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
        } else if (routeNumber === 5) { 
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

// IMPORTANT: Define POST route using a non-API URL for redirect consistency
app.post('/api/receive', requireLogin, async (req, res) => {
    // The transaction logic handles the form submission
    const result = await createReceiving(req.body);
    // Redirect to the home page with a status message
    res.redirect('/?status=' + encodeURIComponent(result.message));
});

app.get('/issue', requireLogin, (req, res) => {
    res.render('transactionForm', { 
        title: 'Issue Stock',
        formAction: '/api/issue',
        fields: ['itemSku', 'quantity'], 
        dashboards: dashboardNames,
        showSidebar: false 
    });
});

app.post('/api/issue', requireLogin, async (req, res) => {
    // The issueStock function only needs the SKU and quantity
    const { itemSku, quantity } = req.body;
    const result = await issueStock(itemSku, quantity);
    // Redirect to the home page with a status message
    res.redirect('/?status=' + encodeURIComponent(result.message));
});


// --- ERROR HANDLERS ---
// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        title: '404 Not Found', 
        message: 'The page you are looking for does not exist.', 
        showSidebar: true
    });
});

// Generic Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: '500 Internal Server Error',
        message: 'Something broke! Check the server logs.',
        showSidebar: true
    });
});


// 6. EXPORT THE APP INSTANCE (CRITICAL FOR VERCEL)
// Vercel will import this and run it as a serverless function.
module.exports = app;