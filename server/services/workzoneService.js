
const axios = require("axios");
const config = require("../config");

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let accessTokenPromise = null;
let cachedActiveProjects = null;
let cachedActiveProjectsExpiresAt = 0;
let workzoneRequestQueue = Promise.resolve();

const PROJECT_PAGE_SIZE = 500;
const PROJECT_CACHE_MS = 5 * 60 * 1000;
const projectMatchCache = new Map();
const projectPageCache = new Map();

async function getStatus() {
  const configured =
    Boolean(config.workzone.clientId) &&
    Boolean(config.workzone.clientSecret) &&
    Boolean(config.workzone.tokenUrl) &&
    Boolean(config.workzone.apiBaseUrl);


  if (!configured) {
    return {
      connected: false,
      configured: false,
      state: "not_configured",
      message: "Workzone is not configured. Manual drop-link entry is available.",
    };
  }

  try {
    await getAccessToken();
    return {
      connected: true,
      configured: true,
      state: "connected",
      message: "Workzone authentication succeeded.",
    };
  } catch {
    return {
      connected: false,
      configured: true,
      state: "connection_failed",
      message: "Workzone is configured, but authentication failed.",
    };
  }
}


async function requestAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const {
    clientId,
    clientSecret,
    tokenUrl,
    apiBaseUrl,
  } = config.workzone;


  const missingValues = [];


  if (!clientId) missingValues.push("WORKZONE_CLIENT_ID");
  if (!clientSecret) missingValues.push("WORKZONE_CLIENT_SECRET");
  if (!tokenUrl) missingValues.push("WORKZONE_TOKEN_URL");
  if (!apiBaseUrl) missingValues.push("WORKZONE_API_BASE_URL");


  if (missingValues.length > 0) {
    throw new Error(
      `Workzone is not configured. Missing: ${missingValues.join(", ")}`
    );
  }


  const params = new URLSearchParams();


  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("grant_type", "client_credentials");


  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 15_000,
    });


    const accessToken = response.data?.access_token;


    if (!accessToken) {
      throw new Error("Workzone did not return an access token");
    }


    cachedToken = accessToken;
    cachedTokenExpiresAt =
      Date.now() + Number(response.data?.expires_in || 3600) * 1000;
    return cachedToken;
  } catch (error) {
    if (error.response) {
      console.error(
        "Workzone authentication response:",
        error.response.status,
        error.response.data
      );
    }


    throw new Error(
      error.message === "Workzone did not return an access token"
        ? error.message
        : "Unable to authenticate with Workzone"
    );
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  if (!accessTokenPromise) {
    accessTokenPromise = requestAccessToken().finally(() => {
      accessTokenPromise = null;
    });
  }

  return accessTokenPromise;
}

function getApiHostname() {
  try {
    return new URL(config.workzone.apiBaseUrl).hostname;
  } catch {
    return "";
  }
}

function getProjectRows(data) {
  if (!Array.isArray(data)) return [];

  return data.filter(
    (row) =>
      row &&
      typeof row === "object" &&
      !Object.prototype.hasOwnProperty.call(row, "count")
  );
}

