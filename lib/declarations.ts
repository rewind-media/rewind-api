//Don't remove this import or typescript will get mad
import { ClientUser } from "@rewind-media/rewind-protocol";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    user: Express.User;
  }
}
declare global {
  namespace Express {
    interface Request {
      session: session.Session & Partial<session.SessionData>;
    }
    interface Session {
      user?: Express.User;
    }
  }
}
declare global {
  namespace Express {
    interface User extends ClientUser {}
  }
}