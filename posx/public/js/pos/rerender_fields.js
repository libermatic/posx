import { makeExtension } from '../utils';

export default function rerender_fields(ItemDetails) {
  return makeExtension(
    'rerender_fields',
    class ItemDetailsWithRerenderFields extends ItemDetails {
      bind_custom_control_change_event() {
        super.bind_custom_control_change_event();

        this.warehouse_control.df.read_only = 1;
        this.warehouse_control.refresh();

        frappe.ui.form.on('POS Invoice Item', 'rate', (frm, cdt, cdn) => {
          const doc = frappe.model.get_doc(cdt, cdn);
          if (
            this.current_item &&
            this.current_item.item_code === doc.item_code &&
            this.current_item.batch_no === doc.batch_no &&
            this.$item_price.is(':visible')
          ) {
            this.$item_price.html(format_currency(doc.rate, frm.doc.currency));
            this.render_discount_dom(doc);
          }
        });
      }
    }
  );
}
