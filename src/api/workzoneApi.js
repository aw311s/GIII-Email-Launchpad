const API_BASE_URL = "http://localhost:5050";

export async function getWorkzoneStatus() {
    const response = await fetch(`${API_BASE_URL}/api/workzone/status`);
    if (!response.ok) {
        throw new Error("Failed to fetch Workzone status");
    }
    return response.json();
}