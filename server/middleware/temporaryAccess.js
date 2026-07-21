const crypto = require("crypto");

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function rejectAccess(req, res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Email Launchpad"');

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  return res.status(401).send("Authentication required");
}

function temporaryAccess(req, res, next) {
  const expectedUsername = process.env.APP_ACCESS_USERNAME;
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).send(
        "Email Launchpad access protection is not configured."
      );
    }

    return next();
  }

  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Basic ")) return rejectAccess(req, res);

  let decoded = "";
  try {
    decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  } catch {
    return rejectAccess(req, res);
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return rejectAccess(req, res);

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (
    !safeEqual(username, expectedUsername) ||
    !safeEqual(password, expectedPassword)
  ) {
    return rejectAccess(req, res);
  }

  return next();
}

module.exports = temporaryAccess;
