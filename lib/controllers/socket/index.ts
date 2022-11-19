import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@rewind-media/rewind-protocol";
import { Server, Socket } from "socket.io";

export { WatchController } from "./WatchController";

export interface SocketController {
  attach(io: SocketIoServer): void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
}

export type SocketIoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type SocketIoServerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
