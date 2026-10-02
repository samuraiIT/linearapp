import { Schema, model } from "mongoose";

export interface ISubscriber {
  _id?: string;
  issue: string;
  user: string;
  createdAt?: Date;
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    issue: { type: Schema.Types.ObjectId as any, ref: "ticket", required: true },
    user: { type: Schema.Types.ObjectId as any, ref: "user", required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

subscriberSchema.index({ issue: 1, user: 1 }, { unique: true });

const SubscriberModel = model<ISubscriber>("subscriber", subscriberSchema);

export default SubscriberModel;
