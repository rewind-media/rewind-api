import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response } from "express";
import { asyncWrapper, HttpController } from "./index";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("ShowController");

export class ShowController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Show.list, asyncWrapper(this.listHandler()));

    app.get(ServerRoutes.Api.Show.get, asyncWrapper(this.getHandler()));
  }

  private getHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Show.GetParams,
        ServerRoutes.Api.Show.GetResponse
      >,
      res: Response<ServerRoutes.Api.Show.GetResponse>
    ) => {
      try {
        const show = await this.db.getShow(req.params.showId);
        if (show) {
          res.send({
            show: show,
          });
        } else {
          log.error("No show found", req.params.showId);
          res.sendStatus(404);
        }
      } catch (e) {
        log.error("Failed to load show", req);
        res.sendStatus(500);
      }
    };
  }

  private listHandler() {
    return async (
      req: Request<
        ServerRoutes.Api.Show.ListParams,
        ServerRoutes.Api.Show.ListResponse
      >,
      res: Response<ServerRoutes.Api.Show.ListResponse>
    ) => {
      try {
        const showInfos = await this.db.listShows(req.params.libraryId);
        if (showInfos) {
          res.send({
            shows: showInfos,
          });
        } else {
          res.sendStatus(404);
        }
      } catch (e) {
        res.sendStatus(500);
      }
    };
  }
}
