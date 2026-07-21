const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });


const workzoneRoutes = require("./routes/workzone");
const sharepointRoutes = require("./routes/sharepoint");
const boxRoutes = require("./routes/box");
const klaviyoRoutes = require("./routes/klaviyo");


const app = express();


app.use(cors());
app.use(express.json());


app.use("/api/workzone", workzoneRoutes);
app.use("/api/sharepoint", sharepointRoutes);
app.use("/api/box", boxRoutes);
app.use("/api/klaviyo", klaviyoRoutes);


app.get("/", (req, res) => {
  res.send("Campaign Prep API is running 🚀");
});


const PORT = 5050;


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



