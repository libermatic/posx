import { makeExtension } from '../utils';

export default function fix_syntax_error(Controller) {
  return makeExtension(
    'fix_syntax_error',
    class ControllerWithFixSyntaxError extends Controller {
      init_item_details() {
        super.init_item_details();
        this.item_details.events.form_updated = async function (
          cdt,
          cdn,
          fieldname,
          value
        ) {
          const item_row = frappe.model.get_doc(cdt, cdn);
          if (item_row && item_row[fieldname] != value) {
            if (fieldname === 'qty' && flt(value) == 0) {
              this.remove_item_from_cart();
              return;
            }

            const { item_code, batch_no, uom } = this.item_details.current_item;
            const event = {
              field: fieldname,
              value,
              item: { item_code, batch_no, uom },
            };
            return this.on_cart_update(event);
          }
        }.bind(this);
      }
    }
  );
}
