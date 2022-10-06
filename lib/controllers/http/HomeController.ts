import { ServerRoutes } from "@rewind-media/rewind-protocol";
import express, { Express } from "express";
import { HttpController } from "./index";

export class HomeController implements HttpController {
  attach(app: Express): void {
    app.use(
      ServerRoutes.root,
      express.static("../node_modules/@rewind-media/rewind-web/webpack")
    );

    app.use(ServerRoutes.Web.root, (req, res, next) => {
      res.sendFile("index.html", {
        root: "../node_modules/@rewind-media/rewind-web/webpack/",
      });
    });
  }
}
