import { Express } from "express";
import { HttpController } from "./index";
import {
  Cache,
  StreamMetadata,
  StreamSegmentMetadata,
} from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
import formatM3u8StreamPath = ServerRoutes.Api.Stream.formatM3u8StreamPath;
import formatSubtitlePath = ServerRoutes.Api.Stream.formatSubtitlePath;
import formatM3u8SubtitlePath = ServerRoutes.Api.Stream.formatM3u8SubtitlePath;

const log = ServerLog.getChildCategory("StreamController");

export class StreamController implements HttpController {
  private cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Stream.subtitle, async (req, res) => {
      if (req.user) {
        log.debug(
          "In stream playlist handler: " + JSON.stringify(req.isAuthenticated())
        );
        const streamMetadata = await this.cache.getStreamMetadata(
          req.params.id
        );
        if (streamMetadata && streamMetadata.subtitles) {
          res.writeHead(200, {
            "Content-Type": "text/vtt",
          });
          res.end(streamMetadata.subtitles);
        } else {
          log.warn(`Stream ${req.params.id} - no subtitles found.`);
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Stream, async (req, res) => {
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
          res.end(mkM3u8Stream(streamMetadata));
        } else {
          log.warn(`Stream ${req.params.id} - no metadata found.`);
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Index, async (req, res) => {
      if (req.user) {
        log.debug(
          "In index playlist handler: " + JSON.stringify(req.isAuthenticated())
        );
        const streamMetadata = await this.cache.getStreamMetadata(
          req.params.id
        );
        if (streamMetadata) {
          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
          });
          res.end(mkM3u8Index(req.params.id, streamMetadata));
        } else {
          log.warn(`Stream ${req.params.id} - no metadata found.`);
          res.sendStatus(400);
        }
      } else {
        res.sendStatus(401);
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Subtitle, async (req, res) => {
      if (req.user) {
        log.debug(
          "In index playlist handler: " + JSON.stringify(req.isAuthenticated())
        );
        const streamMetadata = await this.cache.getStreamMetadata(
          req.params.id
        );
        if (streamMetadata) {
          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
          });
          res.end(mkM3u8Subtitle(req.params.id, streamMetadata));
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

function mkM3u8Subtitle(streamId: string, streamMetadata: StreamMetadata) {
  return (
    "#EXTM3U\n" +
    "#EXT-X-VERSION:7\n" +
    `#EXT-X-TARGETDURATION:${Math.ceil(streamMetadata.processedSecs)}\n` +
    "#EXT-X-MEDIA-SEQUENCE:0\n" +
    `#EXTINF:${streamMetadata.totalDurationSecs},\n` +
    `${ServerRoutes.Api.Stream.formatSubtitlePath(streamId)}\n` +
    "#EXT-X-ENDLIST\n"
  );
}

function mkM3u8Stream(streamMetadata: StreamMetadata) {
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
      .join("") +
    (streamMetadata.complete ? "#EXT-X-ENDLIST\n" : "")
  );
}

function mkM3u8Index(id: string, streamMetadata: StreamMetadata) {
  return (
    "#EXTM3U\n" +
    (streamMetadata.subtitles
      ? "#EXT-X-MEDIA:TYPE=SUBTITLES," +
        'GROUP-ID="subs",' +
        'CHARACTERISTICS="public.accessibility.transcribes-spoken-dialog",' +
        'NAME="English",' +
        "AUTOSELECT=YES," +
        "DEFAULT=YES," +
        "FORCED=YES," +
        'LANGUAGE="en-US",' +
        `URI="${formatM3u8SubtitlePath(id)}"\n`
      : "") +
    "#EXT-X-STREAM-INF:" +
    "BANDWIDTH=1924009," +
    `CODECS="${streamMetadata.mime.codecs.join(", ")}"` +
    (streamMetadata.subtitles ? `,SUBTITLES="subs"` : "") +
    "\n" +
    formatM3u8StreamPath(id)
  );
}
