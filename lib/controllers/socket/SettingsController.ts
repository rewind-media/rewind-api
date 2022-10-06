import {
  InterServerEvents,
  SocketController,
  SocketData,
  SocketIoServer,
  SocketIoServerSocket,
} from "./index";
import { Handshake } from "socket.io";
import { randomUUID } from "crypto";
import crypto from "crypto";
import { ServerLog } from "../../log";
import { Database, hash } from "@rewind-media/rewind-common";
import "@rewind-media/rewind-protocol";
import {
  ChangePasswordRequest,
  CreateUserRequest,
  DeleteUsersRequest,
} from "@rewind-media/rewind-protocol";
import { filterNotNil } from "cantaloupe";
import { Socket } from "socket.io";

const log = ServerLog.getChildCategory("SettingsController");

export class SettingsController implements SocketController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(io: SocketIoServer): void {
    io.on("connection", (socket: SocketIoServerSocket) => {
      socket.on("listUsers", this.mkListUsersHandler(socket));
      socket.on("createUser", this.mkCreateUserHandler(socket));
      socket.on("deleteUsers", this.mkDeleteUsersHandler(socket));
      socket.on("changePassword", this.mkChangePasswordHandler(socket));
    });
  }

  mkListUsersHandler(socket: SocketIoServerSocket) {
    return () => {
      // TODO this is a super ugly way to get the session mixin from @types/express-socket.io-session
      if (
        (
          (socket as unknown as Socket<any, any, InterServerEvents, SocketData>)
            .handshake as Handshake
        )?.session?.user?.permissions?.isAdmin
      ) {
        this.db.listUsers().then((users) => {
          socket.emit("getUsersCallback", { users: users });
        });
      }
    };
  }

  mkCreateUserHandler(socket: SocketIoServerSocket) {
    return (req: CreateUserRequest) => {
      // TODO this is an ugly way to get the session mixin from @types/express-socket.io-session
      if (
        (socket.handshake as Handshake)?.session?.user?.permissions?.isAdmin
      ) {
        const salt = randomUUID();
        hash
          .hashPassword(req.password, salt)
          .then((hashedPass) =>
            this.db.putUser({
              username: req.username,
              hashedPass: hashedPass,
              salt: salt,
              permissions: req.permissions,
            })
          )
          .then((putUserRes) => {
            socket.emit("createUserCallback", {
              username: req.username,
              created: putUserRes ?? false,
            });
          });
      }
    };
  }

  mkChangePasswordHandler(socket: SocketIoServerSocket) {
    return (req: ChangePasswordRequest) => {
      function fail() {
        socket.emit("changePasswordCallback", { success: false });
      }

      const username = (socket.handshake as Handshake)?.session?.user?.username;
      if (username) {
        this.db.getUser(username).then((user) =>
          user
            ? hash
                .hashPassword(req.oldPassword, user.salt)
                .then((hashedOldPass) => {
                  if (crypto.timingSafeEqual(user.hashedPass, hashedOldPass)) {
                    const newSalt = randomUUID();
                    hash
                      .hashPassword(req.newPassword, newSalt)
                      .then((hashedNewPass) => {
                        return this.db
                          .putUser({
                            ...user,
                            hashedPass: hashedNewPass,
                            salt: newSalt,
                          })
                          .then((res) => {
                            socket.emit("changePasswordCallback", {
                              success: res ?? false,
                            });
                          });
                      });
                  }
                })
            : fail()
        );
      } else {
        fail();
      }
    };
  }
  mkDeleteUsersHandler(socket: SocketIoServerSocket) {
    return (req: DeleteUsersRequest) => {
      // TODO this is an ugly way to get the session mixin from @types/express-socket.io-session
      if (
        (socket.handshake as Handshake)?.session?.user?.permissions?.isAdmin
      ) {
        Promise.all(
          req.usernames.map((username) =>
            this.db.deleteUser(username).then((res) => (res ? username : null))
          )
        ).then((promRes) =>
          socket.emit("deleteUsersCallback", {
            deletedUsernames: filterNotNil(promRes),
          })
        );
      }
    };
  }
}
