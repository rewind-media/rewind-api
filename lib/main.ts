import {
  StreamController,
  AuthController,
  HomeController,
  ShowController,
  SeasonController,
  LibraryController,
  EpisodeController,
  UserController,
  IconController,
} from "./controllers/http/index.js";
import express from "express";
import http from "http";
import {
  WatchController,
  InterServerEvents,
  SocketData,
} from "./controllers/socket/index.js";
import { SessionMiddleware } from "./middleware/SessionMiddleware.js";
import { ParserMiddleware } from "./middleware/ParserMiddleware.js";
import { AuthMiddleware } from "./middleware/AuthMiddleware.js";
import { Server } from "socket.io";
import { ImageController } from "./controllers/http/ImageController.js";
import {
  Database,
  loadConfig,
  mkMongoDatabase,
  RedisCache,
  RedisJobQueue,
} from "@rewind-media/rewind-common";
import { ServerLog } from "./log.js";
import {
  ClientToServerEvents,
  ImageInfo,
  ServerToClientEvents,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import { loadFavIcons } from "./favicons.js";

import RedisModule from "ioredis";
import { Duration } from "durr";
// TODO: https://github.com/luin/ioredis/issues/1642
const Redis = RedisModule.default;

const log = ServerLog.getChildCategory("main");
const config = loadConfig();
const redis = new Redis(config.cacheConfig);
const cache = new RedisCache(redis);
mkMongoDatabase(config.databaseConfig).then(async (db: Database) => {
  const favIcons = await loadFavIcons();
  const app = express();
  const server = http.createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    // TODO include these in config
    transports: ["websocket", "polling"],
    pingInterval: Duration.seconds(5).millis,
    pingTimeout: Duration.seconds(15).millis,
  });
  const streamJobQueue = new RedisJobQueue<StreamProps, undefined>(
    redis,
    "Stream"
  );
  const imageJobQueue = new RedisJobQueue<ImageInfo, undefined>(redis, "Image");
  const homeController = new HomeController();
  const streamController = new StreamController(cache);

  const settingsController = new UserController(db);
  const iconController = new IconController(favIcons);
  const watchController = new WatchController(db, cache, streamJobQueue);
  const libraryController = new LibraryController(db);
  const showController = new ShowController(db);
  const seasonController = new SeasonController(db);
  const episodeController = new EpisodeController(db);
  const imageController = new ImageController(db, cache, imageJobQueue);
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

  streamController.attach(app);
  iconController.attach(app);
  imageController.attach(app);
  libraryController.attach(app);
  showController.attach(app);
  seasonController.attach(app);
  episodeController.attach(app);
  settingsController.attach(app);
  homeController.attach(app); // last to catch all

  watchController.attach(io);

  server.listen(8080, () => {
    log.info(`Rewind listening on port ${8080}`);
  });
});
