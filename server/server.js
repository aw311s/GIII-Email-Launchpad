const express = require("express");
const cors = require("cors");
require("dotenv").config();
const workzoneRoutes = require("./routes/workzone");
const sharepointRoutes = require("./routes/sharepoint");
const boxRoutes = require("./routes/box");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/workzone", workzoneRoutes);
app.use("/api/sharepoint", sharepointRoutes);
app.use("/api/box", boxRoutes);
app.get("/", (req, res) => {
    res.send("Campaign Prep API is running 🚀");
});

const PORT = 5050;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


