import { Router, type IRouter } from "express";
import { globalCache } from "../lib/cache.js";
import { fetchLiveIpoData, type IpoItem } from "../lib/ipo-service.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export type { IpoItem };

router.get("/ipo", async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const cacheKey = "api:ipo-data";

    if (!isRefresh) {
      const cached = globalCache.get<IpoItem[]>(cacheKey);
      if (cached && cached.length > 0) {
        res.json({
          ipos: cached,
          cached: true,
          total: cached.length,
          lastUpdated: new Date().toISOString(),
        });
        return;
      }
    }

    const liveIpos = await fetchLiveIpoData();
    globalCache.set(cacheKey, liveIpos, 5 * 60 * 1000); // 5 min TTL

    res.json({
      ipos: liveIpos,
      cached: false,
      total: liveIpos.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to fetch live IPO data");
    res.status(500).json({ error: "Failed to load IPO data" });
  }
});

export default router;
