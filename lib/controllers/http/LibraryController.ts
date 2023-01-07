import { asyncWrapper, HttpController } from "./index.js";
import { Database } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log.js";
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
    app.post(
      ServerRoutes.Api.Library.del,
      asyncWrapper(this.mkDeleteHandler())
    );
    app.post(
      ServerRoutes.Api.Library.create,
      asyncWrapper(this.mkCreateHandler())
    );
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

  private mkDeleteHandler() {
    return async (
      req: Request<{}, undefined, ServerRoutes.Api.Library.DeleteRequest>,
      res: Response
    ) => {
      const epoch = new Date(0);
      await Promise.all(
        req.body.names.map((name) => {
          Promise.all([
            this.db.cleanEpisodes(epoch, name),
            this.db.cleanImages(epoch, name),
            this.db.cleanShows(epoch, name),
            this.db.cleanSeasons(epoch, name),
            this.db.cleanFiles(epoch, name),
          ]).then(async () => {
            if (await this.db.deleteLibrary(name)) {
              res.sendStatus(200);
            } else {
              throw `Failed to upsert library ${name}`;
            }
          });
        })
      );
    };
  }

  private mkCreateHandler() {
    return async (
      req: Request<{}, undefined, ServerRoutes.Api.Library.CreateRequest>,
      res: Response
    ) => {
      if (await this.db.upsertLibrary(req.body)) {
        res.sendStatus(200);
      } else {
        throw `Failed to upsert library ${req.body.name}`;
      }
    };
  }
}
