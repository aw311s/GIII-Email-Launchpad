const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "";

export async function uploadBoxSlicesToKlaviyo({
  brandId,
  referenceImage = null,
  slices = [],
  existingUploadedImages = [],
}) {
  const response = await fetch(`${API_BASE}/api/klaviyo/upload-slices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brandId,
      referenceImage,
      slices,
      existingUploadedImages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to upload Box assets to Klaviyo");
  }

  return data;
}

export async function startBoxAssetUploadJob({
  brandId,
  referenceImage,
  slices,
  existingUploadedImages = [],
  idempotencyKey,
}) {
  const response = await fetch(`${API_BASE}/api/klaviyo/upload-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brandId,
      referenceImage,
      slices,
      existingUploadedImages,
      idempotencyKey,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Could not start the Klaviyo upload.");
  }

  return data.job;
}

export async function getBoxAssetUploadJob(jobId) {
  const response = await fetch(
    `${API_BASE}/api/klaviyo/upload-jobs/${encodeURIComponent(jobId)}`
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Could not check the Klaviyo upload.");
  }

  return data.job;
}
