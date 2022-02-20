import { makeExtension } from '../utils';

/**
 * fix case when an existing item in cart is added as a new row when
 * pricing rule is used
 */
export default function fix_cart_qty_not_incremented(Controller) {
  return makeExtension(
    'fix_cart_qty_not_incremented',
    class ControllerWithFixCartQtyNotIncremented extends Controller {
      get_item_from_frm({ name, item_code, batch_no, uom, rate }) {
        if (name) {
          return super.get_item_from_frm({
            name,
            item_code,
            batch_no,
            uom,
            rate,
          });
        }

        // seems the `rate` prop originates from a `data-rate` attr stored in
        // the item selector list dom. so the below code should ONLY run when
        // a new item is added from the selector.
        // for everything else, like when looking up an item from the cart, the
        // `name` prop is used AFAIK, the patch code should never run.
        return (
          this.frm.doc.items.find(
            (i) =>
              i.item_code === item_code &&
              (!batch_no || i.batch_no === batch_no) &&
              i.uom === uom &&
              i.price_list_rate == rate
          ) || {}
        );
      }
    }
  );
}
