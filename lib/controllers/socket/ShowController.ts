import { SocketController, SocketIoServer, SocketIoServerSocket } from ".";

import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import {
  GetEpisodeRequest,
  ListShowEpisodesRequest,
  ListShowSeasonsRequest,
  ListShowsRequest,
} from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("WatchController");

export class ShowController implements SocketController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(io: SocketIoServer): void {
    io.on("connection", (socket: SocketIoServerSocket) => {
      socket.on("listSeries", this.mkListSeriesHandler(socket));
      socket.on("listShowSeasons", this.mkListShowSeasonsHandler(socket));
      socket.on("listShowEpisodes", this.mkListShowEpisodesHandler(socket));
      socket.on("getShowEpisode", this.mkGetShowEpisodeHandler(socket));
    });
  }

  mkListSeriesHandler(socket: SocketIoServerSocket) {
    return (props: ListShowsRequest) => {
      this.db.listShows(props.libraryId).then((shows) => {
        socket.emit("listSeriesCallback", {
          shows: shows,
        });
      });
    };
  }
  mkListShowSeasonsHandler(socket: SocketIoServerSocket) {
    return (props: ListShowSeasonsRequest) => {
      this.db.listShowSeasons(props.show).then((seasons) => {
        socket.emit("listShowSeasonsCallback", {
          seasons: seasons,
        });
      });
    };
  }
  mkListShowEpisodesHandler(socket: SocketIoServerSocket) {
    return (props: ListShowEpisodesRequest) => {
      this.db.listShowSeasonEpisodes(props.season).then((episodes) => {
        socket.emit("listShowEpisodesCallback", {
          episodes: episodes,
        });
      });
    };
  }
  mkGetShowEpisodeHandler(socket: SocketIoServerSocket) {
    return (props: GetEpisodeRequest) => {
      this.db.getShowEpisode(props.episode).then((episode) => {
        socket.emit("getShowEpisodeCallback", {
          episode: episode,
        });
      });
    };
  }
}
