import { HttpMiddleware } from "./models";
import { Express } from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

export class ParserMiddleware implements HttpMiddleware {
  attachHttp(app: Express) {
    app.use(cookieParser());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
  }
}
