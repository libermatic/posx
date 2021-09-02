import { makeExtension, waitToChange } from '../utils';

/**
 * fixes undefined `taxes` prop in frm.doc on new invoice
 */
export default function fix_cart_renders(ItemCart) {
  return makeExtension(
    'fix_cart_renders',
    class ItemCartFixCartRenders extends ItemCart {
      render_taxes(taxes) {
        super.render_taxes(taxes || []);
      }
    }
  );
}
