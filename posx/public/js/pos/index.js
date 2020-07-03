import fixed_batch_selection from './fixed_batch_selection';
import batch_price from './batch_price';
import xz_report from './xz_report';
import shortcuts from './shortcuts';
import disabled_write_off, {
  payment_with_disabled_write_off,
} from './disabled_write_off';

// compose applies functions from right to left
// place extensions that need to run first in the end

export const pageOverrides = [
  disabled_write_off,
  shortcuts,
  xz_report,
  batch_price,
  fixed_batch_selection,
];

export const paymentOverrides = [payment_with_disabled_write_off];
