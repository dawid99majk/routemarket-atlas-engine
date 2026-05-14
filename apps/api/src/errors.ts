export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "http_error"
  ) {
    super(message);
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message, "bad_request");
}

export function unauthorized(message = "Unauthorized."): HttpError {
  return new HttpError(401, message, "unauthorized");
}

export function notFound(message = "Not found."): HttpError {
  return new HttpError(404, message, "not_found");
}
