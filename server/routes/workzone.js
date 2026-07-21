const express = require("express");
const router = express.Router();
const workzoneService = require("../services/workzoneService");

router.get("/status", async (req, res) => {
    const status = await workzoneService.getStatus();
    res.json(status);
});

router.get("/test-connection", async (req, res) => {
  try {
    const token = await workzoneService.getAccessToken();

    res.json({
      success: true,
      message: "Successfully connected to Workzone.",
      tokenReceived: Boolean(token),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/project", async (req, res) => {
  const { brandId, projectName } = req.query;

  if (!brandId || !projectName) {
    return res.status(400).json({
      success: false,
      fallbackRequired: true,
      reason: "missing_lookup_input",
      message: "brandId and projectName are required",
    });
  }

  try {
    const project = await workzoneService.findProject({
      brandId,
      projectName,
    });

    return res.json({ success: true, project });
  } catch (error) {
    return res.status(error.statusCode || 503).json({
      success: false,
      fallbackRequired: error.fallbackRequired !== false,
      reason: error.reason || "lookup_failed",
      message: error.message,
    });
  }
});


module.exports = router;
