// api/index.js

// Import your existing Express application instance
const app = require('../server'); 

// Export the Express app instance. 
// Vercel recognizes this structure and wraps it as a Serverless Function.
module.exports = app;