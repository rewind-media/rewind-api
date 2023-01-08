import { HttpMiddleware } from "./models.js";
import { Express, RequestHandler } from "express";
import session from "express-session";
import { randomUUID } from "crypto";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../log.js";

const log = ServerLog.getChildCategory("SessionMiddleware");

export class SessionMiddleware implements HttpMiddleware {
  private readonly session: RequestHandler;
  constructor(db: Database) {
    this.session = session({
      genid: (req: Express.Request) => {
        log.debug("Inside the session middleware, sessionId: " + req.sessionID);
        return randomUUID(); // use UUIDs for session IDs
      },
      secret: "SomeString", // TODO enable rotation of this secret & persist it
      store: db.sessionStore,
    });
  }

  attachHttp(app: Express) {
    app.use(this.session);
  }
}
