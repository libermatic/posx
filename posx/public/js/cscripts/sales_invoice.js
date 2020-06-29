import { get_xz_report } from '../pos/xz_report';

export default function sales_invoice() {
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
