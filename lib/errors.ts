/** Expected business-rule failure. Its message is safe to show to the user. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(what: string) {
    super(`${what} not found`, "NOT_FOUND");
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = "You do not have permission to do that") {
    super(message, "FORBIDDEN");
  }
}
