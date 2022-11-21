import { ServerRoutes } from "@rewind-media/rewind-protocol";
import express, { Express } from "express";
import { HttpController } from "./index";

export class HomeController implements HttpController {
  attach(app: Express): void {
    app.get(ServerRoutes.indexHtml, (req, res, next) => {
      res.sendFile("index.html", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
    app.get(ServerRoutes.indexJs, (req, res, next) => {
      res.sendFile("index.js", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
    app.get(ServerRoutes.manifest, (req, res, next) => {
      res.sendFile("manifest.json", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });

    app.get(ServerRoutes.catchAll, (req, res, next) => {
      res.sendFile("index.html", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
  }
}
