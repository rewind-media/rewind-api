import { randomUUID } from "crypto";
import {
  SocketController,
  SocketIoServer,
  SocketIoServerSocket,
} from "./index.js";
import { ServerLog } from "../../log.js";
import {
  CreateEpisodeHlsStreamRequest,
  HlsStreamProps,
  Library,
  LibraryType,
  ServerRoutes,
  EpisodeInfo,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import { Database, JobQueue, Cache } from "@rewind-media/rewind-common";
import formatM3u8IndexPath = ServerRoutes.Api.Stream.formatM3u8IndexPath;
import { Duration } from "durr";
import { List } from "immutable";

const log = ServerLog.getChildCategory("WatchController");

function extractDuration(media: EpisodeInfo) {
  return (
    media.info.format.duration ||
    List(media?.info.streams)
      .filter((it) => it && it.duration)
      .first()?.duration
  );
}

function mkStreamProps(
  media: EpisodeInfo,
  request: CreateEpisodeHlsStreamRequest
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

type DestroyStreamFunction = () => Promise<void>;
type CreateStreamFunction = (props: StreamProps) => Promise<void>;

export class WatchController implements SocketController {
  private db: Database;
  private cache: Cache;
  private streamJobQueue: JobQueue<StreamProps, undefined>;

  constructor(
    db: Database,
    cache: Cache,
    streamJobQueue: JobQueue<StreamProps, undefined>
  ) {
    this.db = db;
    this.cache = cache;
    this.streamJobQueue = streamJobQueue;
  }

  private getStreamId(socket: SocketIoServerSocket): Promise<string | null> {
    return this.cache.get(`ClientId:${socket.id}:StreamId`);
  }

  private setStreamId(
    socket: SocketIoServerSocket,
    stream: StreamProps
  ): Promise<void> {
    // TODO exp Should be based on duration of stream
    return this.cache.put(
      `ClientId:${socket.id}:StreamId`,
      stream.id,
      Duration.days(1).after()
    );
  }

  private delStreamId(socket: SocketIoServerSocket): Promise<void> {
    return this.cache.del(`ClientId:${socket.id}:StreamId`);
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
  mkCancelStreamHandler(socket: SocketIoServerSocket): DestroyStreamFunction {
    return async () => {
      const streamId = await this.getStreamId(socket);
      if (streamId) {
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
          this.delStreamId(socket),
        ]);
      }
    };
  }

  mkCreateStreamFunction(socket: SocketIoServerSocket): CreateStreamFunction {
    return async (streamProps) => {
      await this.setStreamId(socket, streamProps);
      const jobId = await this.streamJobQueue.submit(
        {
          payload: streamProps,
        },
        (emitter) =>
          emitter.on("start", () => {
            socket.emit("createStreamCallback", {
              streamProps: WatchController.toHlsStreamProps(streamProps),
            });
          })
      );

      await this.setJobId(streamProps.id, jobId);
    };
  }

  attach(io: SocketIoServer): void {
    io.on("connection", (socket: SocketIoServerSocket) => {
      //TODO require Auth
      log.debug("A user connected");
      const cancelStreamFunction = this.mkCancelStreamHandler(socket);
      const createStreamFunction = this.mkCreateStreamFunction(socket);
      const createStreamHandler = this.mkCreateStreamHandler(
        cancelStreamFunction,
        createStreamFunction
      );
      socket.on("cancelStream", cancelStreamFunction);
      socket.on("disconnect", cancelStreamFunction);
      socket.on("createStream", createStreamHandler);
    });
  }

  private mkCreateStreamHandler(
    destroyStreamFunction: DestroyStreamFunction,
    createStreamFunction: CreateStreamFunction
  ) {
    return async (props: CreateEpisodeHlsStreamRequest) => {
      await this.db
        .getLibrary(props.library)
        .then((library) => this.retrieveMedia(props, library!!))
        .then((media) => mkStreamProps(media!!, props))
        .then((streamProps) =>
          destroyStreamFunction().then(() => createStreamFunction(streamProps))
        )
        .catch((err) =>
          // TODO let the client know
          log.error(
            `Failed to handle CreateHlsStreamRequest: ${JSON.stringify(props)}`,
            err
          )
        );
    };
  }

  private retrieveMedia(
    props: CreateEpisodeHlsStreamRequest,
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

  private static toHlsStreamProps(sp: StreamProps): HlsStreamProps {
    return {
      ...sp,
      url: formatM3u8IndexPath(sp.id),
    };
  }
}
