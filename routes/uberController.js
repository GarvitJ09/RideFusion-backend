const express = require("express");
const router = express.Router();

const { getUberFareEstimates } = require("../service/uberScrapeService.js");

router.get("/scrape-prices", (req, res, next) => {
  getUberFareEstimates(req, res, next);
});

module.exports = router;
