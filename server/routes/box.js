const express = require("express");
const router = express.Router();
const config = require("../config");
const boxService = require("../services/boxService");
const { parseBoxSharedUrl } = require("../services/boxUrlService");

function normalizeSlice(slice, index) {
  return {
    name:
      slice?.name ||
      slice?.fileName ||
      slice?.filename ||
      slice?.title ||
      `slice-${index + 1}`,
    url:
      slice?.url ||
      slice?.downloadUrl ||
      slice?.href ||
      slice?.imageUrl ||
      "",
    downloadUrl:
      slice?.downloadUrl ||
      slice?.url ||
      slice?.href ||
      "",
    pageUrl:
      slice?.pageUrl ||
      slice?.url ||
      slice?.href ||
      "",
    id: slice?.id || null,
  };
}

router.get("/status", (req, res) => {
  const officialApiConfigured = Boolean(
    config.box.clientId &&
      config.box.clientSecret &&
      config.box.enterpriseId
  );

  res.json({
    connected: config.box.integrationMode === "playwright",
    configured: true,
    state: config.box.integrationMode === "playwright"
      ? "connected"
      : officialApiConfigured
        ? "configured"
        : "not_configured",
    mode: config.box.integrationMode,
    officialApiConfigured,
    officialApiReady: false,
    message:
      config.box.integrationMode === "playwright"
        ? "Box public-link browser fallback is active."
        : "Official Box API credentials are reserved but the provider requires IT approval.",
  });
});

router.get("/inspect", async (req, res) => {
  try {
    const requestedUrl = parseBoxSharedUrl(req.query.url, "folder").url;
    const assets = await boxService.inspectSharedBoxFolder(requestedUrl);

    const box = {
      folderUrl: assets?.folderUrl || requestedUrl,
      referenceJpgName: assets?.referenceJpgName || "",
      referenceJpgUrl: assets?.referenceJpgUrl || "",
      referenceJpgDownloadUrl: assets?.referenceJpgDownloadUrl || "",
      slicesFolderName: assets?.slicesFolderName || "",
      slicesFolderUrl: assets?.slicesFolderUrl || "",
      slices: Array.isArray(assets?.slices)
        ? assets.slices.map(normalizeSlice).filter((slice) => Boolean(slice.url))
        : [],
    };

    res.json({
      success: true,
      assets: box,
      box,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      reason: error.reason || "box_inspection_failed",
    });
  }
});

module.exports = router;
