import {
  getBoxAssetUploadJob,
  startBoxAssetUploadJob,
} from "./klaviyoUploadApi";

const TERMINAL_STATUSES = new Set(["succeeded", "partial", "failed"]);
const POLL_INTERVAL_MS = 1000;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatUploadResult(result) {
  if (!result) return "The upload did not return a result.";

  if (result.allSucceeded) {
    const previewCount = result.uploadedImages.filter(
      (image) => image.source === "preview"
    ).length;
    return previewCount
      ? `Uploaded all ${result.expectedCount} asset(s) to Klaviyo. ${previewCount} used the Box preview fallback.`
      : `Uploaded all ${result.expectedCount} asset(s) to Klaviyo.`;
  }

  const failures = [
    result.failedReference
      ? `Reference: ${result.failedReference.error}`
      : "",
    ...result.failedSlices.map(
      ({ sliceName, error }) => `${sliceName}: ${error}`
    ),
  ].filter(Boolean);

  return `Uploaded ${result.uploadedImages.length} of ${result.expectedCount} asset(s). ${failures.join(" | ")}`;
}

export async function runBoxAssetUploadJob({
  brandId,
  referenceImage,
  slices,
  existingUploadedImages,
  onProgress,
}) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const idempotencyKey = `upload:${brandId}:${randomPart}`;
  let job = await startBoxAssetUploadJob({
    brandId,
    referenceImage,
    slices,
    existingUploadedImages,
    idempotencyKey,
  });
  const startedAt = Date.now();

  onProgress?.(job);

  while (!TERMINAL_STATUSES.has(job.status)) {
    if (Date.now() - startedAt > JOB_TIMEOUT_MS) {
      throw new Error(
        "The upload is still running on the server. Wait a moment before retrying."
      );
    }

    await sleep(POLL_INTERVAL_MS);
    job = await getBoxAssetUploadJob(job.id);
    onProgress?.(job);
  }

  if (!job.result) {
    throw new Error(job.error || "The upload job did not complete.");
  }

  return job.result;
}
