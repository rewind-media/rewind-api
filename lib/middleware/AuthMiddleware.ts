import { HttpMiddleware } from "./models.js";
import { Express, Handler } from "express";
import * as pp from "passport";
import * as ppl from "passport-local";
import crypto from "crypto";
import { Database, hashPassword } from "@rewind-media/rewind-common";
import { ServerLog } from "../log.js";

const log = ServerLog.getChildCategory("AuthMiddleware");

export class AuthMiddleware implements HttpMiddleware {
  readonly passport: pp.Authenticator<
    Handler,
    any,
    any,
    pp.AuthenticateOptions
  >;
  private readonly initialize: Handler;
  private readonly session: Handler;
  private readonly authenticate: Handler;
  // private readonly authorize: Handler;

  constructor(db: Database) {
    this.passport = new pp.Passport();
    this.passport.serializeUser((user: Express.User, done) => {
      log.info(
        "Inside serializeUser callback. User id is save to the session file store here"
      );
      done(null, user.username);
    });

    this.passport.deserializeUser((username: string, done) => {
      log.debug("Inside deserializeUser callback");
      log.debug(
        `The user id passport saved in the session file store is: ${username}`
      );
      db.getUser(username)
        .then((user) => {
          if (user) {
            done(undefined, {
              username: user.username,
              permissions: user.permissions,
            });
          } else {
            done(undefined, false);
          }
        })
        .catch(done);
    });

    this.passport.use(
      new ppl.Strategy({ usernameField: "username" }, function verify(
        username,
        password,
        cb
      ) {
        log.info(`Verifying ${username} and ${password}`);
        db.getUser(username).then((user) => {
          if (!user) {
            return cb(null, false, {
              message: "Incorrect username or password.",
            });
          }

          hashPassword(password, user.salt).then((hashedPass) => {
            if (!crypto.timingSafeEqual(user.hashedPass, hashedPass)) {
              return cb(null, false, {
                message: "Incorrect username or password.",
              });
            }
            return cb(null, user);
          });
        });
      })
    );
    const authSettings = {
      failureMessage: true,
      session: true,
    };
    this.initialize = this.passport.initialize();
    this.session = this.passport.session();
    this.authenticate = this.passport.authenticate("session", authSettings);
    // this.authorize = this.passport.authorize("session", authSettings);
  }

  // TODO verify session password against db password and destroy user session if it doesn't match
  attachHttp(app: Express) {
    app.use(this.initialize);
    app.use(this.session);
    app.use(this.authenticate);
    // app.use(this.authorize);
  }
}
