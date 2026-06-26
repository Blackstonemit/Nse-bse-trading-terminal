import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth-middleware";
import authRouter from "./auth";
import healthRouter from "./health";
import marketRouter from "./market";
import analysisRouter from "./analysis";
import signalsRouter from "./signals";
import watchlistRouter from "./watchlist";
import agentRouter from "./agent";
import schedulerRouter from "./scheduler";
import aiProvidersRouter from "./ai-providers";
import paperTradingRouter from "./paper-trading";
import copilotRouter from "./copilot";
import bhavcopyRouter from "./bhavcopy";
import fundamentalsRouter from "./fundamentals";
import newsRouter from "./news";
import orderflowRouter from "./orderflow";

const router: IRouter = Router();

// Protect all API endpoints with Google OAuth JWT middleware
router.use(authMiddleware);

router.use(authRouter);
router.use(healthRouter);
router.use(marketRouter);
router.use(analysisRouter);
router.use(signalsRouter);
router.use(watchlistRouter);
router.use(agentRouter);
router.use(schedulerRouter);
router.use(aiProvidersRouter);
router.use(paperTradingRouter);
router.use(copilotRouter);
router.use(bhavcopyRouter);
router.use(fundamentalsRouter);
router.use("/news", newsRouter);
router.use("/orderflow", orderflowRouter);

export default router;
