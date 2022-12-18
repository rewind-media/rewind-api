import { Express, Request, Response } from "express";
import { asyncWrapper, HttpController, HttpError } from "./index";
import {
  Database,
  Cache,
  ClientEvents,
  ClientEventEmitter,
} from "@rewind-media/rewind-common";
import { ImageInfo, ServerRoutes } from "@rewind-media/rewind-protocol";
import { JobQueue } from "@rewind-media/rewind-common";
import { ServerLog } from "../../log";
import GetResponse = ServerRoutes.Api.Image.GetResponse;
import GetParams = ServerRoutes.Api.Image.GetParams;

const log = ServerLog.getChildCategory("ImageController");

export class ImageController implements HttpController {
  private db: Database;
  private cache: Cache;
  private queue: JobQueue<ImageInfo, undefined>;

  constructor(
    db: Database,
    cache: Cache,
    imageJobQueue: JobQueue<ImageInfo, undefined>
  ) {
    this.db = db;
    this.cache = cache;
    this.queue = imageJobQueue;
  }

  attach(app: Express): void {
    app.get(ServerRoutes.Api.Image.image, asyncWrapper(this.mkGetHandler()));
  }

  private mkGetHandler() {
    return async (
      req: Request<GetParams, GetResponse>,
      res: Response<GetResponse>
    ) => {
      const imageId = req.params.id;

      const fetchImage = this.mkFetchImageFun(imageId);
      const cachedImage = await fetchImage();
      if (cachedImage) {
        res.setHeader("Expires", new Date(Date.now() + 3600000).toUTCString());
        res.end(cachedImage);
        return;
      }

      const imageInfo = await this.db.getImage(imageId);
      if (!imageInfo) {
        res.sendStatus(404);
        return;
      }

      return this.runImageJob(imageInfo, fetchImage, res, imageId);
    };
  }

  private async runImageJob(
    imageInfo: ImageInfo,
    fetchImage: () => Promise<Buffer | null>,
    res: Response<GetResponse>,
    imageId: string
  ) {
    await new Promise(async (resolve, reject) => {
      await this.queue.submit(
        { payload: imageInfo },
        this.mkJobPreHook(imageInfo, resolve, reject)
      );
      setTimeout(() => reject(`Timed out fetching ${imageInfo.id}`), 2000);
    }).catch((reason) => new HttpError(reason));

    try {
      const image = await fetchImage();
      if (image) {
        res.setHeader("Expires", new Date(Date.now() + 3600000).toUTCString());
        res.end(image);
      } else {
        res.sendStatus(501);
      }
    } catch (reason) {
      log.error(`Failed to process request for image: ${imageId}`, reason);
      res.sendStatus(501);
    }
  }

  private mkFetchImageFun(imageId: string): () => Promise<Buffer | null> {
    return async () => {
      const image = await this.cache.getImage(imageId);
      if (image) {
        await this.cache.expireImage(imageId, 3600);
      }
      return image;
    };
  }

  private mkJobPreHook(
    imageInfo: ImageInfo,
    resolve: (value: PromiseLike<undefined> | undefined) => void,
    reject: (reason: string) => void
  ) {
    return (emitter: ClientEventEmitter<ClientEvents<undefined>>) => {
      emitter
        .on("success", async () => {
          log.info(`Job succeeded for Image ${imageInfo.id}`);
          resolve(undefined);
        })
        .on("fail", reject);
    };
  }
}
