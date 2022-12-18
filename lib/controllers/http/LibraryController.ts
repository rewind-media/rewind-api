import { asyncWrapper, HttpController } from ".";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { Express, Request, Response } from "express";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

const log = ServerLog.getChildCategory("LibraryController");

export class LibraryController implements HttpController {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Library.list, asyncWrapper(this.mkListHandler()));
    app.get(ServerRoutes.Api.Library.get, asyncWrapper(this.mkGetHandler()));
  }

  private mkListHandler() {
    return async (
      _req: Request<{}, ServerRoutes.Api.Library.ListResponse>,
      res: Response<ServerRoutes.Api.Library.ListResponse>
    ) => {
      const libs = await this.db.listLibraries();
      res.send({
        libraries: libs,
      });
    };
  }

  private mkGetHandler() {
    return async (
      req: Request<ServerRoutes.Api.Library.GetParams>,
      res: Response
    ) => {
      const library = this.db.getLibrary(req.params.libraryId);
      if (library) {
        res.send({
          library: library,
        });
      } else {
        log.error(`Failed to find library ${req.params.libraryId}`);
        res.sendStatus(404);
      }
    };
  }
}
