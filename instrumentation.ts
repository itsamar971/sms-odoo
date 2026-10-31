/** Warm up (seed) the in-memory DB at server start and start the daily billing scheduler. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
