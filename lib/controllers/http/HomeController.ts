import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { Express, Request, Response } from "express";
import { HttpController } from "./index.js";

export class HomeController implements HttpController {
  attach(app: Express): void {
    const indexFileHandler = this.mkFileHandler("index.html");
    app.get(ServerRoutes.root, indexFileHandler);
    app.get(ServerRoutes.indexHtml, indexFileHandler);
    app.get(ServerRoutes.indexJs, this.mkFileHandler("index.js"));
    app.get(ServerRoutes.manifest, this.mkFileHandler("manifest.json"));
    app.get(ServerRoutes.catchAll, (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
      } else {
        indexFileHandler(req, res);
      }
    });
  }

  private mkFileHandler(filename: string) {
    return (_req: Request, res: Response) => {
      res.sendFile(filename, {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    };
  }
}
