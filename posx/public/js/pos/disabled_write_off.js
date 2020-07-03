import makeExtension from '../utils/make-extension';

export default function disabled_write_off(Pos) {
  return makeExtension(
    'disabled_write_off',
    class PosWithDisabledWriteOff extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        this._disabled_write_off = await is_disabled_write_off(
          this.frm.doc.pos_profile
        );
        return result;
      }
    }
  );
}

export function payment_with_disabled_write_off(Payment) {
  return makeExtension(
    'disabled_write_off',
    class PaymentWithDisabledWriteOff extends Payment {
      get_fields() {
        const fields = super.get_fields();
        const idx = fields.findIndex((x) => x.fieldname === 'write_off_amount');
        if (idx > -1) {
          fields[idx].read_only = Number(this._disabled_write_off || false);
        }
        return fields;
      }
    }
  );
}

async function is_disabled_write_off(pos_profile) {
  const { message: { px_disabled_write_off } = {} } = await frappe.db.get_value(
    'POS Profile',
    pos_profile,
    'px_disabled_write_off'
  );
  return Boolean(px_disabled_write_off);
}
