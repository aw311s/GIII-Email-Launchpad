import { getWorkzoneProject, getWorkzoneStatus } from "../../api/workzoneApi";

export async function loadWorkzoneStatus() {
    return getWorkzoneStatus();
}

export async function loadWorkzoneProject({ brandId, projectName }) {
    const response = await getWorkzoneProject({ brandId, projectName });
    return response.project;
}
