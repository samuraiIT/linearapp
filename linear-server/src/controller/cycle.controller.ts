import { Request, Response, Router } from "express";
import CycleModel from "../model/cycle.model";
import TicketModel from "../model/ticket.model";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { team } = req.query;
    const query: any = { archived: false };
    if (team) query.team = team;
    
    const cycles = await CycleModel.find(query)
      .populate("team")
      .sort({ startDate: -1 });
    
    // Calculate progress for each cycle
    const cyclesWithProgress = await Promise.all(
      cycles.map(async (cycle) => {
        const issues = await TicketModel.find({ cycle: cycle._id });
        const completed = issues.filter((i) => i.status === "DONE").length;
        const progress = issues.length > 0 ? (completed / issues.length) * 100 : 0;
        return { ...cycle.toObject(), progress: Math.round(progress) };
      })
    );
    
    return res.status(200).send(cyclesWithProgress);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const cycle = await CycleModel.findById(req.params.id).populate("team");
    if (!cycle) return res.status(404).send({ message: "Cycle not found" });
    
    const issues = await TicketModel.find({ cycle: cycle._id });
    const completed = issues.filter((i) => i.status === "DONE").length;
    const progress = issues.length > 0 ? (completed / issues.length) * 100 : 0;
    
    return res.status(200).send({ ...cycle.toObject(), progress: Math.round(progress) });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const cycle = await CycleModel.create(req.body);
    
    // Auto-include active issues in the cycle
    if (req.body.team) {
      const activeIssues = await TicketModel.find({
        team: req.body.team,
        status: { $in: ["TODO", "INPROGRESS", "IN_DEV_REVIEW"] },
        cycle: { $exists: false },
      });
      
      // Optionally auto-assign first batch of active issues
      // Or just update cycle association for existing active issues
      if (activeIssues.length > 0) {
        await TicketModel.updateMany(
          { _id: { $in: activeIssues.map((i) => i._id) } },
          { cycle: cycle._id }
        );
      }
    }
    
    return res.status(201).send(cycle);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * GET /:id/stats — completed/inProgress/notStarted breakdown + scope growth
 */
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const issues = await TicketModel.find({ cycle: req.params.id }).populate("assignee").populate("labels");
    const done = issues.filter((i) => i.status === "DONE");
    const canceled = issues.filter((i) => i.status === "CANCELLED");
    const active = issues.filter((i) => ["INPROGRESS", "IN_DEV_REVIEW"].includes(i.status));
    const notStarted = issues.filter((i) => ["TODO", "BACKLOG"].includes(i.status));
    const totalEstimate = issues.reduce((a, i) => a + (i.estimate || 0), 0);
    const doneEstimate = done.reduce((a, i) => a + (i.estimate || 0), 0);
    return res.status(200).send({
      total: issues.length,
      completed: done.length,
      canceled: canceled.length,
      inProgress: active.length,
      notStarted: notStarted.length,
      progress: issues.length ? Math.round((done.length / issues.length) * 100) : 0,
      totalEstimate,
      doneEstimate,
      issues,
    });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /:id/complete — end/done the cycle
 */
router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const cycle = await CycleModel.findByIdAndUpdate(
      req.params.id,
      { completedAt: new Date(), archived: true },
      { new: true }
    ).populate("team");
    if (!cycle) return res.status(404).send({ message: "Cycle not found" });
    return res.status(200).send(cycle);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * PATCH /:id/issues — move issues in/out of the cycle
 * Body: { add?: string[], remove?: string[] }
 */
router.patch("/:id/issues", async (req: Request, res: Response) => {
  try {
    const { add = [], remove = [] } = req.body;
    if (add.length) await TicketModel.updateMany({ _id: { $in: add } }, { cycle: req.params.id });
    if (remove.length) await TicketModel.updateMany({ _id: { $in: remove } }, { cycle: null });
    const issues = await TicketModel.find({ cycle: req.params.id });
    return res.status(200).send(issues);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const cycle = await CycleModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!cycle) return res.status(404).send({ message: "Cycle not found" });
    return res.status(200).send(cycle);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const cycle = await CycleModel.findByIdAndUpdate(
      req.params.id,
      { archived: true },
      { new: true }
    );
    if (!cycle) return res.status(404).send({ message: "Cycle not found" });
    return res.status(200).send(cycle);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;

