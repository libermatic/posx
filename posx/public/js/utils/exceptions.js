export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnsupportedFeatureError extends ValidationError {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedFeatureError';
  }
}
