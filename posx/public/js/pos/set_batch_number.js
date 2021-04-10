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
          if (
            this.item_details.current_item &&
            this.item_details.current_item.item_code === doc.item_code &&
            this.item_details.current_item.batch_no === doc.batch_no &&
            this.item_details.$item_price.is(':visible')
          ) {
            this.item_details.$item_price.html(
              format_currency(doc.rate, frm.doc.currency)
            );
            this.item_details.render_discount_dom(doc);
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
