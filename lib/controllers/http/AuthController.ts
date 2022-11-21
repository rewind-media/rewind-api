import { Express } from "express";
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
    app.get(ServerRoutes.Api.Auth.verify, (req, res) => {
      if (req.user) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(Buffer.from(JSON.stringify(req.user), "utf8"));
      } else {
        res.writeHead(401);
        res.end();
      }
    });

    app.post(
      ServerRoutes.Api.Auth.login,
      this.authMiddleware.passport.authenticate("local", {
        failureMessage: true,
        session: true,
      }),
      function (req, res) {
        // TODO make this reload the page instead of redirecting to root. Something like below.
        // res.location("back"); // 'back' has a special meaning here
        if (req.user) {
          req.session.user = req.user;
          req.session.save();
        }
        res.sendStatus(200);
      }
    );
    app.post(ServerRoutes.Api.Auth.logout, function (req, res) {
      console.log("Received logout");
      req.logout(() => res.sendStatus(200));
    });
  }
}
