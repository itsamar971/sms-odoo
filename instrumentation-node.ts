import { getDb } from "./lib/db/client";
import { startScheduler } from "./lib/scheduler";

getDb();
startScheduler();
