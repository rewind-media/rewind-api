import {
  StreamController,
  AuthController,
  HomeController,
  ShowController,
  SeasonController,
  LibraryController,
  EpisodeController,
  SettingsController,
  IconController,
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
import { Server } from "socket.io";
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
  ImageInfo,
  ServerToClientEvents,
  StreamProps,
} from "@rewind-media/rewind-protocol";
import Redis from "ioredis";
import { loadFavIcons } from "./favicons";

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
    transports: ["websocket", "polling"],
  });
  const streamJobQueue = new RedisJobQueue<StreamProps, undefined>(
    redis,
    "Stream"
  );
  const imageJobQueue = new RedisJobQueue<ImageInfo, undefined>(redis, "Image");
  const homeController = new HomeController();
  const streamController = new StreamController(cache);

  const settingsController = new SettingsController(db);
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
