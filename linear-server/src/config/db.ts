import mongoose from "mongoose";
import "dotenv/config";

// In-memory fallback: when no MongoDB server is reachable (or MONGODB_URL=memory://),
// the app runs on mongodb-memory-server so it can be started "turnkey" anywhere.
let memoryServerPromise: Promise<string> | null = null;

function redact(u: string) {
  try {
    return u.replace(/\/\/[^@/]*@/, "//***@");
  } catch {
    return "***";
  }
}

async function startMemoryServer(): Promise<string> {
  if (!memoryServerPromise) {
    memoryServerPromise = (async () => {
      // Required lazily so production deployments don't need this dependency at runtime
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const srv = await MongoMemoryServer.create({
        instance: { dbName: "linear" },
      });
      const uri = srv.getUri("linear");
      console.log("In-memory MongoDB started:", uri);
      return uri;
    })().catch((err) => {
      console.error("Failed to start in-memory MongoDB:", err?.message || err);
      throw err;
    });
  }
  return memoryServerPromise;
}

async function resolveUrl(): Promise<string> {
  const url = process.env.MONGODB_URL || "";
  if (url.startsWith("memory://") || !url) {
    console.log("Using in-memory MongoDB (MONGODB_URL not set or memory://)");
    return startMemoryServer();
  }
  try {
    // Quick probe: try to connect with a short timeout
    await mongoose.connect(url, {
      serverSelectionTimeoutMS: 4000,
      socketTimeoutMS: 5000,
    } as any);
    console.log("Database got connected (MongoDB):", redact(url));
    return url;
  } catch (e) {
    console.log(
      "Could not reach MongoDB at",
      redact(url),
      "- falling back to in-memory MongoDB"
    );
    return startMemoryServer();
  }
}

const connection = async () => {
  mongoose.set("strictQuery", true);
  try {
    if (mongoose.connection.readyState === 1) return;
    const url = await resolveUrl();
    if ((mongoose.connection.readyState as number) !== 1) {
      await mongoose.connect(url, { serverSelectionTimeoutMS: 15000 } as any);
    }
    console.log("Database got connected");
  } catch (error) {
    console.log("Database connection failed:", error);
  }
};

export default connection;
