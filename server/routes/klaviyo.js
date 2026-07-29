const express = require("express");
const crypto = require("crypto");
const {
  createAssetDescriptors,
  getKlaviyoStatus,
  uploadBoxAssets,
  validateUploadRequest,
} = require("../services/klaviyoUploadService");
const {
  createUploadJob,
  getUploadJob,
} = require("../services/uploadJobService");
const { createRateLimiter } = require("../middleware/requestSecurity");

const router = express.Router();
const uploadStartLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 12,
});

router.get("/status", (req, res) => {
  res.json(getKlaviyoStatus());
});

router.post("/upload-jobs", uploadStartLimiter, (req, res) => {
  try {
    const { idempotencyKey, ...payload } = req.body || {};
    const validated = validateUploadRequest(payload);
    const initialAssets = createAssetDescriptors(
      validated.referenceImage,
      validated.slices
    ).map(({ assetType, assetName, assetPageUrl }) => ({
      assetType,
      assetName,
      assetPageUrl,
    }));
    const job = createUploadJob({
      idempotencyKey,
      dedupeKey: crypto
        .createHash("sha256")
        .update(
          [
            validated.brandId,
            ...initialAssets.map(({ assetPageUrl }) => assetPageUrl),
          ].join("|")
        )
        .digest("hex"),
      initialAssets,
      run: (onProgress) => uploadBoxAssets(validated, { onProgress }),
    });

    return res.status(202).json({ success: true, job });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Could not start the Klaviyo upload.",
      reason: error.reason || "upload_start_failed",
    });
  }
});

router.get("/upload-jobs/:jobId", (req, res) => {
  const job = getUploadJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Upload job not found or expired.",
    });
  }

  return res.json({ success: true, job });
});

router.post("/upload-slices", uploadStartLimiter, async (req, res) => {
  try {
    const result = await uploadBoxAssets(req.body || {});
    return res.json(result);
  } catch (error) {
    console.error("Klaviyo upload error:", error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Failed to upload assets to Klaviyo",
      reason: error.reason || "upload_failed",
    });
  }
});

module.exports = router;
