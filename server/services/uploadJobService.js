const crypto = require("crypto");

const JOB_TTL_MS = 60 * 60 * 1000;
const MAX_JOBS = 100;
const jobs = new Map();
const jobIdByIdempotencyKey = new Map();
const activeJobIdByDedupeKey = new Map();
let runnerQueue = Promise.resolve();

function pruneJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;

  for (const [jobId, job] of jobs) {
    if (job.updatedAt < cutoff) {
      jobs.delete(jobId);
      if (job.idempotencyKey) {
        jobIdByIdempotencyKey.delete(job.idempotencyKey);
      }
      if (job.dedupeKey) activeJobIdByDedupeKey.delete(job.dedupeKey);
    }
  }

  while (jobs.size > MAX_JOBS) {
    const oldestJobId = jobs.keys().next().value;
    const oldest = jobs.get(oldestJobId);
    jobs.delete(oldestJobId);
    if (oldest?.idempotencyKey) {
      jobIdByIdempotencyKey.delete(oldest.idempotencyKey);
    }
    if (oldest?.dedupeKey) activeJobIdByDedupeKey.delete(oldest.dedupeKey);
  }
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    assets: Array.from(job.assets.values()),
    result: job.result,
    error: job.error,
  };
}

function getUploadJob(jobId) {
  pruneJobs();
  const job = jobs.get(jobId);
  return job ? publicJob(job) : null;
}

function createUploadJob({
  idempotencyKey,
  dedupeKey,
  initialAssets,
  run,
}) {
  pruneJobs();

  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(idempotencyKey || "")) {
    const error = new Error("A valid idempotencyKey is required.");
    error.statusCode = 400;
    throw error;
  }

  const existingJobId = jobIdByIdempotencyKey.get(idempotencyKey);
  if (existingJobId) {
    const existing = jobs.get(existingJobId);
    if (existing) return publicJob(existing);
  }

  const activeJobId = dedupeKey
    ? activeJobIdByDedupeKey.get(dedupeKey)
    : null;
  if (activeJobId) {
    const activeJob = jobs.get(activeJobId);
    if (activeJob && ["queued", "running"].includes(activeJob.status)) {
      jobIdByIdempotencyKey.set(idempotencyKey, activeJob.id);
      return publicJob(activeJob);
    }
  }

  const now = Date.now();
  const job = {
    id: crypto.randomUUID(),
    idempotencyKey,
    dedupeKey,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    assets: new Map(
      initialAssets.map((asset) => [
        asset.assetPageUrl,
        { ...asset, status: "pending" },
      ])
    ),
    result: null,
    error: null,
  };

  jobs.set(job.id, job);
  jobIdByIdempotencyKey.set(idempotencyKey, job.id);
  if (dedupeKey) activeJobIdByDedupeKey.set(dedupeKey, job.id);

  setImmediate(() => {
    const execute = async () => {
      job.status = "running";
      job.updatedAt = Date.now();

      try {
        job.result = await run((progress) => {
          const previous = job.assets.get(progress.assetPageUrl) || {};
          job.assets.set(progress.assetPageUrl, {
            ...previous,
            ...progress,
          });
          job.updatedAt = Date.now();
        });
        job.status = job.result.allSucceeded
          ? "succeeded"
          : job.result.uploadedImages.length
            ? "partial"
            : "failed";
      } catch (error) {
        job.status = "failed";
        job.error = error.message || "Upload job failed.";
      } finally {
        job.updatedAt = Date.now();
        if (job.dedupeKey) activeJobIdByDedupeKey.delete(job.dedupeKey);
      }
    };

    runnerQueue = runnerQueue.then(execute, execute);
  });

  return publicJob(job);
}

module.exports = {
  createUploadJob,
  getUploadJob,
};
