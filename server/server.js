const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });


const workzoneRoutes = require("./routes/workzone");
const sharepointRoutes = require("./routes/sharepoint");
const boxRoutes = require("./routes/box");
const klaviyoRoutes = require("./routes/klaviyo");
const temporaryAccess = require("./middleware/temporaryAccess");


const app = express();
const distPath = path.join(__dirname, "..", "dist");


app.disable("x-powered-by");

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(temporaryAccess);

if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.json({ limit: "1mb" }));


app.use("/api/workzone", workzoneRoutes);
app.use("/api/sharepoint", sharepointRoutes);
app.use("/api/box", boxRoutes);
app.use("/api/klaviyo", klaviyoRoutes);


app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  return res.sendFile(path.join(distPath, "index.html"));
});


const PORT = Number(process.env.PORT) || 5050;
const HOST = process.env.HOST || "0.0.0.0";


app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
