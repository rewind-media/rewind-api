import { Express } from "express";
import { HttpController } from "./index";
import { Cache } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
const log = ServerLog.getChildCategory("StreamController");
export class StreamController implements HttpController {
  private cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Stream.m3u8, async (req, res) => {
      if (req.user) {
        log.debug(
          "In stream playlist handler: " + JSON.stringify(req.isAuthenticated())
        );
        const streamM3u8 = await this.cache.getM3u8(req.params.id);
        if (streamM3u8) {
          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
          });
          res.end(streamM3u8);
        } else {
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });

    app.get(ServerRoutes.Api.Stream.initMp4, async (req, res) => {
      if (req.user) {
        const initMp4 = await this.cache.getInitMp4(req.params.id);

        if (initMp4) {
          res.writeHead(200, { "Content-Type": "video/mp4" });
          res.end(initMp4);
        } else {
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });

    app.get(ServerRoutes.Api.Stream.segment, async (req, res) => {
      if (req.user) {
        const segmentObject = await this.cache.getSegmentM4s(
          req.params.id,
          parseInt(req.params.segment)
        );

        if (segmentObject) {
          res.writeHead(200, { "Content-Type": "video/mp4" });
          res.end(segmentObject);
        } else {
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });
  }
}
