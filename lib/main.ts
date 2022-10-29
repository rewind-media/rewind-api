import {
  StreamController,
  AuthController,
  HomeController,
} from "./controllers/http";
import express from "express";
import http from "http";
import {
  WatchController,
  InterServerEvents,
  SocketData,
} from "./controllers/socket";
import { SessionMiddleware } from "./middleware/SessionMiddleware";
import { ParserMiddleware } from "./middleware/ParserMiddleware";
import { AuthMiddleware } from "./middleware/AuthMiddleware";
import { BrowseController } from "./controllers/socket";
import { Server } from "socket.io";
import { SettingsController } from "./controllers/socket/SettingsController";
import { ShowController } from "./controllers/socket/ShowController";
import { ImageController } from "./controllers/http/ImageController";
import {
  Database,
  loadConfig,
  mkMongoDatabase,
  RedisCache,
  RedisJobQueue,
} from "@rewind-media/rewind-common";
import { ServerLog } from "./log";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import Redis from "ioredis";

const log = ServerLog.getChildCategory("main");
const config = loadConfig();
const redis = new Redis(config.cacheConfig);
const cache = new RedisCache(redis);
mkMongoDatabase(config.databaseConfig).then((db: Database) => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    transports: ["websocket", "polling"],
  });
  const streamJobQueue = new RedisJobQueue<StreamProps, undefined>(
    redis,
    "Stream"
  );
  const homeController = new HomeController();
  const streamController = new StreamController(cache);

  const settingsController = new SettingsController(db);
  const watchController = new WatchController(db, cache, streamJobQueue);
  const browseController = new BrowseController(db);
  const showController = new ShowController(db);
  const imageController = new ImageController(db);
  const sessionMiddleware = new SessionMiddleware(db);
  const parserMiddleware = new ParserMiddleware();
  const authMiddleware = new AuthMiddleware(db);
  const auth = new AuthController(authMiddleware);

  sessionMiddleware.attachHttp(app);
  sessionMiddleware.attachSocket(io);

  parserMiddleware.attachHttp(app);
  authMiddleware.attachHttp(app);
  authMiddleware.attachSocket(io);

  auth.attach(app);

  homeController.attach(app);
  streamController.attach(app);
  imageController.attach(app);
  watchController.attach(io);
  browseController.attach(io);
  settingsController.attach(io);
  showController.attach(io);

  server.listen(8080, () => {
    log.info(`Rewind listening on port ${8080}`);
  });
});
