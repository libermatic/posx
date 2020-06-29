import { get_xz_report } from '../pos/xz_report';

export function sales_invoice_item() {
  return {
    batch_no: async function (frm, cdt, cdn) {
      const { batch_no, item_code, qty } = frappe.get_doc(cdt, cdn) || {};
      if (!batch_no) {
        return;
      }
      const {
        customer,
        selling_price_list: price_list,
        posting_date: transaction_date,
      } = frm.doc;
      const { message: price_list_rate } = await frappe.call({
        method: 'posx.api.sales_invoice.get_batch_price',
        args: {
          batch_no,
          item_code,
          customer,
          price_list,
          qty,
          transaction_date,
        },
      });
      console.log(price_list_rate);

      frappe.model.set_value(cdt, cdn, { price_list_rate });
    },
  };
}

export function sales_invoice() {
  return {
    is_pos: async function (frm) {
      const { is_pos, company } = frm.doc;
      if (is_pos && company && !frm.doc.pos_profile) {
        const { message: { name: pos_profile } = {} } = await frappe.call({
          method: 'erpnext.stock.get_item_details.get_pos_profile',
          args: { company },
        });
        if (pos_profile) {
          get_xz_report(pos_profile, company);
        }
      }
    },
    pos_profile: async function (frm) {
      const { pos_profile, company } = frm.doc;
      if (pos_profile) {
        get_xz_report(pos_profile, company);
      }
    },
  };
}
