import { SocketController, SocketIoServer, SocketIoServerSocket } from ".";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { GetLibraryRequest } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("WatchController");

export class BrowseController implements SocketController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(io: SocketIoServer): void {
    io.on("connection", (socket: SocketIoServerSocket) => {
      //TODO require Auth
      log.debug("A user connected");
      socket.on("getLibrary", this.mkGetLibrariesHandler(socket));
      socket.on("listLibrariesRequest", this.mkListLibrariesHandler(socket));
    });
  }

  mkListLibrariesHandler(socket: SocketIoServerSocket): () => void {
    return () => {
      this.db.listLibraries().then((libs) =>
        socket.emit("listLibrariesCallback", {
          libraries: libs,
        })
      );
    };
  }

  mkGetLibrariesHandler(
    socket: SocketIoServerSocket
  ): (props: GetLibraryRequest) => void {
    return (props: GetLibraryRequest) => {
      this.db.getLibrary(props.libraryId).then((library) => {
        if (library) {
          socket.emit("getLibraryCallback", {
            library: library,
          });
        } else {
          log.error(`Failed to find library ${props.libraryId}`);
        }
      });
    };
  }
}
