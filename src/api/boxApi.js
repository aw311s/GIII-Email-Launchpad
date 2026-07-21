const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export async function inspectBoxFolder(folderUrl) {
    const response = await fetch(`${API_BASE_URL}/api/box/inspect?url=${encodeURIComponent(folderUrl)}`);
    if (!response.ok) {
        throw new Error("Failed to inspect Box folder");
    }
    return response.json();
}
