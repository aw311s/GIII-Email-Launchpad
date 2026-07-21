const API_BASE_URL = "http://localhost:5050";

export async function getWorkzoneStatus() {
    const response = await fetch(`${API_BASE_URL}/api/workzone/status`);
    if (!response.ok) {
        throw new Error("Failed to fetch Workzone status");
    }
    return response.json();
}

export async function getWorkzoneProject({ brandId, projectName }) {
    const params = new URLSearchParams({ brandId, projectName });
    const response = await fetch(
        `${API_BASE_URL}/api/workzone/project?${params.toString()}`
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.message || "Workzone project lookup failed");
        error.fallbackRequired = data.fallbackRequired !== false;
        error.reason = data.reason || "lookup_failed";
        throw error;
    }

    return data;
}
