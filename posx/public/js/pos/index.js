import discount_amount from './discount_amount';
import set_batch_number from './set_batch_number';
import fix_remove_row_on_zero from './fix_remove_row_on_zero';
import fix_cart_renders from './fix_cart_renders';
import allow_zero_payment from './allow_zero_payment';
import ignore_availability from './ignore_availability';
import fix_null_qty_for_service_items from './fix_null_qty_for_service_items';
import fix_stock_check_fail_for_service_items from './fix_stock_check_fail_for_service_items';
import fix_cart_qty_not_incremented from './fix_cart_qty_not_incremented';
import fix_console_err_accessing_mobile_no from './fix_console_err_accessing_mobile_no';

export const controllerOverrides = [
  ignore_availability,
  fix_stock_check_fail_for_service_items,
  set_batch_number,
  fix_remove_row_on_zero,
  fix_cart_qty_not_incremented,
];
export const cartOverrides = [discount_amount, fix_cart_renders];
export const paymentOverrides = [
  allow_zero_payment,
  fix_console_err_accessing_mobile_no,
];
export const selectorOverrides = [fix_null_qty_for_service_items];
