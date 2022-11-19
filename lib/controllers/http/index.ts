import { Express } from "express";

export * from "./AuthController";
export * from "./HomeController";
export * from "./StreamController";
export * from "./LibraryController";
export * from "./ShowController";
export * from "./SeasonController";
export * from "./EpisodeController";
export * from "./SettingsController";

export interface HttpController {
  attach: (app: Express) => void;
}
