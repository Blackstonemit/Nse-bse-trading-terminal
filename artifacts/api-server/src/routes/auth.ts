import { Router } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "trading-terminal-secret-key-change-me";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/google/callback";

router.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "mock") {
    // Redirect immediately to mock callback
    const callbackUrl = `/api/auth/google/callback?code=mock_auth_code`;
    res.redirect(callbackUrl);
    return;
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("email profile")}` +
    `&prompt=select_account`;
  
  res.redirect(googleAuthUrl);
});

router.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send("Authorization code is missing");
    return;
  }

  let profile: { id: string; email: string; name: string; picture?: string };

  if (code === "mock_auth_code") {
    // Generate mock profile for local development
    profile = {
      id: "mock-google-user-123",
      email: "mock.trader@nse-bse.local",
      name: "Mock Trader",
      picture: "https://avatar.vercel.sh/mock-trader"
    };
  } else {
    try {
      // Exchange code for token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        throw new Error(`Failed to exchange code: ${errorText}`);
      }

      const tokenData = await tokenRes.json() as { access_token: string };
      
      // Fetch user profile from Google UserInfo endpoint
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userRes.ok) {
        throw new Error("Failed to fetch user profile from Google");
      }

      const userData = await userRes.json() as { sub: string; email: string; name: string; picture?: string };
      profile = {
        id: userData.sub,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      };
    } catch (err) {
      req.log.error({ err }, "Google OAuth authentication failed");
      res.status(500).send("Authentication failed. Check backend logs.");
      return;
    }
  }

  try {
    // Create user if not exists or update current name/picture
    const [existingUser] = await db.select().from(users).where(eq(users.id, profile.id));
    if (!existingUser) {
      await db.insert(users).values({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture || null,
      });
    } else {
      await db.update(users).set({
        name: profile.name,
        picture: profile.picture || null,
      }).where(eq(users.id, profile.id));
    }

    // Sign JWT
    const token = jwt.sign(profile, JWT_SECRET, { expiresIn: "7d" });

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Must be false for local Electron HTTP localhost
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend root dashboard
    res.redirect("/");
  } catch (err) {
    req.log.error({ err }, "Failed to complete authentication database transaction");
    res.status(500).send("Internal server error during session registration.");
  }
});

router.get("/auth/session", (req: any, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "No active session" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

export default router;
