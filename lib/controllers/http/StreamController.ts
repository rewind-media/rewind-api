import { Express, Request } from "express";
import { HttpController, HttpError } from "./index";
import {
  Cache,
  StreamMetadata,
  StreamSegmentMetadata,
} from "@rewind-media/rewind-common";
import { ServerRoutes } from "@rewind-media/rewind-protocol";
import formatM3u8StreamPath = ServerRoutes.Api.Stream.formatM3u8StreamPath;
import formatM3u8SubtitlePath = ServerRoutes.Api.Stream.formatM3u8SubtitlePath;

export class StreamController implements HttpController {
  private cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Stream.subtitle, async (req, res) => {
      const streamId = this.parseStreamId(req);
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      const streamMetadata = await this.cache.getStreamMetadata(streamId);
      if (streamMetadata && streamMetadata.subtitles) {
        res.writeHead(200, {
          "Content-Type": "text/vtt",
        });
        res.end(streamMetadata.subtitles);
      } else {
        throw new HttpError(
          `Stream ${streamId} - no subtitles found.`,
          "NOT_FOUND"
        );
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Stream, async (req, res) => {
      const streamId = this.parseStreamId(req);
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      const streamMetadata = await this.cache.getStreamMetadata(streamId);
      if (streamMetadata) {
        res.writeHead(200, {
          "Content-Type": "application/vnd.apple.mpegurl",
        });
        res.end(mkM3u8Stream(streamMetadata));
      } else {
        throw new HttpError(
          `Stream ${streamId} - no metadata found.`,
          "NOT_FOUND"
        );
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Index, async (req, res) => {
      const streamId = this.parseStreamId(req);
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      const streamMetadata = await this.cache.getStreamMetadata(streamId);
      if (streamMetadata) {
        res.writeHead(200, {
          "Content-Type": "application/vnd.apple.mpegurl",
        });
        res.end(mkM3u8Index(streamId, streamMetadata));
      } else {
        throw new HttpError(
          `Stream ${streamId} - no metadata found.`,
          "NOT_FOUND"
        );
      }
    });

    app.get(ServerRoutes.Api.Stream.m3u8Subtitle, async (req, res) => {
      const streamId = this.parseStreamId(req);
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      const streamMetadata = await this.cache.getStreamMetadata(streamId);
      if (streamMetadata) {
        res.writeHead(200, {
          "Content-Type": "application/vnd.apple.mpegurl",
        });
        res.end(mkM3u8Subtitle(streamId, streamMetadata));
      } else {
        throw new HttpError(
          `Stream ${streamId} - no metadata found.`,
          "NOT_FOUND"
        );
      }
    });

    app.get(ServerRoutes.Api.Stream.initMp4, async (req, res) => {
      const streamId = this.parseStreamId(req);
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      const initMp4 = await this.cache.getInitMp4(streamId);

      if (initMp4) {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(initMp4);
      } else {
        throw new HttpError(
          `Stream ${streamId} - no ${ServerRoutes.Api.Stream.initMp4} found.`,
          "NOT_FOUND"
        );
      }
    });

    app.get(ServerRoutes.Api.Stream.segment, async (req, res) => {
      const streamId = this.parseStreamId(req);
      const segment = req.params["segment"];
      if (!req.user)
        throw new HttpError("Missing user info in request", "FORBIDDEN");
      if (!segment)
        throw new HttpError("Missing segment number in request", "BAD_REQUEST");
      const segmentObject = await this.cache.getSegmentM4s(
        streamId,
        parseInt(segment)
      );

      if (segmentObject) {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(segmentObject);
      } else {
        throw new HttpError(
          `Stream ${streamId} - segment ${segment} not found.`,
          "NOT_FOUND"
        );
      }
    });
  }

  private parseStreamId<P extends { [key: string]: string }>(req: Request<P>) {
    const streamId = req.params["id"];
    if (!streamId)
      throw new HttpError("Missing stream 'id' url parameter", "BAD_REQUEST");
    return streamId;
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
