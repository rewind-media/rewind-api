import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response } from "express";
import { HttpController } from "./index";
import { ServerRoutes, ShowInfo } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("WatchController");

export class ShowController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Show.list,
      (
        req: Request<
          ServerRoutes.Api.Show.ListParams,
          ServerRoutes.Api.Show.ListResponse
        >,
        res: Response<ServerRoutes.Api.Show.ListResponse>
      ) =>
        this.db
          .listShows(req.params.libraryId)
          .then((it) => {
            if (it) {
              res.send({
                shows: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );
    app.get(
      ServerRoutes.Api.Show.get,
      (
        req: Request<
          ServerRoutes.Api.Show.GetParams,
          ServerRoutes.Api.Show.GetResponse
        >,
        res: Response<ServerRoutes.Api.Show.GetResponse>
      ) =>
        this.db
          .getShow(req.params.showId)
          .then((it: ShowInfo | undefined) => {
            if (it) {
              res.send({
                show: it,
              });
            } else {
              res.sendStatus(404);
            }
          })
          .catch(() => res.sendStatus(500))
    );
  }
}
