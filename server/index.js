const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const rateLimit = require('express-rate-limit');

// Rate Limiting: 10 requests per minute
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: true, message: "Too many requests. Please try again later." }
});

// Apply to all API routes
app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(express.json());

// Auth Middleware REMOVED (Single User Mode - Unrestricted)
// const authMiddleware = ...

// Apply Auth to ALL API routes (except health check if needed)
// app.use('/api', authMiddleware);

const Controller = require('./controller');

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/query', Controller.runQuery);
app.post('/api/sql', Controller.runRawSQL);
app.post('/api/manage-index', Controller.manageIndex);
app.post('/api/modify-data', Controller.modifyData);
app.get('/api/external', Controller.fetchExternalData);

// Serve Static Files (Production)
// In production, the server will serve the built React files from ../client/dist
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));

    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
