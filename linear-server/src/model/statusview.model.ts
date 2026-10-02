import { Schema, model } from "mongoose";

export interface IStatusView {
  _id?: string;
  name: string; // Todo | In Progress | In Review | Done | Canceled | Backlog | Unstarted
  type: "backlog" | "unstarted" | "started" | "completed" | "canceled";
  team: string;
  color: string;
  isDefault: boolean;
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const statusViewSchema = new Schema<IStatusView>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["backlog", "unstarted", "started", "completed", "canceled"],
      default: "unstarted",
    },
    team: { type: Schema.Types.ObjectId as any, ref: "team", required: true },
    color: { type: String, default: "#5E6AD2" },
    isDefault: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const StatusViewModel = model<IStatusView>("statusview", statusViewSchema);

export default StatusViewModel;
