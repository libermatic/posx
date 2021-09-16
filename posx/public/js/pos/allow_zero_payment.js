import { makeExtension, waitToChange } from '../utils';

/**
 * allow invoices with zero paid amount to be submitted
 */
export default function allow_zero_payment(Payment) {
  return makeExtension(
    'allow_zero_payment',
    class PaymentAllowZeroPayment extends Payment {
      bind_events() {
        super.bind_events();

        // should probably NOT use global instance cur_pos.
        // but this mitigates the issue of passing in the pos_profile object from the controller
        if (cur_pos && cur_pos.settings && cur_pos.settings.px_allow_zero_payment) {
          this.$component.off('click', '.submit-order-btn');
          this.$component.on('click', '.submit-order-btn', () => {
            const { items } = this.events.get_frm().doc;

            if (!items.length) {
              const message = __('You cannot submit empty order.');
              frappe.show_alert({ message, indicator: 'orange' });
              frappe.utils.play_sound('error');
              return;
            }

            this.events.submit_invoice();
          });
        }
      }
    }
  );
}
