const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function inspectBoxFolder(folderUrl) {
    const response = await fetch(`${API_BASE_URL}/api/box/inspect?url=${encodeURIComponent(folderUrl)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || "Failed to inspect Box folder");
    }
    return data;
}
