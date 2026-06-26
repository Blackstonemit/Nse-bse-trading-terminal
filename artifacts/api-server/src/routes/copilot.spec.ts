import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { initDb, db, users } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "trading-terminal-secret-key-change-me";

describe("Copilot AI Chat Integration Tests", () => {
  let authToken: string;
  let conversationId: number;

  beforeAll(async () => {
    await initDb();
    // Insert mock user to satisfy foreign key constraints
    await db.insert(users).values({
      id: "test-user-copilot",
      email: "copilot-test@example.com",
      name: "Copilot Test User",
    }).onConflictDoNothing();

    // Generate a valid mock JWT token for the test user
    authToken = jwt.sign(
      {
        id: "test-user-copilot",
        email: "copilot-test@example.com",
        name: "Copilot Test User",
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  it("should create a new conversation (POST /api/conversations)", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", [`token=${authToken}`])
      .send({ title: "Test Chat Session" });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "Test Chat Session");
    
    conversationId = res.body.id;
  });

  it("should fetch conversations list (GET /api/conversations)", async () => {
    const res = await request(app)
      .get("/api/conversations")
      .set("Cookie", [`token=${authToken}`]);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((c: any) => c.id === conversationId)).toBe(true);
  });

  it("should test the AI chat endpoint (POST /api/conversations/:id/chat)", async () => {
    // Note: Since we haven't configured a valid AI provider API key for 'test-user-copilot'
    // The endpoint should fall back to the default message indicating missing keys
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/chat`)
      .set("Cookie", [`token=${authToken}`])
      .send({ content: "What is the live price of RELIANCE?" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toHaveProperty("role", "assistant");
    expect(res.body.message.content).toContain("couldn't find any active AI Provider API Keys configured");
    expect(res.body).toHaveProperty("executedTools");
    expect(Array.isArray(res.body.executedTools)).toBe(true);
  });
  
  it("should fetch messages history (GET /api/conversations/:id/messages)", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set("Cookie", [`token=${authToken}`]);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // There should be two messages: the user's prompt and the assistant's fallback response
    expect(res.body.length).toBe(2);
    expect(res.body[0].role).toBe("user");
    expect(res.body[1].role).toBe("assistant");
  });
});
