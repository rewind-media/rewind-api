import { Database } from "@rewind-media/rewind-common";
import { Express, Request, Response } from "express";
import { asyncWrapper, HttpController } from "./index";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

export class SeasonController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Season.list, asyncWrapper(this.mkListHandler()));
    app.get(ServerRoutes.Api.Season.get, asyncWrapper(this.mkGetHandler()));
  }

  private mkGetHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Season.GetParams,
        ServerRoutes.Api.Season.GetResponse
      >,
      res: Response<ServerRoutes.Api.Season.GetResponse>
    ) => {
      const seasonInfo = await this.db.getSeason(req.params.seasonId);
      if (seasonInfo) {
        res.send({
          season: seasonInfo,
        });
      } else {
        res.sendStatus(404);
      }
    };
  }

  private mkListHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Season.ListParams,
        ServerRoutes.Api.Season.ListResponse
      >,
      res: Response<ServerRoutes.Api.Season.ListResponse>
    ) => {
      const seasonInfos = await this.db.listSeasons(req.params.showId);
      res.send({
        seasons: seasonInfos,
      });
    };
  }
}
