import base from './base';
import discount_amount from './discount_amount';
import set_batch_number from './set_batch_number';
import fix_remove_row_on_zero from './fix_remove_row_on_zero';
import fix_cart_renders from './fix_cart_renders';


export const controllerOverrides = [set_batch_number, fix_remove_row_on_zero, base];
export const cartOverrides = [discount_amount, fix_cart_renders];
