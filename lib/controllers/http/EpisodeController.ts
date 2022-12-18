import { Database } from "@rewind-media/rewind-common";
import { Express, Request, Response } from "express";
import { asyncWrapper, HttpController } from "./index";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

export class EpisodeController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Episode.list, asyncWrapper(this.mkListHandler()));
    app.get(ServerRoutes.Api.Episode.get, asyncWrapper(this.mkGetHandler()));
  }

  private mkGetHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Episode.GetParams,
        ServerRoutes.Api.Episode.GetResponse
      >,
      res: Response<ServerRoutes.Api.Episode.GetResponse>
    ) => {
      const episodeInfo = await this.db.getEpisode(req.params.episodeId);
      if (episodeInfo) {
        res.send({
          episode: episodeInfo,
        });
      } else {
        res.sendStatus(404);
      }
    };
  }

  private mkListHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Episode.ListParams,
        ServerRoutes.Api.Episode.ListResponse
      >,
      res: Response<ServerRoutes.Api.Episode.ListResponse>
    ) => {
      const episodes = await this.db.listEpisodes(req.params.seasonId);
      res.send({
        episodes: episodes,
      });
    };
  }
}
