import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "trading-terminal-secret-key-change-me";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const path = req.path;
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };
      req.user = decoded;
    } catch (err) {
      // Ignore token validation errors for health checks and auth routes, but block other routes
      if (!(path === "/healthz" || path.startsWith("/auth/"))) {
        res.status(401).json({ error: "Unauthorized. Session expired or invalid." });
        return;
      }
    }
  }

  // Allow health check and authentication routes to bypass mandatory authorization check
  if (
    path === "/healthz" ||
    path.startsWith("/auth/")
  ) {
    return next();
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized. Missing session token." });
    return;
  }

  next();
}
