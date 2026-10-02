import { Request, Response, Router } from "express";
import TeamModel from "../model/team.model";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const teams = await TeamModel.find({ archived: false })
      .populate("members")
      .sort({ createdAt: -1 });
    return res.status(200).send(teams);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const team = await TeamModel.findById(req.params.id).populate("members");
    if (!team) return res.status(404).send({ message: "Team not found" });
    return res.status(200).send(team);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const team = await TeamModel.create(req.body);
    return res.status(201).send(team);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * POST /:id/members — add member. Body: { userId }
 */
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).send({ message: "userId is required" });
    const team = await TeamModel.findById(req.params.id);
    if (!team) return res.status(404).send({ message: "Team not found" });
    if (!team.members.map(String).includes(String(userId))) {
      team.members.push(userId as any);
      await team.save();
    }
    const UserModel = (await import("../model/user.model")).default;
    await UserModel.findByIdAndUpdate(userId, { $addToSet: { teams: team._id } }).catch(() => {});
    const populated = await TeamModel.findById(team._id).populate("members");
    return res.status(200).send(populated);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

/**
 * DELETE /:id/members/:userId — remove member
 */
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const team = await TeamModel.findById(req.params.id);
    if (!team) return res.status(404).send({ message: "Team not found" });
    team.members = team.members.filter((m) => String(m) !== req.params.userId);
    await team.save();
    const UserModel = (await import("../model/user.model")).default;
    await UserModel.findByIdAndUpdate(req.params.userId, { $pull: { teams: team._id } }).catch(() => {});
    const populated = await TeamModel.findById(team._id).populate("members");
    return res.status(200).send(populated);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const team = await TeamModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("members");
    if (!team) return res.status(404).send({ message: "Team not found" });
    return res.status(200).send(team);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const team = await TeamModel.findByIdAndUpdate(
      req.params.id,
      { archived: true },
      { new: true }
    );
    if (!team) return res.status(404).send({ message: "Team not found" });
    return res.status(200).send(team);
  } catch (error) {
    return res.status(400).send({ message: error });
  }
});

export default router;

