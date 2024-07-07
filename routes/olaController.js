const express = require("express");
const router = express.Router();

const { startRideSearch } = require("../service/olaRideSearch.js");

router.post("/ride-search", (req, res, next) => {
  startRideSearch(req, res, next);
});

module.exports = router;
