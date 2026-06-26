import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import cookieParser from "cookie-parser";
import compression from "compression";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(compression());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve static files from the React build
const staticPath = path.join(__dirname, "../../market-dashboard/dist/public");
logger.info({ staticPath }, "Serving static files from");
app.use(express.static(staticPath));

// Catch-all route to serve the React app
app.get("/*path", (_req, res) => {
  const indexPath = path.join(staticPath, "index.html");
  res.sendFile(indexPath);
});

export default app;
