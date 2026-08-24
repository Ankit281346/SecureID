require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const registrationRoutes = require('./routes/registrationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Mount IAM Registration Routes
app.use('/api', registrationRoutes);

// Fallback for Single Page App navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(` Truly IAS - IAM Auth Server (Part 1)`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Server running on: http://localhost:${PORT}`);
    console.log(`=================================`);
  });
}

module.exports = app;
