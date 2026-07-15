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


module.exports = router;