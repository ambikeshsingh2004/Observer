const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const Controller = require('./controller');

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/query', Controller.runQuery);
app.post('/api/sql', Controller.runRawSQL);
app.post('/api/manage-index', Controller.manageIndex);

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
