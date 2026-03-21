import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./adminRoutes";
import { setupVite, serveStatic, log } from "./vite";
import { logger } from "./logger";

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ SIEM-aware HTTP logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.info("http_request", {
        reqIp: req.ip,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        user_agent: req.headers["user-agent"],
        event: {
          action: "http_request",
          outcome: res.statusCode < 400 ? "success" : "failure",
        },
      });
    }
  });
  next();
});

(async () => {
  const server = await registerRoutes(app);
  registerAdminRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error("server_error", {
      message,
      status,
      stack: err.stack,
      event: { action: "server_error", outcome: "failure" },
    });

    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); }
  );
})();