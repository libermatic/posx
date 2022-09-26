import { makeExtension } from '../utils';

/**
 * remove item from cart view and close item detail when qty is set to 0
 */
export default function fix_remove_row_on_zero(Controller) {
  return makeExtension(
    'fix_remove_row_on_zero',
    class ControllerWithFixRemoveRowOnZero extends Controller {
      init_item_details() {
        super.init_item_details();
        this.item_details.events.form_updated = async (item, field, value) => {
          const item_row = frappe.model.get_doc(item.doctype, item.name);
          if (item_row && item_row[field] != value) {
            if (field === 'qty' && flt(value) == 0) {
              this.remove_item_from_cart();
              return;
            }

            const args = { field, value, item: this.item_details.current_item };
            return this.on_cart_update(args);
          }
        };
      }
    }
  );
}
