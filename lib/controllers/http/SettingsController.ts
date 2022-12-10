import { randomUUID } from "crypto";
import crypto from "crypto";
import { ServerLog } from "../../log";
import { Database, hashPassword } from "@rewind-media/rewind-common";
import "@rewind-media/rewind-protocol";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { HttpController } from "./index";
import { Express, Request, Response, NextFunction } from "express";
import { filterNotNil } from "cantaloupe";

const log = ServerLog.getChildCategory("SettingsController");

export class SettingsController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.User.list,
      (
        req: Request<{}, ServerRoutes.Api.User.ListResponse>,
        res: Response<ServerRoutes.Api.User.ListResponse>
      ) => {
        if (req.session.user?.permissions?.isAdmin) {
          this.db.listUsers().then((users) => {
            res.send({ users: users });
          });
        }
      }
    );

    app.post(
      ServerRoutes.Api.User.create,
      async (
        req: Request<{}, {}, ServerRoutes.Api.User.CreateRequest>,
        res: Response<{}>
      ) => {
        try {
          if (await this.db.getUser(req.body.user.username)) {
            res
              .status(400)
              .send(`User ${req.body.user.username} already exists`);
            return;
          }

          if (!req.session.user?.permissions?.isAdmin) {
            res.sendStatus(401);
            return;
          }

          const salt = randomUUID();
          const hashedPass = await hashPassword(req.body.password, salt);
          const putUserRes = this.db.putUser({
            username: req.body.user.username,
            hashedPass: hashedPass,
            salt: salt,
            permissions: req.body.user.permissions,
          });

          res.status(200).send({
            username: req.body.user.username,
            created: putUserRes ?? false,
          });
        } catch (e) {
          log.error("Error creating user", e);
          res.send(501);
        }
      }
    );

    app.post(
      ServerRoutes.Api.User.changePassword,
      async (
        req: Request<{}, {}, ServerRoutes.Api.User.ChangePasswordRequest>,
        res: Response<{}>
      ) => {
        const username = req.session.user?.username;
        const fail = () => {
          res.sendStatus(403);
        };
        if (!username) {
          log.error("No username in changePassword request", req);
          fail();
          return;
        }
        const user = await this.db.getUser(username);
        if (!user) {
          log.error(
            "Username not found in database for changePassword request",
            req
          );
          fail();
          return;
        }
        const hashedOldPass = await hashPassword(
          req.body.oldPassword,
          user.salt
        );
        if (crypto.timingSafeEqual(user.hashedPass, hashedOldPass)) {
          const newSalt = randomUUID();
          const hashedNewPass = await hashPassword(
            req.body.newPassword,
            newSalt
          );
          const result = await this.db.putUser({
            ...user,
            hashedPass: hashedNewPass,
            salt: newSalt,
          });
          res.sendStatus(result ? 200 : 500);
        } else {
          fail();
        }
      }
    );

    app.post(
      ServerRoutes.Api.User.del,
      (
        req: Request<{}, {}, ServerRoutes.Api.User.DeleteRequest>,
        res: Response<{}>
      ) => {
        if (req.session.user?.permissions?.isAdmin) {
          Promise.all(
            req.body.usernames.map((username) =>
              this.db
                .deleteUser(username)
                .then((res) => (res ? username : null))
            )
          ).then((promRes) =>
            res.send({
              deletedUsernames: filterNotNil(promRes),
            })
          );
        }
      }
    );
  }
}
