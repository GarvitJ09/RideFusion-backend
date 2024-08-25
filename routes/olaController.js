const express = require("express");
const router = express.Router();

const { startRideSearch } = require("../service/olaRideSearch.js");

const { cancelOlaRide } = require("../service/cancelOlaRide.js");

router.post("/ride-search", (req, res, next) => {
  startRideSearch(req, res, next);
});

router.post("/ride-cancel", (req, res, next) => {
  cancelOlaRide(req, res, next);
});

module.exports = router;
