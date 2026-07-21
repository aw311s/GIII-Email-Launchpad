const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

export async function uploadBoxSlicesToKlaviyo({
  brandId,
  referenceImage = null,
  slices = [],
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
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to upload Box assets to Klaviyo");
  }

  return data;
}

