import { Express } from "express";

export interface HttpMiddleware {
  attachHttp(app: Express): void;
}
