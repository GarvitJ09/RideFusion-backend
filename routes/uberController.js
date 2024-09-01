// routes/uberController.js
const express = require('express');
const router = express.Router();

const { getUberFareEstimates } = require('../service/uberScrapeService.js');
const { startRideSearch } = require('../service/uberRideSearch.js');
const { cancelUberRide } = require('../service/cancelUberRide.js');
const { performLogin } = require('../service/uberLogin.js');

// HTTP endpoint for login
router.get('/login', (req, res, next) => {
  performLogin(req, res, next);
});

// WebSocket endpoint for login
router.ws('/login', (ws, req) => {
  ws.on('message', async (message) => {
    console.log('Received WebSocket message:', message);

    if (message === 'performLogin') {
      await performLogin(null, ws);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});
// Other routes
router.get('/scrape-prices', (req, res, next) => {
  getUberFareEstimates(req, res, next);
});

router.post('/ride-search', (req, res, next) => {
  startRideSearch(req, res, next);
});

router.delete('/ride-cancel', (req, res, next) => {
  cancelUberRide(req, res, next);
});

module.exports = router;
