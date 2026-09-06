import aj from "#config/arcjet.js";
import logger from "#config/logger.js";
import { slidingWindow } from "@arcjet/node";

const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user ? req.user.role || "user" : "guest";
    let limit;
    let message;

    switch (role) {
        case "admin":
            limit = 20;
            message = "Admin rate limit exceeded. Please try again later.";
            break;
        case "user":
            limit = 10;
            message = "User rate limit exceeded. Please try again later.";
            break;
        case "guest":
        default:
            limit = 5;
            message = "Guest rate limit exceeded. Please try again later.";
            break;
    }
    const client = aj.withRule(slidingWindow({ mode: "LIVE", interval: 60, max: limit, name: `${role}-rate-limit`}));

    const decision = await client.protect(req);

    if (decision.conclusion === "ERROR") {
        logger.error(`Arcjet decision unavailable (failing open): {ip: ${req.ip}, userAgent: ${req.headers["user-agent"]}, path: ${req.path}, method: ${req.method}, reason: ${JSON.stringify(decision.reason)}}`);
        return next();
    }

    if(decision.isDenied() && decision.reason.isBot()) {
        logger.warn(`Bot detected: {ip: ${req.ip}, userAgent: ${req.headers["user-agent"]}, path: ${req.path}, method: ${req.method}}`);
        return res.status(403).json({error: "Forbidden", message: "Bot detected. Access denied."});
    }
     if(decision.isDenied() && decision.reason.isShield()) {
        logger.warn(`Shield detected: {ip: ${req.ip}, userAgent: ${req.headers["user-agent"]}, path: ${req.path}, method: ${req.method}}`);
        return res.status(403).json({error: "Forbidden", message: "Shield detected. Access denied."});
    }
     if(decision.isDenied() && decision.reason.isRateLimit()) {
        logger.warn(`Rate limit exceeded: {ip: ${req.ip}, userAgent: ${req.headers["user-agent"]}, path: ${req.path}, method: ${req.method}}`);
        return res.status(403).json({error: "Forbidden", message});
    }

    next();

 } catch (error) {
      logger.error("Error inspecting request", { message: error.message, stack: error.stack });
      return res.status(500).json({error: "Internal Server Error", message: "Something went wrong with the security middleware."});
    }
}

export default securityMiddleware;