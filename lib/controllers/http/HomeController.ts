import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { Express } from "express";
import { HttpController } from "./index";

export class HomeController implements HttpController {
  attach(app: Express): void {
    app.get(ServerRoutes.indexHtml, (_req, res) => {
      res.sendFile("index.html", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
    app.get(ServerRoutes.indexJs, (_req, res) => {
      res.sendFile("index.js", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
    app.get(ServerRoutes.manifest, (_req, res) => {
      res.sendFile("manifest.json", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });

    app.get(ServerRoutes.catchAll, (_req, res) => {
      res.sendFile("index.html", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
  }
}
