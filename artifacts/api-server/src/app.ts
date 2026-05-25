import express, { type Express } from "express";
import cors from "cors";
import pinoHttp_ from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http default export interop across TS module resolution modes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoHttp = (pinoHttp_ as any).default ?? pinoHttp_;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id: string; method: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
