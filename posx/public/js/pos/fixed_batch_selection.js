import makeExtension from './factory';

export default function fixed_batch_selection(Pos) {
  return makeExtension(
    'fixed_batch_selection',
    class PosWithFixedBatchSelection extends Pos {
      async update_item_in_frm(item, field, value) {
        const { batch_no } = item;
        const result = await super.update_item_in_frm(item, field, value);

        // batch_no is reset to defaults received from backend `get_item_details`
        // by qty trigger in super.update_item_in_frm
        await frappe.model.set_value(
          item.doctype,
          item.name,
          'batch_no',
          batch_no
        );

        // cart_items are being rendered with prev batch_no, so changing batch
        // ends up with two rows in the render while model has correct values
        this.cart.$cart_items.empty();
        this.cart.$cart_items.append(
          this.frm.doc.items.map(this.cart.get_item_html.bind(this.cart))
        );
        return result;
      }
    }
  );
}
