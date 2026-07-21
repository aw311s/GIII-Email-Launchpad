const express = require("express");
const router = express.Router();
const boxService = require("../services/boxService");

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

router.get("/inspect", async (req, res) => {
  try {
    const { url } = req.query;
    const assets = await boxService.inspectSharedBoxFolder(url);

    const box = {
      folderUrl: assets?.folderUrl || url || "",
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;


