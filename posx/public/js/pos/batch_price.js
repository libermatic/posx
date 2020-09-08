import makeExtension from '../utils/make-extension';

export async function set_batch_price_flag(pos_profile) {
  const { message: { px_use_batch_price } = {} } = await frappe.db.get_value(
    'POS Profile',
    pos_profile,
    'px_use_batch_price'
  );
  const use_batch_price = Boolean(px_use_batch_price);
  frappe.flags.use_batch_price = use_batch_price;
  return use_batch_price;
}

export async function set_batch_price(item) {
  if (!frappe.flags.use_batch_price) {
    return;
  }

  const { batch_no, item_code, qty, uom } = item;
  if (!batch_no) {
    return;
  }

  const {
    customer,
    selling_price_list: price_list,
    posting_date: transaction_date,
  } = frappe.get_doc(item.parenttype, item.parent);
  const { message: price_list_rate } = await frappe.call({
    method: 'posx.api.sales_invoice.get_batch_price',
    args: {
      batch_no,
      item_code,
      customer,
      price_list,
      qty,
      transaction_date,
      uom,
    },
  });

  return frappe.model.set_value(item.doctype, item.name, { price_list_rate });
}

export default function batch_price(Pos) {
  return makeExtension(
    'batch_price',
    class PosWithBatchPrice extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        frappe.flags.use_batch_price = Boolean(
          this.frm.config.px_use_batch_price
        );
        return result;
      }
      async update_cart_data(item) {
        if (item.has_batch_no) {
          frappe.dom.freeze();

          const { price_list_rate: prev } = item;
          await set_batch_price(item);
          const { price_list_rate: curr } = item;

          if (prev !== curr) {
            const { batch_no } = item;
            await this.frm.script_manager.trigger(
              'qty',
              item.doctype,
              item.name
            );

            // reset batch_no as mentioned in fixed_batch_selection
            await frappe.model.set_value(
              item.doctype,
              item.name,
              'batch_no',
              batch_no
            );

            // async on_qty_change is being called synchronously.
            // therefore, subsequent post_qty_change renders total with stale value.
            // so this will re-render with current values
            this.post_qty_change(item);
          }

          frappe.dom.unfreeze();
        }
        return super.update_cart_data(item);
      }
    }
  );
}
