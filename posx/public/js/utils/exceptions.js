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

export class MultiplePricingRuleConflict extends ValidationError {
  constructor(message) {
    super(message);
    this.name = 'MultiplePricingRuleConflict';
  }
}

export class PriceListNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = 'PriceListNotFound';
  }
}

export class MandatoryEntityNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = 'MandatoryEntityNotFound';
  }
}
