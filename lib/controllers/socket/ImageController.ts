import { SocketController, SocketIoServer, SocketIoServerSocket } from ".";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";

const log = ServerLog.getChildCategory("WatchController");

export class ImageController implements SocketController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(io: SocketIoServer): void {
    io.on("connection", (socket: SocketIoServerSocket) => {
      // TODO image info apis
    });
  }
}
