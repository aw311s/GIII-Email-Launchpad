const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createUploadJob,
  getUploadJob,
} = require("../services/uploadJobService");

async function waitForTerminalJob(jobId) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = getUploadJob(jobId);
    if (["succeeded", "partial", "failed"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Job did not finish");
}

test("reuses an idempotent upload job and records asset progress", async () => {
  let runCount = 0;
  const args = {
    idempotencyKey: `test:${Date.now()}:idempotent`,
    initialAssets: [
      {
        assetType: "reference",
        assetName: "reference.jpg",
        assetPageUrl: "https://gcg.app.box.com/s/token/file/1",
      },
    ],
    run: async (progress) => {
      runCount += 1;
      progress({
        assetType: "reference",
        assetName: "reference.jpg",
        assetPageUrl: "https://gcg.app.box.com/s/token/file/1",
        status: "uploaded",
      });
      return {
        allSucceeded: true,
        uploadedImages: [{ assetName: "reference.jpg" }],
      };
    },
  };

  const first = createUploadJob(args);
  const second = createUploadJob(args);
  assert.equal(first.id, second.id);

  const finished = await waitForTerminalJob(first.id);
  assert.equal(runCount, 1);
  assert.equal(finished.status, "succeeded");
  assert.equal(finished.assets[0].status, "uploaded");
});

test("deduplicates simultaneous jobs for the same asset set", () => {
  const initialAssets = [
    {
      assetType: "reference",
      assetName: "reference.jpg",
      assetPageUrl: "https://gcg.app.box.com/s/token/file/11",
    },
  ];
  const run = async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { allSucceeded: true, uploadedImages: [] };
  };
  const first = createUploadJob({
    idempotencyKey: `test:${Date.now()}:first`,
    dedupeKey: "same-asset-set",
    initialAssets,
    run,
  });
  const second = createUploadJob({
    idempotencyKey: `test:${Date.now()}:second`,
    dedupeKey: "same-asset-set",
    initialAssets,
    run,
  });

  assert.equal(first.id, second.id);
});
