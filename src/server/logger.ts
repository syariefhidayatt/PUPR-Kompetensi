import pino from "pino";

// Detail error HANYA ke log, tidak pernah ke client.
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  ...(process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty" } }
    : {}),
});
