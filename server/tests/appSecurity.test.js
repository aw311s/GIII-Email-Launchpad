const test = require("node:test");
const assert = require("node:assert/strict");
const temporaryAccess = require("../middleware/temporaryAccess");
const { securityHeaders } = require("../middleware/requestSecurity");

function createResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

test("applies API security headers", () => {
  const req = { path: "/api/box/status" };
  const res = createResponse();
  let continued = false;

  securityHeaders(req, res, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(
    res.headers.get("content-security-policy"),
    /default-src 'self'/
  );
});

test("rejects missing credentials and accepts valid Basic credentials", () => {
  const originalUsername = process.env.APP_ACCESS_USERNAME;
  const originalPassword = process.env.APP_ACCESS_PASSWORD;
  process.env.APP_ACCESS_USERNAME = "smoke";
  process.env.APP_ACCESS_PASSWORD = "smoke";

  try {
    const rejected = createResponse();
    temporaryAccess(
      { path: "/api/box/status", get: () => "" },
      rejected,
      () => {}
    );
    assert.equal(rejected.statusCode, 401);

    const accepted = createResponse();
    let continued = false;
    temporaryAccess(
      {
        path: "/api/box/status",
        get: () =>
          `Basic ${Buffer.from("smoke:smoke").toString("base64")}`,
      },
      accepted,
      () => {
        continued = true;
      }
    );
    assert.equal(continued, true);
  } finally {
    if (originalUsername === undefined) {
      delete process.env.APP_ACCESS_USERNAME;
    } else {
      process.env.APP_ACCESS_USERNAME = originalUsername;
    }
    if (originalPassword === undefined) {
      delete process.env.APP_ACCESS_PASSWORD;
    } else {
      process.env.APP_ACCESS_PASSWORD = originalPassword;
    }
  }
});
