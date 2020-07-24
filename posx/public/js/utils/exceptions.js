export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnableToSelectBatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnableToSelectBatchError';
  }
}

export class UnsupportedFeatureError extends ValidationError {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedFeatureError';
  }
}
