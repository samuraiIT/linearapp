import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../model/user.model";

const SECRET = process.env.JWT_SECRET || "linear-clone-dev-secret";

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: "30d" });
}

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      authUser?: any;
    }
  }
}

/**
 * Hard auth: rejects unauthenticated requests with 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).send({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string };
    UserModel.findById(payload.sub)
      .then((user) => {
        if (!user) return res.status(401).send({ message: "Unauthorized" });
        req.authUser = user;
        next();
      })
      .catch(() => res.status(401).send({ message: "Unauthorized" }));
  } catch (e) {
    return res.status(401).send({ message: "Invalid token" });
  }
}

/**
 * Soft auth: attaches req.authUser when a valid token is provided,
 * otherwise proceeds anonymously. Keeps the API backward-compatible
 * for public/demo usage while enabling per-user features.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next();
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string };
    UserModel.findById(payload.sub)
      .then((user) => {
        if (user) req.authUser = user;
        next();
      })
      .catch(() => next());
  } catch (e) {
    next();
  }
}
