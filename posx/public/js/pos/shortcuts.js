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
        const should_trigger = () => this.page.wrapper.is(':visible');
        const handle_selection = (direction) => {
          const $current_item = this.cart.$cart_items.find(
            '.list-item.current-item'
          );
          const $item =
            direction === 'down'
              ? $current_item.length
                ? $current_item.next('.list-item')
                : this.cart.$cart_items.find('.list-item:first')
              : direction === 'up'
              ? $current_item.length
                ? $current_item.prev('.list-item')
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
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });
        frappe.ui.keys.add_shortcut({
          shortcut: 'up',
          action: () => handle_selection('up'),
          page: this.page,
          description: __('Go to Previous Cart Item'),
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });

        const handle_qty_change = (direction) => {
          const $current_item = this.cart.$cart_items.find(
            '.list-item.current-item'
          );
          if ($current_item.length) {
            const item_code = $current_item.data('item-code');
            const batch_no = $current_item.data('batch-no');
            const qty =
              direction === 'decrement'
                ? '-1'
                : direction === 'increment'
                ? '+1'
                : 0;
            if (qty) {
              this.update_item_in_cart(item_code, 'qty', qty, batch_no);
            }
          }
        };

        frappe.ui.keys.add_shortcut({
          shortcut: 'left',
          action: () => handle_qty_change('decrement'),
          page: this.page,
          description: __('Decrease Selected Cart Item Qty'),
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });
        frappe.ui.keys.add_shortcut({
          shortcut: 'right',
          action: () => handle_qty_change('increment'),
          page: this.page,
          description: __('Increase Selected Cart Item Qty'),
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });

        const handle_qty_focus = () => {
          const $current_item = this.cart.$cart_items.find(
            '.list-item.current-item'
          );
          if ($current_item.length) {
            $current_item.find('.quantity input').select();
          }
        };

        frappe.ui.keys.add_shortcut({
          shortcut: 'enter',
          action: () => handle_qty_focus(),
          page: this.page,
          description: __('Focus on Selected Cart Item Qty'),
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });

        const handle_delete = () => {
          const $current_item = this.cart.$cart_items.find(
            '.list-item.current-item'
          );
          if ($current_item.length) {
            const item_code = $current_item.data('item-code');
            const batch_no = $current_item.data('batch-no');
            this.update_item_in_cart(item_code, 'qty', 0, batch_no);
          }
        };

        frappe.ui.keys.add_shortcut({
          shortcut: 'backspace',
          action: () => handle_delete(),
          page: this.page,
          description: __('Remove Selected Cart Item'),
          ignore_inputs: false,
          condition: should_trigger.bind(this),
        });
      }
    }
  );
}
