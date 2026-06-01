export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly field?: string;

  constructor(
    message: string,
    statusCode: number = 400,
    code: string = 'BAD_REQUEST',
    field?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} with ID ${id} not found` : `${entity} not found`,
      404,
      'NOT_FOUND'
    );
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 422, 'VALIDATION_ERROR');
    this.fields = fields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
