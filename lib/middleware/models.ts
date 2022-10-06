import { Express } from "express";
import { SocketIoServer } from "../controllers/socket";

export interface HttpMiddleware {
  attachHttp(app: Express): void;
}

export interface SocketMiddleware {
  attachSocket(socket: SocketIoServer): void;
}
