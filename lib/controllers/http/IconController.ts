import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { Express } from "express";
import { HttpController } from "./index";
import { FaviconResponse } from "favicons";

export class IconController implements HttpController {
  private icons: FaviconResponse;
  constructor(icons: FaviconResponse) {
    this.icons = icons;
  }

  attach(app: Express): void {
    this.icons.images.map((i) => {
      app.get(ServerRoutes.formatIconRoute(i.name), (req, res, next) => {
        res.send(i.contents);
      });
    });
    console.log(JSON.stringify(this.icons.html));
    console.log(JSON.stringify(this.icons.files));
  }
}
