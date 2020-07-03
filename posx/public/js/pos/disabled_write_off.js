import makeExtension from '../utils/make-extension';

export default function disabled_write_off(Pos) {
  return makeExtension(
    'disabled_write_off',
    class PaymentWithDisabledWriteOff extends Payment {
      make() {
        super.make();
        frappe.db
          .get_value(
            'POS Profile',
            this.frm.doc.pos_profile,
            'px_disabled_write_off'
          )
          .then(({ message: { px_disabled_write_off } = {} }) => {
            this.dialog.set_df_property(
              'write_off_amount',
              'read_only',
              Boolean(px_disabled_write_off)
            );
          });
      }
    }
  );
}
