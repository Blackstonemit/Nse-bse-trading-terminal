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
  });
});
