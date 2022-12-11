import { ServerRoutes } from "@rewind-media/rewind-protocol";
import { Express, Response, Request } from "express";
import { HttpController } from "./index";
import { FaviconResponse } from "favicons";

export class IconController implements HttpController {
  private icons: FaviconResponse;
  constructor(icons: FaviconResponse) {
    this.icons = icons;
  }

  attach(app: Express): void {
    this.icons.images.map((i) => {
      app.get(
        ServerRoutes.formatIconRoute(i.name),
        (_req: Request, res: Response<Buffer>) => {
          res.send(i.contents);
        }
      );
    });
  }
}
