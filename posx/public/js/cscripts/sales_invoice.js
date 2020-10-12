import { get_xz_report } from '../pos/xz_report';
import { set_batch_price, set_batch_price_flag } from '../pos/batch_price';

function proxy_local_doc(doc) {
  locals[doc.doctype][doc.name] = new Proxy(locals[doc.doctype][doc.name], {
    set: function (doc, field, value) {
      doc[field] = value;
      if (field === 'batch_no' && value) {
        set_batch_price(doc);
      }
      return true;
    },
  });
}

export function sales_invoice_item() {
  return {
    items_add: function (frm, cdt, cdn) {
      const item = frappe.get_doc(cdt, cdn);
      proxy_local_doc(item);
    },
  };
}

export function sales_invoice() {
  return {
    onload: function (frm) {
      frappe.flags.use_batch_price = false;
      if (frm.doc.docstatus < 1) {
        const { pos_profile } = frm.doc;
        if (pos_profile) {
          set_batch_price_flag(pos_profile);
        }
        frm.doc.items.forEach(proxy_local_doc);
      }
    },
    is_pos: async function (frm) {
      const { is_pos, company } = frm.doc;
      if (is_pos && company && !frm.doc.pos_profile) {
        const {
          message: {
            name: pos_profile,
            px_use_batch_price: use_batch_price,
          } = {},
        } = await frappe.call({
          method: 'erpnext.stock.get_item_details.get_pos_profile',
          args: { company },
        });
        frappe.flags.use_batch_price = Boolean(use_batch_price);
        if (pos_profile) {
          get_xz_report(pos_profile, company);
        }
      }
    },
    pos_profile: async function (frm) {
      const { pos_profile, company } = frm.doc;
      if (pos_profile) {
        set_batch_price_flag(pos_profile);

        // hack to prevent multiple dialogs,
        // because trigger does not run when pos page is refreshed
        if (!frappe.get_route_str().includes('point-of-sale')) {
          get_xz_report(pos_profile, company);
        }
      }
    },
  };
}
