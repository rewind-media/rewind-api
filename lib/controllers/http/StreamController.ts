import { Express } from "express";
import { HttpController } from "./index";
import {
  Cache,
  StreamMetadata,
  StreamSegmentMetadata,
} from "@rewind-media/rewind-common";
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
        const streamMetadata = await this.cache.getStreamMetadata(
          req.params.id
        );
        if (streamMetadata) {
          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
          });
          res.end(mkM3u8(streamMetadata));
        } else {
          log.warn(`Stream ${req.params.id} - no metadata found.`);
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
          log.warn(
            `Stream ${req.params.id} - no ${ServerRoutes.Api.Stream.initMp4} found.`
          );
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
          log.warn(
            `Stream ${req.params.id} - segment ${req.params.segment} not found.`
          );
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });
  }
}

function mkM3u8(streamMetadata: StreamMetadata) {
  return (
    "#EXTM3U\n" +
    "#EXT-X-VERSION:7\n" +
    "#EXT-X-TARGETDURATION:5\n" +
    "#EXT-X-MEDIA-SEQUENCE:0\n" +
    '#EXT-X-MAP:URI="init-stream.mp4"\n' +
    streamMetadata.segments
      .map(
        (seg: StreamSegmentMetadata) =>
          `#EXTINF:${seg.duration},\n${seg.index}.m4s\n`
      )
      .join("")
  );
}
