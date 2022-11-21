import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response } from "express";
import { HttpController } from "./index";
import { ServerRoutes, SeasonInfo } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("SeasonController");

export class SeasonController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Season.list,
      (
        req: Request<
          ServerRoutes.Api.Season.ListParams,
          ServerRoutes.Api.Season.ListResponse
        >,
        res: Response<ServerRoutes.Api.Season.ListResponse>
      ) =>
        this.db
          .listSeasons(req.params.showId)
          .then((it) => {
            if (it) {
              res.send({
                seasons: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );
    app.get(
      ServerRoutes.Api.Season.get,
      (
        req: Request<
          ServerRoutes.Api.Season.GetParams,
          ServerRoutes.Api.Season.GetResponse
        >,
        res: Response<ServerRoutes.Api.Season.GetResponse>
      ) =>
        this.db
          .getSeason(req.params.seasonId)
          .then((it: SeasonInfo | undefined) => {
            if (it) {
              res.send({
                season: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );
  }
}
