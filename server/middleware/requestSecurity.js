function createRateLimiter({
  windowMs = 60_000,
  maxRequests = 240,
} = {}) {
  const requestsByClient = new Map();

  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;

    for (const [client, entry] of requestsByClient) {
      if (entry.windowStartedAt < cutoff) requestsByClient.delete(client);
    }
  }, windowMs);
  cleanupTimer.unref();

  return function rateLimit(req, res, next) {
    const client = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = requestsByClient.get(client);

    if (!entry || now - entry.windowStartedAt >= windowMs) {
      entry = { count: 0, windowStartedAt: now };
      requestsByClient.set(client, entry);
    }

    entry.count += 1;
    res.setHeader(
      "RateLimit-Remaining",
      String(Math.max(0, maxRequests - entry.count))
    );

    if (entry.count > maxRequests) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((windowMs - (now - entry.windowStartedAt)) / 1000)))
      );
      return res.status(429).json({
        success: false,
        message: "Too many requests. Wait a moment and try again.",
      });
    }

    return next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
    ].join("; ")
  );

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }

  return next();
}

module.exports = {
  createRateLimiter,
  securityHeaders,
};
