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
        res: Response<ServerRoutes.Api.User.ListResponse>,
        next: NextFunction
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
        res: Response<{}>,
        next: NextFunction
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
      (
        req: Request<{}, {}, ServerRoutes.Api.User.ChangePasswordRequest>,
        res: Response<{}>,
        next: NextFunction
      ) => {
        const username = req.session.user?.username;
        if (username) {
          this.db.getUser(username).then((user) =>
            user
              ? hashPassword(req.body.oldPassword, user.salt).then(
                  (hashedOldPass) => {
                    if (
                      crypto.timingSafeEqual(user.hashedPass, hashedOldPass)
                    ) {
                      const newSalt = randomUUID();
                      hashPassword(req.body.newPassword, newSalt).then(
                        (hashedNewPass) => {
                          return this.db
                            .putUser({
                              ...user,
                              hashedPass: hashedNewPass,
                              salt: newSalt,
                            })
                            .then((result) => {
                              res.sendStatus(result ? 200 : 500);
                            });
                        }
                      );
                    }
                  }
                )
              : fail()
          );
        } else {
          fail();
        }
      }
    );

    app.post(
      ServerRoutes.Api.User.del,
      (
        req: Request<{}, {}, ServerRoutes.Api.User.DeleteRequest>,
        res: Response<{}>,
        next: NextFunction
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
