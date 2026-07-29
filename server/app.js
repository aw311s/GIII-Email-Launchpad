const express = require("express");
const cors = require("cors");
const path = require("path");
const workzoneRoutes = require("./routes/workzone");
const sharepointRoutes = require("./routes/sharepoint");
const boxRoutes = require("./routes/box");
const klaviyoRoutes = require("./routes/klaviyo");
const temporaryAccess = require("./middleware/temporaryAccess");
const {
  createRateLimiter,
  securityHeaders,
} = require("./middleware/requestSecurity");

function createApp() {
  const app = express();
  const distPath = path.join(__dirname, "..", "dist");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(createRateLimiter());
  app.use(securityHeaders);

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use(temporaryAccess);

  if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN }));
  }

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

  return app;
}

module.exports = {
  createApp,
};
