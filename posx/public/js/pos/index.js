import base from './base';
import fixed_batch_selection from './fixed_batch_selection';
import batch_price from './batch_price';
import xz_report from './xz_report';
import shortcuts from './shortcuts';
import disabled_write_off from './disabled_write_off';
import theme from './theme';
import sw from './sw';
import stats from './stats';
import local_draft, { local_draft_cart } from './local_draft';
import editable_description from './editable_description';
import hide_cart_numpad from './hide_cart_numpad';
import hide_payment_numpad from './hide_payment_numpad';
import submit_and_print, { submit_and_print_payment } from './submit_and_print';
import offline_print from './offline_print';
import fixed_renders from './fixed_renders';
import { updated_cart } from './cart';

// compose applies functions from right to left
// place extensions that need to run first in the end

export const pageOverrides = [
  stats,
  offline_print,
  sw,
  theme,
  submit_and_print,
  xz_report,
  batch_price,
  fixed_batch_selection,
  updated_cart,
  shortcuts,
  local_draft,
  editable_description,
  base,
];

export const cartOverrides = [
  hide_cart_numpad,
  local_draft_cart,
  fixed_renders,
];

export const paymentOverrides = [
  hide_payment_numpad,
  submit_and_print_payment,
  disabled_write_off,
];
