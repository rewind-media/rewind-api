import { Express, Request, Response } from "express";
import { asyncWrapper, HttpController, HttpError } from "./index.js";
import {
  Cache,
  Database,
  JobQueue,
  RootLogger,
  StreamMetadata,
  StreamSegmentMetadata,
} from "@rewind-media/rewind-common";
import {
  EpisodeInfo,
  HlsStreamProps,
  Library,
  LibraryType,
  ServerRoutes,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import formatM3u8StreamPath = ServerRoutes.Api.Stream.formatM3u8StreamPath;
import formatM3u8SubtitlePath = ServerRoutes.Api.Stream.formatM3u8SubtitlePath;
import { Duration } from "durr";
import { Session } from "express-session";
import { randomUUID } from "crypto";
import { List } from "immutable";
import formatM3u8IndexPath = ServerRoutes.Api.Stream.formatM3u8IndexPath;

const log = RootLogger.getChildCategory("StreamController");

export class StreamController implements HttpController {
  constructor(
    private cache: Cache,
    private db: Database,
    private streamJobQueue: JobQueue<StreamProps, undefined>
  ) {}

  attach(app: Express): void {
    app.get(
      ServerRoutes.Api.Stream.subtitle,
      asyncWrapper(this.mkSubtitleHandler())
    );
    app.get(
      ServerRoutes.Api.Stream.m3u8Stream,
      asyncWrapper(this.mkM3u8StreamHandler())
    );
    app.get(
      ServerRoutes.Api.Stream.m3u8Index,
      asyncWrapper(this.mkM3u8IndexHandler())
    );
    app.get(
      ServerRoutes.Api.Stream.m3u8Subtitle,
      this.mkM3u8SubtitlesHandler()
    );
    app.get(
      ServerRoutes.Api.Stream.initMp4,
      asyncWrapper(this.mkInitMp4Handler())
    );
    app.get(
      ServerRoutes.Api.Stream.segment,
      asyncWrapper(this.mkSegmentHandler())
    );

    app.delete(ServerRoutes.Api.Stream.del, asyncWrapper(this.mkDelHandler()));
    app.post(
      ServerRoutes.Api.Stream.create,
      asyncWrapper(this.mkCreateHandler())
    );
    app.post(
      ServerRoutes.Api.Stream.heartbeat,
      asyncWrapper(this.mkHeartbeatHandler())
    );
  }

  private mkSegmentHandler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private mkInitMp4Handler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private mkM3u8SubtitlesHandler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private mkM3u8IndexHandler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private mkM3u8StreamHandler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private mkSubtitleHandler() {
    return async (req: Request, res: Response) => {
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
    };
  }

  private parseStreamId<P extends { [key: string]: string }>(req: Request<P>) {
    const streamId = req.params["id"];
    if (!streamId)
      throw new HttpError("Missing stream 'id' url parameter", "BAD_REQUEST");
    return streamId;
  }

  private getStreamId(session: Session): Promise<string | null> {
    return this.cache.get(`ClientId:${session.id}:StreamId`);
  }

  private setStreamId(session: Session, stream: StreamProps): Promise<void> {
    // TODO exp Should be based on duration of stream
    return this.cache.put(
      `ClientId:${session.id}:StreamId`,
      stream.id,
      Duration.days(1).after()
    );
  }

  private delStreamId(session: Session): Promise<void> {
    return this.cache.del(`ClientId:${session.id}:StreamId`);
  }

  private getJobId(streamId: string): Promise<string | null> {
    return this.cache.get(`StreamId:${streamId}:JobId`);
  }

  private delJobId(streamId: string): Promise<void> {
    return this.cache.del(`StreamId:${streamId}:JobId`);
  }

  private setJobId(streamId: string, jobId: string) {
    // TODO exp Should be based on duration of stream
    return this.cache.put(
      `StreamId:${streamId}:JobId`,
      jobId,
      Duration.days(1).after()
    );
  }
  mkDelHandler() {
    return async (
      req: Request<ServerRoutes.Api.Stream.DelParams>,
      res: Response
    ) => {
      await this.delStream(req.session);
      res.sendStatus(200);
    };
  }

  async delStream(session: Session) {
    const streamId = await this.getStreamId(session);
    if (streamId) {
      log.info(`Cancelling stream ${streamId}`);
      const jobId = await this.getJobId(streamId);
      await this.delJobId(streamId);
      if (jobId) {
        await this.streamJobQueue.cancel(jobId);
      }

      const streamMetadata = await this.cache.getStreamMetadata(streamId);
      if (streamMetadata) {
        await Promise.all(
          streamMetadata.segments.map((segment) =>
            this.cache.delSegmentM4s(streamId, segment.index)
          )
        );
      }
      await Promise.all([
        this.cache.delStreamMetadata(streamId),
        this.cache.delInitMp4(streamId),
        this.delStreamId(session),
      ]);
    }
  }

  async createStream(streamProps: StreamProps, session: Session) {
    await this.setStreamId(session, streamProps);
    const jobId = await this.streamJobQueue.submit(
      {
        payload: streamProps,
      }
      // TODO notifiy client of failures somehow
      // (emitter) =>
      //   emitter.on("start", () => {
      //     socket.emit("createStreamCallback", {
      //       streamProps: WatchController.toHlsStreamProps(streamProps),
      //     });
      //   })
    );

    await this.setJobId(streamProps.id, jobId);
  }

  private mkCreateHandler() {
    return async (
      req: Request<
        {},
        ServerRoutes.Api.Stream.CreateResponse,
        ServerRoutes.Api.Stream.CreateRequest
      >,
      res: Response<ServerRoutes.Api.Stream.CreateResponse>
    ) => {
      await this.db
        .getLibrary(req.body.library)
        .then((library) => this.retrieveMedia(req.body, library!!))
        .then((media) => mkStreamProps(media!!, req.body))
        .then((streamProps) =>
          this.delStream(req.session)
            .then(() => this.createStream(streamProps, req.session))
            .then(() =>
              res
                .send({ streamProps: toHlsStreamProps(streamProps) })
                .status(202)
            )
        )
        .catch((err) => {
          // TODO let the client know
          log.error(
            `Failed to handle CreateHlsStreamRequest: ${JSON.stringify(
              req.body
            )}`,
            err
          );
          res.sendStatus(501);
        });
    };
  }

  private retrieveMedia(
    props: ServerRoutes.Api.Stream.CreateRequest,
    library: Library
  ) {
    if (library) {
      switch (library.type) {
        case LibraryType.Show:
          return this.db.getEpisode(props.mediaId);
        case LibraryType.File:
          throw "File type library cannot be streamed";
        default:
          throw `Unrecognized library type ${library.type}`;
      }
    } else {
      throw `Library ${props.library} not found`;
    }
  }

  private mkHeartbeatHandler() {
    return async (
      req: Request<ServerRoutes.Api.Stream.HeartbeatParams>,
      res: Response
    ) => {
      const streamMetadata = await this.cache.getStreamMetadata(
        req.params.streamId
      );
      const expiration = Duration.seconds(15).after();
      await Promise.all([
        this.getJobId(req.params.streamId).then((jobId) =>
          jobId ? this.streamJobQueue.notify(jobId, "heartbeat") : undefined
        ),
        this.cache.expireStreamMetadata(req.params.streamId, expiration),
        this.cache.expireInitMp4(req.params.streamId, expiration),
        ...(streamMetadata?.segments?.map((segment) =>
          this.cache.expireSegmentM4s(
            req.params.streamId,
            segment.index,
            expiration
          )
        ) ?? []),
      ]);
      res.sendStatus(
        streamMetadata && streamMetadata.segments.length > 0 ? 200 : 204
      ); // TODO handle canceled too somehow.
    };
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
    "#EXT-X-PLAYLIST-TYPE:EVENT\n" +
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

function mkStreamProps(
  media: EpisodeInfo,
  request: ServerRoutes.Api.Stream.CreateRequest
) {
  const duration = extractDuration(media)!!;
  const streamProps: StreamProps = {
    mediaInfo: media,
    id: randomUUID(),
    startOffset: request.startOffset,
    subtitle: request.subtitles,
    videoStream: request.videoStream,
    audioStream: request.audioStream,
    duration: duration,
  };
  return streamProps;
}

function extractDuration(media: EpisodeInfo) {
  return (
    media.info.format.duration ||
    List(media?.info.streams)
      .filter((it) => it && it.duration)
      .first()?.duration
  );
}
function toHlsStreamProps(sp: StreamProps): HlsStreamProps {
  return {
    ...sp,
    url: formatM3u8IndexPath(sp.id),
  };
}
