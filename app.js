const express = require("express");
const cors = require("cors");
const uberRoutes = require("./routes/uberController.js");

const app = express();
const port = 3000;

app.use(cors());

app.use("/uber", uberRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
