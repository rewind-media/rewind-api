import {
  Express,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import { ServerLog } from "../../log";

export * from "./AuthController";
export * from "./HomeController";
export * from "./StreamController";
export * from "./LibraryController";
export * from "./ShowController";
export * from "./SeasonController";
export * from "./EpisodeController";
export * from "./SettingsController";
export * from "./IconController";

const log = ServerLog.getChildCategory("HttpControllers");

export interface HttpController {
  attach: (app: Express) => void;
}

export const HTTP_STATUSES = {
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
} as const;

export type HttpStatusMessage = keyof typeof HTTP_STATUSES;
export type HttpStatusCode = typeof HTTP_STATUSES[HttpStatusMessage];

export class HttpError {
  readonly statusCode: HttpStatusCode;

  constructor(
    public readonly stack: string,
    public readonly statusMessage: HttpStatusMessage = "INTERNAL_SERVER_ERROR",
    public readonly headers: { [key: string]: string } = {}
  ) {
    this.statusCode = HTTP_STATUSES[statusMessage];
  }
}

type ExpressHandler<Params, Request, Response, Locals> = (
  req: ExpressRequest<Params, Response, Request, Locals>,
  res: ExpressResponse<Response>,
  next: NextFunction
) => Promise<undefined | void>;

export function asyncWrapper<Params, Request, Response, Locals>(
  asyncFn: ExpressHandler<Params, Request, Response, Locals>
): (
  ...args: Parameters<ExpressHandler<Params, Request, Response, Locals>>
) => ReturnType<ExpressHandler<Params, Request, Response, Locals>> {
  return (
    ...args: Parameters<ExpressHandler<Params, Request, Response, Locals>>
  ) => {
    return asyncFn(...args).catch((e: unknown) => {
      const res = args[1];
      log.error(
        "Error handling async method. Sending 501 status.",
        JSON.stringify(args[0]),
        e
      );
      res.sendStatus(501);
    });
  };
}
