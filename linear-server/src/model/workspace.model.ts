import { Schema, model } from "mongoose";

export interface IWorkspace {
  _id?: string;
  name: string;
  urlKey: string;
  plan?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    urlKey: { type: String, required: true, unique: true },
    plan: { type: String, default: "free" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const WorkspaceModel = model<IWorkspace>("workspace", workspaceSchema);

export default WorkspaceModel;
