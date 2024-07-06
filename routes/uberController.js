const express = require("express");
const router = express.Router();

const { getUberFareEstimates } = require("../service/uberScrapeService.js");

const { startRideSearch } = require("../service/uberRideSearch.js");

router.get("/scrape-prices", (req, res, next) => {
  getUberFareEstimates(req, res, next);
});

router.post("/ride-search", (req, res, next) => {
  startRideSearch(req, res, next);
});

module.exports = router;
