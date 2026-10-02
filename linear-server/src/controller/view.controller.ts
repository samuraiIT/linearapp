import { Request, Response, Router } from "express";
import TicketModel from "../model/ticket.model";
import ActivityModel from "../model/activity.model";

const router = Router();

/**
 * GET /view/search?q=&team= — global search across issues and projects
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { q, team } = req.query;
    if (!q) return res.status(200).send({ issues: [], projects: [] });
    // Lazy import to avoid circulars
    const ProjectModel = (await import("../model/project.model")).default;
    const query: any = {
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { issueId: { $regex: q, $options: "i" } },
      ],
    };
    if (team) query.team = team;
    const issues = await TicketModel.find(query)
      .populate("assignee")
      .populate("team")
      .limit(20);
    const projects = await ProjectModel.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ],
    }).limit(10);
    return res.status(200).send({ issues, projects });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /view/quick — quick-create issue (Linear's "C" shortcut modal).
 * Body: { team, title, status?, priority?, assignee? }
 */
router.post("/quick", async (req: Request, res: Response) => {
  try {
    const TeamModel = (await import("../model/team.model")).default;
    const team = await TeamModel.findById(req.body.team);
    if (!team) return res.status(404).send({ message: "Team not found" });
    const count = await TicketModel.countDocuments({ team: team._id });
    const createdBy = req.body.createdBy || (req as any).authUser?._id;
    const ticket = await TicketModel.create({
      ...req.body,
      createdBy,
      issueId: `${team.identifier}-${count + 1}`,
      status: req.body.status || "TODO",
    });
    await ActivityModel.create({
      type: "issue_created",
      issue: ticket._id,
      user: ticket.createdBy || ticket.assignee || req.body.user,
      team: team._id,
      data: { issueId: ticket.issueId },
    }).catch(() => {});
    const populated = await TicketModel.findById(ticket._id)
      .populate("team")
      .populate("assignee")
      .populate("labels");
    return res.status(201).send(populated);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * GET /view/inbox — issues the current (or ?user=) user is subscribed to,
 * with latest activity as "notifications".
 */
router.get("/inbox", async (req: Request, res: Response) => {
  try {
    const SubscriberModel = (await import("../model/subscriber.model")).default;
    const userId = (req.query.user as string) || (req as any).authUser?._id;
    if (!userId) return res.status(200).send([]);
    const subs = await SubscriberModel.find({ user: userId }).select("issue").sort("-createdAt");
    const ids = subs.map((s: any) => s.issue);
    const issues = await TicketModel.find({ _id: { $in: ids } })
      .populate("assignee")
      .populate("team")
      .populate("labels")
      .sort("-updatedAt")
      .limit(50);
    const activities = await ActivityModel.find({ issue: { $in: ids } })
      .populate("user")
      .sort("-createdAt")
      .limit(100);
    // Merge: one inbox item per issue, enriched with its latest activity
    const byIssue: Record<string, any> = {};
    for (const a of activities) {
      const key = String((a as any).issue?._id || (a as any).issue);
      if (!byIssue[key]) byIssue[key] = { issue: null, notifications: [] };
      byIssue[key].notifications.push(a);
    }
    const result = issues.map((i: any) => ({
      ...(byIssue[String(i._id)] || { notifications: [] }),
      issue: i,
    }));
    return res.status(200).send(result);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;
