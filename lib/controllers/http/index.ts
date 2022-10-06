import { Express } from "express";

export * from "./AuthController";
export * from "./HomeController";
export * from "./StreamController";

export interface HttpController {
  attach: (app: Express) => void;
}
