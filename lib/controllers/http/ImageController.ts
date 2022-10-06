import { Express } from "express";
import { HttpController } from "./index";
import {Database} from "@rewind-media/rewind-common";
import { ServerRoutes } from "@rewind-media/rewind-protocol";

export class ImageController implements HttpController {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }

  attach(app: Express): void {
    app.use(ServerRoutes.Api.Image.image, (req, res, next) => {
      const imageId = req.params.id;
      this.db.getImage(imageId).then((imageInfo) => {
        if (imageInfo) {
          res.sendFile(imageInfo.path);
        } else {
          res.sendStatus(404);
        }
      });
    });
  }
}
