import { Request, Response, Router } from "express";
import TicketModel from "../model/ticket.model";
import ActivityModel from "../model/activity.model";
import TeamModel from "../model/team.model";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      team,
      assignee,
      status,
      priority,
      project,
      cycle,
      label,
      search,
      createdBy,
      subscriber,
      dueBefore,
      dueAfter,
      createdAtAfter,
      sortBy = "sortOrder",
      order = "asc",
      limit,
      offset,
    } = req.query;

    const query: any = {};
    if (team) query.team = team;
    if (assignee) query.assignee = assignee;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (project) query.project = project;
    if (cycle) query.cycle = cycle;
    if (label) query.labels = label;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { issueId: { $regex: search, $options: "i" } },
      ];
    }

    if (createdBy) query.createdBy = createdBy;
    if (subscriber) {
      const SubscriberModel = (await import("../model/subscriber.model")).default;
      const subs = await SubscriberModel.find({ user: subscriber }).select("issue");
      query._id = { $in: subs.map((x: any) => x.issue) };
    }
    if (dueBefore || dueAfter) {
      query.dueDate = {};
      if (dueBefore) query.dueDate.$lte = new Date(dueBefore as string);
      if (dueAfter) query.dueDate.$gte = new Date(dueAfter as string);
    }
    if (createdAtAfter) {
      query.createdAt = { $gte: new Date(createdAtAfter as string) };
    }
    // support comma-separated multi-values for status/priority
    if (typeof status === "string" && status.includes(",")) query.status = { $in: status.split(",") };
    if (typeof priority === "string" && priority.includes(",")) query.priority = { $in: priority.split(",") };

    const allowedSort = ["sortOrder", "createdAt", "updatedAt", "priority", "title", "status", "estimate", "dueDate"];
    const sortField = allowedSort.includes(sortBy as string) ? (sortBy as string) : "sortOrder";
    const sort: any = {};
    sort[sortField] = order === "desc" ? -1 : 1;

    let find = TicketModel.find(query)
      .populate("team")
      .populate("assignee")
      .populate("project")
      .populate("cycle")
      .populate("labels")
      .populate("createdBy")
      .populate("parentIssue")
      .sort(sort);
    if (limit) find = find.limit(Number(limit));
    if (offset) find = find.skip(Number(offset));
    const tickets = await find;
    return res.status(200).send(tickets);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const ticket = await TicketModel.findById(req.params.id)
      .populate("team")
      .populate("assignee")
      .populate("project")
      .populate("cycle")
      .populate("labels")
      .populate("createdBy");
    if (!ticket) return res.status(404).send({ message: "Ticket not found" });
    return res.status(200).send(ticket);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    // Strip empty-string optional fields (client sends "" for unset selects)
    const body = { ...req.body };
    for (const k of ["assignee", "project", "cycle", "parentIssue", "dueDate", "estimate"]) {
      if (body[k] === "" || body[k] === null) delete body[k];
    }
    if (Array.isArray(body.labels)) body.labels = body.labels.filter(Boolean);
    else if (!body.labels) body.labels = [];

    // Generate issue ID
    const team = await TeamModel.findById(body.team);
    if (!team) return res.status(404).send({ message: "Team not found" });

    const count = await TicketModel.countDocuments({ team: req.body.team });
    body.issueId = `${team.identifier}-${count + 1}`;

    if (req.authUser && !body.createdBy) body.createdBy = req.authUser._id;
    const ticket = await TicketModel.create(body);

    // Auto-subscribe creator and assignee (inbox notifications)
    const SubscriberModel = (await import("../model/subscriber.model")).default;
    const subs = [ticket.createdBy, ticket.assignee].filter(Boolean);
    for (const u of subs) {
      await SubscriberModel.updateOne(
        { issue: ticket._id, user: u },
        { $setOnInsert: { issue: ticket._id, user: u } },
        { upsert: true }
      ).catch(() => {});
    }
    const populatedTicket = await TicketModel.findById(ticket._id)
      .populate("team")
      .populate("assignee")
      .populate("project")
      .populate("labels");

    // Create activity
    await ActivityModel.create({
      type: "issue_created",
      issue: ticket._id,
      user: ticket.createdBy || ticket.assignee,
      team: ticket.team,
      data: { issueId: ticket.issueId },
    });

    return res.status(201).send(populatedTicket);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const oldTicket = await TicketModel.findById(req.params.id);
    if (!oldTicket) return res.status(404).send({ message: "Ticket not found" });

    const patch = { ...req.body };
    for (const k of ["assignee", "project", "cycle", "parentIssue", "dueDate", "estimate"]) {
      if (patch[k] === "" || patch[k] === null) patch[k] = undefined;
    }
    if (Array.isArray(patch.labels)) patch.labels = patch.labels.filter(Boolean);

    const ticket = await TicketModel.findByIdAndUpdate(req.params.id, patch, {
      new: true,
    })
      .populate("team")
      .populate("assignee")
      .populate("project")
      .populate("cycle")
      .populate("labels");

    // Create activity for status change
    if (req.body.status && oldTicket.status !== req.body.status) {
      await ActivityModel.create({
        type: "status_changed",
        issue: ticket?._id,
        user: req.body.updatedBy || oldTicket.createdBy,
        team: ticket?.team,
        data: { oldStatus: oldTicket.status, newStatus: req.body.status },
      });
    }

    // Create activity for assignment change
    if (req.body.assignee && oldTicket.assignee?.toString() !== req.body.assignee) {
      await ActivityModel.create({
        type: "issue_assigned",
        issue: ticket?._id,
        user: req.body.assignee,
        team: ticket?.team,
        data: { assignee: req.body.assignee },
      });
    }

    // Generic update activity
    const changedKeys = Object.keys(req.body).filter(
      (k) => !["status", "assignee", "updatedBy"].includes(k) && JSON.stringify((oldTicket as any)[k]) !== JSON.stringify(req.body[k])
    );
    if (changedKeys.length > 0) {
      await ActivityModel.create({
        type: "issue_updated",
        issue: ticket?._id,
        user: req.body.updatedBy || oldTicket.createdBy,
        team: (ticket?.team as any)?._id || ticket?.team,
        data: { fields: changedKeys },
      });
    }
    if (req.body.updatedBy) {
      const SubscriberModel = (await import("../model/subscriber.model")).default;
      await SubscriberModel.updateOne(
        { issue: ticket?._id, user: req.body.updatedBy },
        { $setOnInsert: { issue: ticket?._id, user: req.body.updatedBy } },
        { upsert: true }
      ).catch(() => {});
    }

    return res.status(200).send(ticket);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * GET /:id/children — sub-issues
 */
