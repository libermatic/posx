import { makeExtension, waitToChange } from '../utils';

/**
 * hack to fix totals not rendering when ItemDetails fields are updated
 */
export default function fix_cart_totals(ItemCart) {
  return makeExtension(
    'fix_cart_totals',
    class ItemCartFixCartTotals extends ItemCart {
      bind_events() {
        super.bind_events();
        frappe.model.on('POS Invoice Item', 'rate', () => {
          waitToChange('grand_total', this.events.get_frm().doc, 5000).then(
            () => this.update_totals_section()
          );
        });
      }
    }
  );
}
