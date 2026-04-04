// This file MUST be imported first in worker files to load env vars
// before any other module (especially prisma) initializes
import dotenv from "dotenv";
import path from "path";

const root = path.resolve(__dirname, "../../");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });
