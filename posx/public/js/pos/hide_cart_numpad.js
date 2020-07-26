import makeExtension from '../utils/make-extension';

export default function hide_cart_numpad(Cart) {
  return makeExtension(
    'hide_cart_numpad',
    class CartWithHiddenNumpad extends Cart {
      make_numpad() {
        super.make_numpad();
        this.wrapper
          .find('.number-pad-container > .number-pad')
          .toggleClass('hidden', !!this.frm.config.px_hide_numpads);
        if (this.frm.config.px_hide_numpads) {
          this._make_button_controls();
        }
      }
      _make_button_controls() {
        const $btn = $(`
            <div style="margin: 1em 0;">
                <button class="btn btn-primary px-pay-btn" style="width: 100%">
                    Pay
                </buton>
            </div>
        `);
        $btn.find('.px-pay-btn').on('click', () => {
          this.numpad.onclick(Pay);
        });
        this.wrapper.find('.number-pad-container').append($btn);
      }
    }
  );
}
