import { makeExtension } from '../utils';

/**
 * hack to fix item cart amount render not following model update
 */
export default function fix_late_cart_amount_update(ItemCart) {
  return makeExtension(
    'fix_late_cart_amount_update',
    class ItemCartWithFixLateCartAmountUpdate extends ItemCart {
      render_cart_item(item_data, $item_to_update) {
        super.render_cart_item(item_data, $item_to_update);
        $item_to_update.find('.item-qty-rate').html(
          get_rate_discount_html({
            qty: item_data.qty,
            rate: item_data.rate,
            currency: this.events.get_frm().doc.currency,
          })
        );
      }
    }
  );
}

function get_rate_discount_html({ rate, qty, currency }) {
  const amount = (qty || 0) * rate;
  if (qty !== 1) {
    return `
      <div class="item-qty"><span>${qty || 0}</span></div>
      <div class="item-rate-amount">
        <div class="item-rate">${format_currency(amount, currency)}</div>
        <div class="item-amount">${format_currency(rate, currency)}</div>
      </div>
    `;
  } else {
    return `
      <div class="item-qty"><span>${qty || 0}</span></div>
      <div class="item-rate-amount">
        <div class="item-rate">${format_currency(rate, currency)}</div>
      </div>
    `;
  }
}