function normalizeProjectName(value) {
  return String(value || "")
    .replace(/\\\//g, "/")
    .toLowerCase()
    .replace(/\b20(\d{2})\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeWorkzoneText(value) {
  return String(value || "")
    .replace(/\\\//g, "/")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&#x2f;|&#47;/gi, "/")
    .replace(/<[^>]*>/g, " ");
}

function parseCopyLabels(value) {
  const text = normalizeWorkzoneText(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const nextLabel =
    String.raw`(?=\s+(?:SL|SUBJECT\s+LINE|PH|PREHEADER|BODY|BOD|HED|HEADER|CTA)\s*:|$)`;
  const subjectMatch = new RegExp(
    String.raw`(?:^|\s)(?:SL|SUBJECT\s+LINE)\s*:\s*(.*?)${nextLabel}`,
    "i"
  ).exec(text);
  const preheaderMatch = new RegExp(
    String.raw`(?:^|\s)(?:PH|PREHEADER)\s*:\s*(.*?)${nextLabel}`,
    "i"
  ).exec(text);

  return {
    subjectLine: subjectMatch?.[1]?.trim() || "",
    preheader: preheaderMatch?.[1]?.trim() || "",
  };
}

function findProvideCopy(tasks) {
  const provideCopyTasks = tasks.filter((task) => {
    const name = normalizeProjectName(task?.name || task?.taskName);
    return name === "provide copy" || name.includes("provide copy");
  });
  const parsedNotes = provideCopyTasks
    .map((task) => parseCopyLabels(task?.notes))
    .filter(({ subjectLine, preheader }) => subjectLine || preheader);

  return (
    parsedNotes.find(
      ({ subjectLine, preheader }) => subjectLine && preheader
    ) ||
    parsedNotes[0] || {
      subjectLine: "",
      preheader: "",
    }
  );
}

function extractBoxFolderUrls(value) {
  const text = normalizeWorkzoneText(value);
  const matches =
    text.match(
      /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:app\.)?box\.com\/s\/[a-z0-9_-]+(?:\/folder\/\d+)?/gi
    ) || [];

  return [
    ...new Set(
      matches.map((match) =>
        (match.startsWith("http") ? match : `https://${match}`).replace(
          /[),.;]+$/,
          ""
        )
      )
    ),
  ];
}

function findBoxFolderUrl(tasks) {
  const candidates = [];

  for (const task of tasks) {
    const preferredTask = /layout|asset|creative|drop|image/i.test(
      String(task?.name || "")
    );

    for (const value of Object.values(task || {})) {
      if (typeof value !== "string") continue;

      for (const url of extractBoxFolderUrls(value)) {
        candidates.push({
          url,
          preferredTask,
          explicitFolder: /\/folder\/\d+\/?$/i.test(url),
        });
      }
    }
  }

  const uniqueCandidates = [
    ...new Map(
      candidates.map((candidate) => [candidate.url, candidate])
    ).values(),
  ];
  if (uniqueCandidates.length === 0) return "";
  if (uniqueCandidates.length === 1) return uniqueCandidates[0].url;

  const preferred = uniqueCandidates.filter(
    (candidate) => candidate.preferredTask || candidate.explicitFolder
  );

  return preferred.length === 1 ? preferred[0].url : "";
}

function enqueueWorkzoneRequest(request) {
  const result = workzoneRequestQueue.then(request, request);
  workzoneRequestQueue = result.catch(() => {});
  return result;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function workzoneGet(path, params = {}) {
  const token = await getAccessToken();

  try {
    return await enqueueWorkzoneRequest(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await axios.get(`${config.workzone.apiBaseUrl}${path}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params,
            timeout: 30_000,
          });
        } catch (error) {
          if (error.response?.status === 404) return null;
          if (error.response?.status !== 429 || attempt === 2) throw error;

          const retryAfterSeconds = Number(
            error.response.headers?.["retry-after"]
          );
          const retryDelay = Number.isFinite(retryAfterSeconds)
            ? Math.min(retryAfterSeconds * 1000, 5_000)
            : 750 * (attempt + 1);
          await wait(retryDelay);
        }
      }

      return null;
    });
  } catch {
    const apiError = new Error("Unable to retrieve data from Workzone.");
    apiError.statusCode = 502;
    apiError.reason = "workzone_api_error";
    apiError.fallbackRequired = true;
    throw apiError;
  }
}

async function getActiveProjects() {
  if (
    cachedActiveProjects &&
    Date.now() < cachedActiveProjectsExpiresAt
  ) {
    return cachedActiveProjects;
  }

  const response = await workzoneGet("/projects", {
    page: 1,
    pageSize: PROJECT_PAGE_SIZE,
    projectState: "active",
  });

  cachedActiveProjects = getProjectRows(response?.data);
  cachedActiveProjectsExpiresAt = Date.now() + PROJECT_CACHE_MS;
  return cachedActiveProjects;
}

function findExactProject(projects, normalizedProjectName) {
  return projects.filter(
    (project) =>
      normalizeProjectName(project.projectName || project.name) ===
      normalizedProjectName
  );
}

function getBrandWorkspaceIds(
  activeProjects,
  brandId,
  normalizedProjectName
) {
  const brandPrefixes = {
    dkny: ["dkny email"],
    "karl-lagerfeld": ["karl lagerfeld email", "klp email"],
    "donna-karan": ["donna karan email", "dk email"],
  };
  const requestedPrefix = normalizedProjectName.replace(
    /\s+\d{1,2}\s+\d{1,2}\s+\d{2,4}$/,
    ""
  );
  const prefixes = [
    requestedPrefix,
    ...(brandPrefixes[brandId] || []),
  ].filter(Boolean);

  return [
    ...new Set(
      activeProjects
        .filter((project) => {
          const name = normalizeProjectName(
            project.projectName || project.name
          );
          return prefixes.some((prefix) => name.startsWith(prefix));
        })
        .map((project) => project.workspaceID)
        .filter(Boolean)
    ),
  ];
}

async function findHistoricalProject({
  brandId,
  normalizedProjectName,
  activeProjects,
}) {
  const cacheKey = `${brandId}:${normalizedProjectName}`;
  const cachedMatch = projectMatchCache.get(cacheKey);

  if (cachedMatch && Date.now() < cachedMatch.expiresAt) {
    return cachedMatch.project;
  }

  const workspaceIds = getBrandWorkspaceIds(
    activeProjects,
    brandId,
    normalizedProjectName
  );

  for (const workspaceID of workspaceIds) {
    for (let page = 1; page <= 20; page += 1) {
      const pageCacheKey = `${workspaceID}:${page}`;
      const cachedPage = projectPageCache.get(pageCacheKey);
      let projects;

      if (cachedPage && Date.now() < cachedPage.expiresAt) {
        projects = cachedPage.projects;
      } else {
        const response = await workzoneGet("/projects", {
          page,
          pageSize: PROJECT_PAGE_SIZE,
          projectState: "all",
          workspaceID,
        });
        projects = getProjectRows(response?.data);
        projectPageCache.set(pageCacheKey, {
          projects,
          expiresAt: Date.now() + PROJECT_CACHE_MS,
        });
      }
      const matches = findExactProject(
        projects,
        normalizedProjectName
      );

      if (matches.length > 1) {
        const error = new Error(
          "More than one Workzone project matched this campaign."
        );
        error.statusCode = 409;
        error.reason = "ambiguous_project";
        error.fallbackRequired = true;
        throw error;
      }

      if (matches.length === 1) {
        projectMatchCache.set(cacheKey, {
          project: matches[0],
          expiresAt: Date.now() + PROJECT_CACHE_MS,
        });
        return matches[0];
      }

      if (projects.length < PROJECT_PAGE_SIZE) break;
    }
  }

  return null;
}

async function getProjectTasks(projectID) {
  const response = await workzoneGet(`/projects/${projectID}/tasks`, {
    page: 1,
    pageSize: PROJECT_PAGE_SIZE,
  });

  return getProjectRows(response?.data);
}

async function findProject({ brandId, projectName }) {
  const normalizedProjectName = normalizeProjectName(projectName);
  const activeProjects = await getActiveProjects();
  const activeMatches = findExactProject(
    activeProjects,
    normalizedProjectName
  );

  if (activeMatches.length > 1) {
    const error = new Error(
      "More than one active Workzone project matched this campaign."
    );
    error.statusCode = 409;
    error.reason = "ambiguous_project";
    error.fallbackRequired = true;
    throw error;
  }

  const project =
    activeMatches[0] ||
    (await findHistoricalProject({
      brandId,
      normalizedProjectName,
      activeProjects,
    }));

  if (!project) {
    const error = new Error(
      `No Workzone project matched "${projectName}".`
    );
    error.statusCode = 404;
    error.reason = "project_not_found";
    error.fallbackRequired = true;
    throw error;
  }

  const tasks = await getProjectTasks(project.projectID);
  const copy = findProvideCopy(tasks);

  return {
    projectId: project.projectID,
    projectName: project.projectName || project.name || projectName,
    projectUrl: getApiHostname()
      ? `https://${getApiHostname()}`
      : "",
    boxFolderUrl: findBoxFolderUrl(tasks),
    subjectLine: copy.subjectLine,
    preheader: copy.preheader,
  };
}







module.exports = {
  getStatus,
  getAccessToken,
  findProject,
  extractBoxFolderUrls,
  findBoxFolderUrl,
  findProvideCopy,
  normalizeProjectName,
  parseCopyLabels,
};
