import { makeExtension, waitToChange } from '../utils';

/**
 * hack to fix various renders when model changes
 */
export default function fix_cart_renders(ItemCart) {
  return makeExtension(
    'fix_cart_renders',
    class ItemCartFixCartRenders extends ItemCart {
      bind_events() {
        super.bind_events();
        frappe.model.on('POS Invoice Item', '*', (fieldname, value, doc) => {
          if (['rate', 'qty'].includes(fieldname)) {
            // totals not rendering when ItemDetails fields are updated
            waitToChange('amount', doc, 5000).then(() => {
              if (this.get_item_from_frm(doc)) {
                this.update_item_html(doc);
              }
            });

            // item cart amount render not following model update
            if (fieldname === 'rate') {
              waitToChange('grand_total', this.events.get_frm().doc, 5000).then(
                () => {
                  this.update_totals_section();
                }
              );
            }
          }
        });
      }
    }
  );
}
