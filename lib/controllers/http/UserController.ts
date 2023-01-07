import { randomUUID } from "crypto";
import crypto from "crypto";
import { ServerLog } from "../../log.js";
import { Database, hashPassword } from "@rewind-media/rewind-common";
import "@rewind-media/rewind-protocol";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { asyncWrapper, HttpController } from "./index.js";
import { Express, Request, Response } from "express";
import { filterNotNil } from "cantaloupe";

const log = ServerLog.getChildCategory("SettingsController");

export class UserController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.User.list, asyncWrapper(this.mkListHandler()));

    app.post(
      ServerRoutes.Api.User.create,
      asyncWrapper(this.mkCreateHandler())
    );

    app.post(
      ServerRoutes.Api.User.changePassword,
      asyncWrapper(this.mkChangePasswordHandler())
    );

    app.post(ServerRoutes.Api.User.del, asyncWrapper(this.mkDeleteHandler()));
  }

  private mkChangePasswordHandler() {
    return async (
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
      const hashedOldPass = await hashPassword(req.body.oldPassword, user.salt);
      if (crypto.timingSafeEqual(user.hashedPass, hashedOldPass)) {
        const newSalt = randomUUID();
        const hashedNewPass = await hashPassword(req.body.newPassword, newSalt);
        const result = await this.db.putUser({
          ...user,
          hashedPass: hashedNewPass,
          salt: newSalt,
        });
        res.sendStatus(result ? 200 : 500);
      } else {
        fail();
      }
    };
  }

  private mkCreateHandler() {
    return async (
      req: Request<{}, {}, ServerRoutes.Api.User.CreateRequest>,
      res: Response<{}>
    ) => {
      try {
        if (await this.db.getUser(req.body.user.username)) {
          res.status(400).send(`User ${req.body.user.username} already exists`);
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
    };
  }

  private mkDeleteHandler() {
    return async (
      req: Request<{}, {}, ServerRoutes.Api.User.DeleteRequest>,
      res: Response<{}>
    ) => {
      if (req.session.user?.permissions?.isAdmin) {
        const deletedUsers = await Promise.all(
          req.body.usernames.map((username) =>
            this.db.deleteUser(username).then((res) => (res ? username : null))
          )
        );
        res.send({
          deletedUsernames: filterNotNil(deletedUsers),
        });
      }
    };
  }

  private mkListHandler() {
    return async (
      req: Request<{}, ServerRoutes.Api.User.ListResponse>,
      res: Response<ServerRoutes.Api.User.ListResponse>
    ) => {
      if (req.session.user?.permissions?.isAdmin) {
        const users = await this.db.listUsers();
        res.send({ users: users });
      }
    };
  }
}