router.get("/:id/children", async (req: Request, res: Response) => {
  try {
    const children = await TicketModel.find({ parentIssue: req.params.id })
      .populate("assignee")
      .populate("labels");
    return res.status(200).send(children);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /:id/subscribe — toggle subscription for current (or given) user
 * Body: { user?: string }
 */
router.post("/:id/subscribe", async (req: Request, res: Response) => {
  try {
    const SubscriberModel = (await import("../model/subscriber.model")).default;
    const userId = req.body.user || req.authUser?._id;
    if (!userId) return res.status(400).send({ message: "user is required" });
    const existing = await SubscriberModel.findOne({ issue: req.params.id, user: userId });
    if (existing) {
      await existing.deleteOne();
      return res.status(200).send({ subscribed: false });
    }
    await SubscriberModel.create({ issue: req.params.id, user: userId });
    return res.status(201).send({ subscribed: true });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * GET /:id/subscribers
 */
router.get("/:id/subscribers", async (req: Request, res: Response) => {
  try {
    const SubscriberModel = (await import("../model/subscriber.model")).default;
    const subs = await SubscriberModel.find({ issue: req.params.id }).populate("user");
    return res.status(200).send(subs);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /batch — batch update statuses/fields (drag many, keyboard ops)
 * Body: { ids: string[], changes: object, updatedBy?: string }
 */
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const { ids, changes, updatedBy } = req.body;
    if (!Array.isArray(ids) || !changes) return res.status(400).send({ message: "ids[] and changes required" });
    const results = [];
    for (const id of ids) {
      const t = await TicketModel.findByIdAndUpdate(id, { ...changes, ...(updatedBy ? {} : {}) }, { new: true }).populate("team").populate("assignee");
      if (t) results.push(t);
    }
    return res.status(200).send(results);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const ticket = await TicketModel.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).send({ message: "Ticket not found" });
    return res.status(200).send({ message: "Ticket deleted" });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;
