import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { Express, Request, Response } from "express";
import { HttpController } from "./index";

export class HomeController implements HttpController {
  attach(app: Express): void {
    app.get(ServerRoutes.indexHtml, this.mkFileHandler("index.html"));
    app.get(ServerRoutes.indexJs, this.mkFileHandler("index.js"));
    app.get(ServerRoutes.manifest, this.mkFileHandler("manifest.json"));
    app.get(ServerRoutes.catchAll, this.mkFileHandler("index.html"));
  }

  private mkFileHandler(filename: string) {
    return (_req: Request, res: Response) => {
      res.sendFile(filename, {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    };
  }
}
