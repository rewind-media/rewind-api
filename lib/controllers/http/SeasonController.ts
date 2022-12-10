import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response } from "express";
import { HttpController } from "./index";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("SeasonController");

export class SeasonController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Season.list,
      async (
        req: Request<
          ServerRoutes.Api.Season.ListParams,
          ServerRoutes.Api.Season.ListResponse
        >,
        res: Response<ServerRoutes.Api.Season.ListResponse>
      ) => {
        try {
          const seasonInfos = await this.db.listSeasons(req.params.showId);
          if (seasonInfos) {
            res.send({
              seasons: seasonInfos,
            });
          } else {
            res.sendStatus(404);
          }
        } catch (reason) {
          log.error(
            "Error listing season for show ",
            req.params.showId,
            reason
          );
          res.sendStatus(501);
        }
      }
    );

    app.get(
      ServerRoutes.Api.Season.get,
      async (
        req: Request<
          ServerRoutes.Api.Season.GetParams,
          ServerRoutes.Api.Season.GetResponse
        >,
        res: Response<ServerRoutes.Api.Season.GetResponse>
      ) => {
        try {
          const seasonInfo = await this.db.getSeason(req.params.seasonId);
          if (seasonInfo) {
            res.send({
              season: seasonInfo,
            });
          } else {
            res.sendStatus(404);
          }
        } catch (reason) {
          log.error(
            "Error listing season for show ",
            req.params.seasonId,
            reason
          );
          res.sendStatus(501);
        }
      }
    );
  }
}
