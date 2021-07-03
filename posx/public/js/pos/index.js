import discount_amount from './discount_amount';
import set_batch_number from './set_batch_number';
import fix_remove_row_on_zero from './fix_remove_row_on_zero';
import fix_late_cart_amount_update from './fix_late_cart_amount_update';
import rerender_fields from './rerender_fields';

export const controllerOverrides = [set_batch_number, fix_remove_row_on_zero];
export const cartOverrides = [discount_amount, fix_late_cart_amount_update];
export const detailsOverrides = [rerender_fields];
