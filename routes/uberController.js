const express = require("express");
const router = express.Router();

const { getUberFareEstimates } = require("../service/uberScrapeService.js");

const { startRideSearch } = require("../service/uberRideSearch.js");

const { cancelUberRide } = require("../service/cancelUberRide.js");

router.get("/scrape-prices", (req, res, next) => {
  getUberFareEstimates(req, res, next);
});

router.post("/ride-search", (req, res, next) => {
  startRideSearch(req, res, next);
});

router.delete("/ride-cancel", (req, res, next) => {
  cancelUberRide(req, res, next);
});

module.exports = router;
