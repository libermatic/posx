import base from './base';
import fixed_batch_selection from './fixed_batch_selection';
import batch_price from './batch_price';
import xz_report from './xz_report';
import shortcuts from './shortcuts';
import disabled_write_off from './disabled_write_off';
import theme from './theme';
import sw from './sw';
import stats from './stats';
import editable_description from './editable_description';
import hide_cart_numpad from './hide_cart_numpad';
import hide_payment_numpad from './hide_payment_numpad';

// compose applies functions from right to left
// place extensions that need to run first in the end

export const pageOverrides = [
  stats,
  sw,
  theme,
  shortcuts,
  xz_report,
  batch_price,
  fixed_batch_selection,
  editable_description,
  base,
];

export const cartOverrides = [hide_cart_numpad];

export const paymentOverrides = [hide_payment_numpad, disabled_write_off];
