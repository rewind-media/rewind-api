import { HttpController } from ".";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response, NextFunction } from "express";
import { ShowInfo, ServerRoutes } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("LibraryController");

export class LibraryController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Library.list,
      (
        req: Request<{}, ServerRoutes.Api.Library.ListResponse>,
        res: Response<ServerRoutes.Api.Library.ListResponse>,
        next: NextFunction
      ) => {
        this.db.listLibraries().then((libs) =>
          res.send({
            libraries: libs,
          })
        );
      }
    );

    app.get(
      ServerRoutes.Api.Library.get,
      (
        req: Request<ServerRoutes.Api.Library.GetParams>,
        res: Response,
        next: NextFunction
      ) => {
        this.db.getLibrary(req.params.libraryId).then((library) => {
          if (library) {
            res.send({
              library: library,
            });
          } else {
            log.error(`Failed to find library ${req.params.libraryId}`);
          }
        });
      }
    );
  }
}
