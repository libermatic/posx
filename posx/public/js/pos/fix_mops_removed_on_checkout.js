import { makeExtension } from '../utils';

/**
 * this should be remove when frappe/erpnext#29981 is solved
 */
export default function fix_mops_removed_on_checkout(Controller) {
  return makeExtension(
    'fix_mops_removed_on_checkout',
    class ControllerWithMOPsRemovedOnCheckout extends Controller {
      async save_and_checkout() {
        // originally https://github.com/frappe/erpnext/blob/f87ba6ac0a07bd3f0f7195afa9ba6071cfcc21d1/erpnext/selling/page/point_of_sale/pos_controller.js#L717-L720
        this.payment.checkout();
      }
    }
  );
}
