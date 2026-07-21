const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

export async function fetchBrandWorkbookFromSharePoint(brandId) {
  const response = await fetch(
    `${API_BASE}/api/sharepoint/workbook/${encodeURIComponent(brandId)}`
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(
      data.message || "SharePoint workbook lookup failed"
    );
    error.fallbackRequired = data.fallbackRequired !== false;
    error.reason = data.reason || "lookup_failed";
    error.missingConfig = data.missingConfig || [];
    throw error;
  }

  return response.blob();
}
