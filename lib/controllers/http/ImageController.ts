import { Express } from "express";
import { HttpController } from "./index";
import { Database, Cache } from "@rewind-media/rewind-common";
import { ImageInfo, ServerRoutes } from "@rewind-media/rewind-protocol";
import { JobQueue } from "@rewind-media/rewind-common/lib";
import { ServerLog } from "../../log";

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
    app.get(ServerRoutes.Api.Image.image, async (req, res, next) => {
      const fetchImage = async () => {
        const image = await this.cache.getImage(imageId);
        if (image) {
          await this.cache.expireImage(imageId, 3600);
        }
        return image;
      };

      const imageId = req.params.id;
      const cachedImage = await fetchImage();
      if (cachedImage) {
        res.end(cachedImage);
        return;
      }
      const imageInfo = await this.db.getImage(imageId);
      if (!imageInfo) {
        res.sendStatus(404);
        return;
      }

      return new Promise(async (resolve) => {
        await this.queue.submit({ payload: imageInfo }, (emitter) => {
          emitter
            .on("success", async () => {
              log.info(`Job succeeded for Image ${imageInfo.id}`);
              const image = await fetchImage();
              if (image) {
                res.end(image);
              } else {
                res.sendStatus(501);
              }
              resolve(undefined);
            })
            .on("fail", (reason) => {
              res.sendStatus(501);
              log.error(`Job failed for Image ${imageInfo.id}`, reason);
              resolve(undefined);
            });
        });
      });
    });
  }
}
