import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { initDb, db, users } from "@workspace/db";

const JWT_SECRET = "trading-terminal-secret-key-change-me";

describe("Edge-to-Edge API Integration Tests", () => {
  let authToken: string;

  beforeAll(async () => {
    await initDb();
    // Insert mock user to satisfy foreign key constraints
    await db.insert(users).values({
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    }).onConflictDoNothing();

    // Generate a valid mock JWT token for the test user
    authToken = jwt.sign(
      {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  describe("Unauthenticated Access", () => {
    it("should allow access to health check endpoint", async () => {
      const res = await request(app).get("/api/healthz");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
    });

    it("should block access to protected routes", async () => {
      const res = await request(app).get("/api/signals");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("Authenticated Endpoints", () => {
    it("should fetch signals (GET /api/signals)", async () => {
      const res = await request(app)
        .get("/api/signals")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      // Since DB might be empty, it should at least return an array
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should filter signals by type (GET /api/signals?type=STOCK)", async () => {
      const res = await request(app)
        .get("/api/signals?type=STOCK")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should fail validation for bad filter (GET /api/signals?type=INVALID)", async () => {
      const res = await request(app)
        .get("/api/signals?type=INVALID")
        .set("Cookie", [`token=${authToken}`]);
      
      // Zod validation should fail with 400 or 500 depending on error handler
      // Usually zod errors result in a failure
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("should fetch watchlist (GET /api/watchlist)", async () => {
      const res = await request(app)
        .get("/api/watchlist")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    
    it("should fetch AI providers config (GET /api/ai-providers/status)", async () => {
      const res = await request(app)
        .get("/api/ai-providers/status")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("provider");
    });

    it("should fetch Conviction Picks (GET /api/conviction-picks)", async () => {
      const res = await request(app)
        .get("/api/conviction-picks")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("picks");
      expect(Array.isArray(res.body.picks)).toBe(true);
      expect(res.body.picks.length).toBeGreaterThan(0);

      const pick = res.body.picks[0];
      expect(pick).toHaveProperty("symbol");
      expect(pick).toHaveProperty("targetPrice");
      expect(pick).toHaveProperty("upsidePercent");
      expect(pick).toHaveProperty("consensus");
      expect(pick.upsidePercent).toBeGreaterThan(0);
    });

    it("should fetch Volume Shockers (GET /api/volume-shockers)", async () => {
      const res = await request(app)
        .get("/api/volume-shockers")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("shockers");
      expect(Array.isArray(res.body.shockers)).toBe(true);
      expect(res.body.shockers.length).toBeGreaterThan(0);

      const shocker = res.body.shockers[0];
      expect(shocker).toHaveProperty("symbol");
      expect(shocker).toHaveProperty("surgeMultiple");
      expect(shocker).toHaveProperty("deliveryPercent");
      expect(shocker).toHaveProperty("signal");
      expect(shocker.surgeMultiple).toBeGreaterThanOrEqual(2.0);
    });

    it("should fetch IPO Watch & GMP Tracker (GET /api/ipo)", async () => {
      const res = await request(app)
        .get("/api/ipo")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ipos");
      expect(Array.isArray(res.body.ipos)).toBe(true);
      expect(res.body.ipos.length).toBeGreaterThan(0);

      const ipo = res.body.ipos[0];
      expect(ipo).toHaveProperty("name");
      expect(ipo).toHaveProperty("issuePriceMin");
      expect(ipo).toHaveProperty("gmp");
      expect(ipo).toHaveProperty("status");
    });

    it("should fetch Gold, Silver & MCX Commodities (GET /api/commodities)", async () => {
      const res = await request(app)
        .get("/api/commodities")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("nationalGold24k");
      expect(res.body).toHaveProperty("nationalGold22k");
      expect(res.body).toHaveProperty("nationalSilver1kg");
      expect(res.body).toHaveProperty("cities");
      expect(Array.isArray(res.body.cities)).toBe(true);
      expect(res.body.cities.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty("mcxQuotes");
      expect(Array.isArray(res.body.mcxQuotes)).toBe(true);
      expect(res.body.nationalGold24k).toBeGreaterThan(50000);
    });

    it("should fetch Mutual Funds Explorer (GET /api/mutual-funds)", async () => {
      const res = await request(app)
        .get("/api/mutual-funds")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("funds");
      expect(Array.isArray(res.body.funds)).toBe(true);
      expect(res.body.funds.length).toBeGreaterThan(0);

      const fund = res.body.funds[0];
      expect(fund).toHaveProperty("name");
      expect(fund).toHaveProperty("amc");
      expect(fund).toHaveProperty("category");
      expect(fund).toHaveProperty("nav");
      expect(fund).toHaveProperty("returns1Y");
    });

    it("should fetch Live OI Tracker with Max Pain & PCR (GET /api/market/oi-tracker)", async () => {
      const res = await request(app)
        .get("/api/market/oi-tracker?symbol=NIFTY")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("symbol", "NIFTY");
      expect(res.body).toHaveProperty("underlyingPrice");
      expect(res.body).toHaveProperty("maxPainStrike");
      expect(res.body).toHaveProperty("overallPcr");
      expect(res.body).toHaveProperty("sentiment");
      expect(res.body).toHaveProperty("strikes");
      expect(Array.isArray(res.body.strikes)).toBe(true);
      expect(res.body.strikes.length).toBeGreaterThan(0);
    });

    it("should fetch Top Indices Quotes (GET /api/market/quotes?symbols=NIFTY,BANKNIFTY)", async () => {
      const res = await request(app)
        .get("/api/market/quotes?symbols=NIFTY,BANKNIFTY")
        .set("Cookie", [`token=${authToken}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
