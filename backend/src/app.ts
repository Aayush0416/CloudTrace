import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { spec } from "./docs";
import { errorHandler } from "./middleware";
import auth from "./routes/auth";
import projects from "./routes/projects";

export const app = express();
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec)); // mounted before helmet: Swagger UI needs inline scripts
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "5mb" }));
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  auth,
);
app.use("/api/projects", projects);
app.use(errorHandler);
