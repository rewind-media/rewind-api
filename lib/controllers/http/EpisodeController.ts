import { Database } from "@rewind-media/rewind-common";
import { Express, Request, Response } from "express";
import { HttpController } from "./index";
import { ServerRoutes, EpisodeInfo } from "@rewind-media/rewind-protocol";

export class EpisodeController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Episode.list,
      (
        req: Request<
          ServerRoutes.Api.Episode.ListParams,
          ServerRoutes.Api.Episode.ListResponse
        >,
        res: Response<ServerRoutes.Api.Episode.ListResponse>
      ) =>
        this.db
          .listEpisodes(req.params.seasonId)
          .then((it) => {
            if (it) {
              res.send({
                episodes: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );

    app.get(
      ServerRoutes.Api.Episode.get,
      (
        req: Request<
          ServerRoutes.Api.Episode.GetParams,
          ServerRoutes.Api.Episode.GetResponse
        >,
        res: Response<ServerRoutes.Api.Episode.GetResponse>
      ) =>
        this.db
          .getEpisode(req.params.episodeId)
          .then((it: EpisodeInfo | undefined) => {
            if (it) {
              res.send({
                episode: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );
  }
}
