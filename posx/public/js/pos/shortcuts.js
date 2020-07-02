import makeExtension from '../utils/make-extension';

export default function shortcuts(Pos) {
  return makeExtension(
    'shortcuts',
    class PosWithShortcuts extends Pos {
      make_cart() {
        super.make_cart();
        this._setup_cart_shortcuts();
      }
      _setup_cart_shortcuts() {
        const handle_selection = (direction) => {
          if (
            !this.page.wrapper.is(':visible') ||
            $(document.activeElement).is('input')
          ) {
            return;
          }
          const $list_item = this.cart.$cart_items.find(
            '.list-item.current-item'
          );

          const $item =
            direction === 'down'
              ? $list_item.length
                ? $list_item.next('.list-item')
                : this.cart.$cart_items.find('.list-item:first')
              : direction === 'up'
              ? $list_item.length
                ? $list_item.prev('.list-item')
                : this.cart.$cart_items.find('.list-item:last')
              : null;

          if ($item.length) {
            this.cart.set_selected_item($item);
          }
        };

        frappe.ui.keys.add_shortcut({
          shortcut: 'down',
          action: () => handle_selection('down'),
          page: this.page,
          description: __('Go to Next Cart Item'),
          ignore_inputs: true,
          condition: () => true,
        });
        frappe.ui.keys.add_shortcut({
          shortcut: 'up',
          action: () => handle_selection('up'),
          page: this.page,
          description: __('Go to Previous Cart Item'),
          ignore_inputs: true,
          condition: () => true,
        });
      }
    }
  );
}
