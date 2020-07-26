import makeExtension from '../utils/make-extension';

export default function hide_cart_numpad(Cart) {
  return makeExtension(
    'hide_cart_numpad',
    class CartWithHiddenNumpad extends Cart {
      make() {
        super.make();
        this.dialog.set_df_property(
          'numpad',
          'hidden',
          Boolean(this.frm.config.px_hide_numpads)
        );
      }
    }
  );
}
