import { randomUUID } from "crypto";
import {
  SocketController,
  SocketIoServer,
  SocketIoServerSocket,
} from "./index";
import { ServerLog } from "../../log";
import {
  CreateHlsStreamRequest,
  HlsStreamProps,
  Library,
  LibraryType,
  ServerRoutes,
  ShowEpisodeInfo,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import {
  Database,
  JobQueue,
  Cache,
  JobStatus,
} from "@rewind-media/rewind-common";
import formatM3u8Path = ServerRoutes.Api.Stream.formatM3u8Path;
import { flow, filter, first } from "lodash/fp";
import { filterNotNil } from "cantaloupe";
import { FFProbeStream } from "ffprobe";
import { isNil } from "lodash";

const log = ServerLog.getChildCategory("WatchController");

function extractDuration(media: ShowEpisodeInfo) {
  return (
    media.info.format.duration ||
    first(
      flow(
        filterNotNil,
        filter((it: FFProbeStream) => isNil(it.duration))
      )(media?.info.streams)
    )?.duration
  );
}

function mkStreamProps(media: ShowEpisodeInfo, startOffset: number) {
  const duration = extractDuration(media)!!;
  const streamProps: StreamProps = {
    mediaInfo: media,
    id: randomUUID(),
    startOffset: startOffset,
    duration: duration,
  };
  return streamProps;
}

type DestroyStreamFunction = () => Promise<void>;
type CreateStreamFunction = (props: StreamProps) => Promise<void>;

// TODO rework much of that to take into account the added Cache
export class WatchController implements SocketController {
  private db: Database;
  private cache: Cache;
  // TODO this could technically grow infinitely, and is also not shared amongst instances - move it to redis with expiration
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
      nowPlusOneDay()
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
    return this.cache.put(`StreamId:${streamId}:JobId`, jobId, nowPlusOneDay());
  }
  mkCancelStreamHandler(socket: SocketIoServerSocket): DestroyStreamFunction {
    return async () => {
      const streamId = await this.getStreamId(socket);
      if (streamId) {
        const jobId = await this.getJobId(streamId);
        if (jobId) {
          await this.streamJobQueue.cancel(jobId);
        }
        await this.delStreamId(socket);
        await this.delJobId(streamId);
      }
    };
  }

  mkCreateStreamFunction(socket: SocketIoServerSocket): CreateStreamFunction {
    return async (streamProps) => {
      await this.setStreamId(socket, streamProps);
      const jobId = await this.streamJobQueue.submit({
        payload: streamProps,
      });

      this.streamJobQueue.monitor(jobId).on("status", (status) => {
        switch (status) {
          case JobStatus.START:
            socket.emit("createStreamCallback", {
              streamProps: WatchController.toHlsStreamProps(streamProps),
            });
        }
      });

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
    return async (props: CreateHlsStreamRequest) => {
      await this.db
        .getLibrary(props.library)
        .then((library) => this.retrieveMedia(props, library!!))
        .then((media) => mkStreamProps(media!!, props.startOffset))
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

  private retrieveMedia(props: CreateHlsStreamRequest, library: Library) {
    if (library) {
      switch (library.type) {
        case LibraryType.Show:
          return this.db.getShowEpisode(props.mediaId);
        case LibraryType.File:
          throw "File type library cannot be streamed";
      }
    } else {
      throw `Library ${props.library} not found`;
    }
  }

  private static toHlsStreamProps(sp: StreamProps): HlsStreamProps {
    return {
      ...sp,
      url: formatM3u8Path(sp.id),
    };
  }
}

function nowPlusOneHour(): Date {
  return new Date(Date.now() + 3600000);
}

function nowPlusOneDay(): Date {
  return new Date(Date.now() + 24 * 3600000);
}
