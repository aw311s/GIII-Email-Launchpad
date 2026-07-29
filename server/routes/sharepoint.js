const express = require("express");
const sharepointService = require("../services/sharepointService");

const router = express.Router();


router.get("/status", async (req, res) => {
  const status = await sharepointService.getStatus({
    verify: req.query.verify === "true",
  });
  res.json(status);
});

router.get("/workbook/:brandId", async (req, res) => {
  try {
    const workbook = await sharepointService.getWorkbookForBrand(
      req.params.brandId
    );

    res.setHeader("Content-Type", workbook.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${workbook.fileName.replace(/"/g, "")}"`
    );
    return res.send(workbook.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      fallbackRequired: error.fallbackRequired !== false,
      reason: error.reason || "lookup_failed",
      message: error.message,
      missingConfig: error.missingConfig || [],
    });
  }
});


module.exports = router;



