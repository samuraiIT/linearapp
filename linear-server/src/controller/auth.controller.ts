import { Request, Response, Router } from "express";
import bcrypt from "bcryptjs";
import UserModel from "../model/user.model";
import WorkspaceModel from "../model/workspace.model";
import TeamModel from "../model/team.model";
import { requireAuth, signToken } from "../middleware/auth";

const router = Router();

function sanitize(user: any) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

/**
 * POST /auth/signup
 * Creates the first workspace + team (if none exist), registers a user,
 * returns { token, user }.
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, name, workspaceName, teamName, teamIdentifier } = req.body;
    if (!email || !password) {
      return res.status(400).send({ message: "Email and password are required" });
    }
    const existing = await UserModel.findOne({ email });
    if (existing) {
      // Account exists — invite flow could go here; for simplicity log in if password matches
      const ok = existing.password ? await bcrypt.compare(password, existing.password) : false;
      if (!ok) return res.status(401).send({ message: "Wrong password" });
      const token = signToken(existing._id!.toString());
      return res.status(200).send({ token, user: sanitize(existing) });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Bootstrap workspace if this is the very first user
    let workspace = await WorkspaceModel.findOne();
    if (!workspace) {
      const urlKey =
        (workspaceName || name || "my")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "workspace";
      workspace = await WorkspaceModel.create({
        name: workspaceName || `${name || email.split("@")[0]}'s workspace`,
        urlKey,
      });
    }

    const user = await UserModel.create({
      name: name || email.split("@")[0],
      displayName: name || email.split("@")[0],
      email,
      password: hashed,
      role: "admin",
    });

    // Bootstrap default team if none exist
    let teamCount = await TeamModel.countDocuments();
    if (teamCount === 0) {
      const identifier = (teamIdentifier || "ENG").toUpperCase().slice(0, 5);
      const team = await TeamModel.create({
        name: teamName || "Engineering",
        identifier,
        members: [user._id],
      });
      user.teams = [team._id as any];
      await user.save();
    }

    const token = signToken(user._id!.toString());
    return res.status(201).send({ token, user: sanitize(user), workspace });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /auth/login
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ message: "Email and password are required" });
    }
    const user = await UserModel.findOne({ email }).populate("teams");
    if (!user) return res.status(404).send({ message: "User not found" });
    // Users created before auth (no password) can't log in with password
    if (!user.password) return res.status(400).send({ message: "Account has no password set" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).send({ message: "Invalid credentials" });
    const token = signToken(user._id!.toString());
    return res.status(200).send({ token, user: sanitize(user) });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * GET /auth/me — current authenticated user
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await UserModel.findById(req.authUser._id).populate("teams");
    const workspace = await WorkspaceModel.findOne();
    return res.status(200).send({ user: sanitize(user), workspace });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * PATCH /auth/me — update profile/preferences of current user
 */
router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const allowed = ["name", "displayName", "avatar", "timezone", "preferences"];
    const updates: any = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    if (req.body.password) {
      if (!req.authUser.password) {
        return res.status(400).send({ message: "Current password required to change password" });
      }
      const ok = await bcrypt.compare(req.body.currentPassword || "", req.authUser.password);
      if (!ok) return res.status(401).send({ message: "Current password is wrong" });
      updates.password = await bcrypt.hash(req.body.password, 10);
    }
    const user = await UserModel.findByIdAndUpdate(req.authUser._id, updates, { new: true });
    return res.status(200).send({ user: sanitize(user) });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;
