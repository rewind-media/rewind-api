import { HttpMiddleware, SocketMiddleware } from "./models.js";
import { Express, NextFunction, RequestHandler } from "express";
import session from "express-session";
import { randomUUID } from "crypto";
import { SocketIoServer } from "../controllers/socket/index.js";
import sharedsession from "express-socket.io-session";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../log.js";

const log = ServerLog.getChildCategory("SessionMiddleware");

export class SessionMiddleware implements HttpMiddleware, SocketMiddleware {
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
  attachSocket(socket: SocketIoServer) {
    socket.use((socket, next) =>
      this.session(socket.request as any, {} as any, <NextFunction>next)
    );
    socket.use(
      sharedsession(this.session, {
        autoSave: true,
      })
    );
  }
}
