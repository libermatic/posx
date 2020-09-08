import makeExtension from '../utils/make-extension';

export default function fixed_batch_selection(Pos) {
  return makeExtension(
    'fixed_batch_selection',
    class PosWithFixedBatchSelection extends Pos {
      update_item_in_cart(item_code, field = 'qty', value = 1, batch_no) {
        if (field === 'qty' && this.cart.exists(item_code, batch_no)) {
          const item = this.frm.doc.items.find((x) =>
            batch_no ? x.batch_no === batch_no : x.item_code === item_code
          );

          const updated_qty =
            typeof value === 'string' ? item[field] + flt(value) : value;
          const show_dialog = this._should_show_sb_selector(item, updated_qty);

          frappe.flags.hide_serial_batch_dialog = false;

          if (show_dialog) {
            frappe.dom.freeze();
            this.select_batch_and_serial_no(item);
          } else {
            this.update_item_in_frm(item, field, updated_qty).then(() => {
              frappe.dom.unfreeze();
              frappe.run_serially([
                () => this.on_qty_change(item),
                () => this.post_qty_change(item),
              ]);
            });
          }
        } else {
          super.update_item_in_cart(item_code, field, value, batch_no);
        }
      }

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
        return result;
      }

      async update_cart_data(item) {
        const result = await super.update_cart_data(item);

        // cart_items are being rendered with prev batch_no, so changing batch
        // ends up with two rows in the render while model has correct values
        this.cart.$cart_items.empty();
        this.cart.$cart_items.append(
          this.frm.doc.items.map(this.cart.get_item_html.bind(this.cart))
        );
        return result;
      }

      _should_show_sb_selector(item, update_qty) {
        if (update_qty === 0) {
          return false;
        }
        if (item.has_serial_no) {
          return true;
        }
        if (item.has_batch_no) {
          if (!item.batch_no) {
            return true;
          }

          // will always show if multiple batches exists in cart
          if (
            this.frm.doc.items.filter((x) => x.item_code == item.item_code)
              .length > 1
          ) {
            return true;
          }

          // upstream: will not show if actual_qty = actual_batch_qty
          // here: not show selector until the updated_qty is greater than the
          // actual_batch_qty
          if (item.actual_batch_qty < update_qty) {
            return true;
          }
        }
        return false;
      }
    }
  );
}
