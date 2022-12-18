import { Express, Request, Response } from "express";
import { AuthMiddleware } from "../../middleware/AuthMiddleware";
import { HttpController } from "./index";
import "../../declarations";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

export class AuthController implements HttpController {
  private authMiddleware: AuthMiddleware;

  constructor(authMiddleware: AuthMiddleware) {
    this.authMiddleware = authMiddleware;
  }

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
