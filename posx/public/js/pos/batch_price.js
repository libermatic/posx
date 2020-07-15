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

  frappe.model.set_value(item.doctype, item.name, { price_list_rate });
}

export default function batch_price(Pos) {
  return makeExtension(
    'batch_price',
    class PosWithBatchPrice extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        await set_batch_price_flag(this.frm.doc.pos_profile);
        return result;
      }
      async update_item_in_frm(item, field, value) {
        const result = await super.update_item_in_frm(item, field, value);
        if (!['rate', 'discount_percentage'].includes(field)) {
          await set_batch_price(item);
        }
        return result;
      }
    }
  );
}
