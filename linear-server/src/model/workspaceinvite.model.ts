import { Schema, model } from "mongoose";

export interface IWorkspaceInvite {
  _id?: string;
  email: string;
  role: "admin" | "member" | "guest";
  invitedBy?: string;
  accepted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const workspaceInviteSchema = new Schema<IWorkspaceInvite>(
  {
    email: { type: String, required: true },
    role: { type: String, enum: ["admin", "member", "guest"], default: "member" },
    invitedBy: { type: Schema.Types.ObjectId as any, ref: "user" },
    accepted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const WorkspaceInviteModel = model<IWorkspaceInvite>("workspaceinvite", workspaceInviteSchema);

export default WorkspaceInviteModel;
