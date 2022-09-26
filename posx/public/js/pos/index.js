import discount_amount from './discount_amount';
import fix_remove_row_on_zero from './fix_remove_row_on_zero';
import fix_cart_renders from './fix_cart_renders';
import allow_zero_payment from './allow_zero_payment';
import ignore_availability from './ignore_availability';
import fix_cart_qty_not_incremented from './fix_cart_qty_not_incremented';

export const controllerOverrides = [
  ignore_availability,
  fix_remove_row_on_zero,
  fix_cart_qty_not_incremented,
];
export const cartOverrides = [discount_amount, fix_cart_renders];
export const paymentOverrides = [allow_zero_payment];
