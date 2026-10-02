import { Request, Response, Router } from "express";
import StatusViewModel from "../model/statusview.model";

const router = Router();

const DEFAULT_STATUSES = [
  { name: "Backlog", type: "backlog", color: "#bec2ff80", position: 1 },
  { name: "Todo", type: "unstarted", color: "#e2e2e2", position: 2 },
  { name: "In Progress", type: "started", color: "#f2c94c", position: 3 },
  { name: "In Review", type: "started", color: "#6e78ee", position: 4 },
  { name: "Done", type: "completed", color: "#5e6ad2", position: 5 },
  { name: "Canceled", type: "canceled", color: "#959595", position: 6 },
];

router.get("/", async (req: Request, res: Response) => {
  try {
    const { team } = req.query;
    const query: any = {};
    if (team) query.team = team;
    let statuses = await StatusViewModel.find(query).sort({ position: 1 });
    // Seed defaults for a team on first access
    if (team && statuses.length === 0) {
      statuses = await StatusViewModel.create(
        DEFAULT_STATUSES.map((s) => ({ ...s, team, isDefault: true }))
      );
    }
    return res.status(200).send(statuses);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const status = await StatusViewModel.create(req.body);
    return res.status(201).send(status);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const status = await StatusViewModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!status) return res.status(404).send({ message: "Status not found" });
    return res.status(200).send(status);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const status = await StatusViewModel.findByIdAndDelete(req.params.id);
    if (!status) return res.status(404).send({ message: "Status not found" });
    return res.status(200).send({ message: "Status deleted" });
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;
