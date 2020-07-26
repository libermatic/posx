import makeExtension from '../utils/make-extension';

export default function disabled_write_off(Pos) {
  return makeExtension(
    'disabled_write_off',
    class PaymentWithDisabledWriteOff extends Payment {
      make() {
        super.make();
        this.dialog.set_df_property(
          'write_off_amount',
          'read_only',
          Boolean(this.frm.config.px_disabled_write_off)
        );
      }
    }
  );
}
