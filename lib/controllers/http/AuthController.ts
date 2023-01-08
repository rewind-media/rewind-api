import { Express, Request, Response } from "express";
import { HttpController } from "./index.js";
import "../../declarations.js";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { AuthMiddleware } from "../../middleware/AuthMiddleware.js";

export class AuthController implements HttpController {
  constructor(private authMiddleware: AuthMiddleware) {}

  attach(app: Express) {
    app.get(ServerRoutes.Api.Auth.verify, this.mkVerifyHandler());
    app.post(ServerRoutes.Api.Auth.logout, this.mkLogoutHandler());

    app.post(
      ServerRoutes.Api.Auth.login,
      this.authMiddleware.passport.authenticate("local", {
        failureMessage: true,
        session: true,
      }),
      this.mkLoginHandler()
    );
    app.use((req, res, next) => {
      if (!req.user) {
        res.redirect(ServerRoutes.root);
      } else {
        next();
      }
    });
  }

  private mkLogoutHandler() {
    return (req: Request, res: Response) => {
      console.log("Received logout");
      req.logout(() => res.sendStatus(200));
    };
  }

  private mkLoginHandler() {
    return (req: Request, res: Response) => {
      if (req.user) {
        req.session.user = req.user;
        req.session.save();
        res.sendStatus(200);
      } else {
        res.sendStatus(403);
      }
    };
  }

  private mkVerifyHandler() {
    return (req: Request, res: Response) => {
      if (req.user) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(Buffer.from(JSON.stringify(req.user), "utf8"));
      } else {
        res.writeHead(401);
        res.end();
      }
    };
  }
}
