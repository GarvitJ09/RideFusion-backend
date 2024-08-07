const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const uberRoutes = require("./routes/uberController.js");
const olaRoutes = require("./routes/olaController.js");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use("/uber", uberRoutes);
app.use("/ola", olaRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
