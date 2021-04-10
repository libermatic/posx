import { makeExtension } from '../utils';

export default function set_batch_number(Controller) {
  return makeExtension(
    'set_batch_number',
    class ControllerWithSetBatchNumber extends Controller {
      prepare_components() {
        super.prepare_components();
        frappe.ui.form.on('POS Invoice Item', 'rate', (frm, cdt, cdn) => {
          const doc = frappe.model.get_doc(cdt, cdn);
          if (this.cart.get_cart_item(doc).length > 0) {
            this.cart.update_item_html(doc);
          }
        });
      }
      async trigger_new_item_events(item_row) {
        item_row.warehouse = this.frm.doc.set_warehouse;
        await super.trigger_new_item_events(item_row);
      }
    }
  );
}
