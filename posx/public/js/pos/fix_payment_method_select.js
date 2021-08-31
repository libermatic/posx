import { makeExtension } from '../utils';

/**
 * fixes issue where clearing the default payment method was not happening
 * should remove when upstream handles this
 */
export default function fix_payment_method_select(Payment) {
  return makeExtension(
    'fix_payment_method_select',
    class PaymentFixPaymentMethodSelect extends Payment {
      render_payment_section() {
        this.render_payment_mode_dom(true /* set_default */);
        this.make_invoice_fields_control();
        this.update_totals_section();
      }
      render_payment_mode_dom(set_default = false) {
        const doc = this.events.get_frm().doc;
        const payments = doc.payments;
        const currency = doc.currency;

        this.$payment_modes.html(
          `${payments
            .map((p, i) => {
              const mode = p.mode_of_payment.replace(/ +/g, '_').toLowerCase();
              const payment_type = p.type;
              const margin = i % 2 === 0 ? 'pr-2' : 'pl-2';
              const amount =
                p.amount > 0 ? format_currency(p.amount, currency) : '';

              return `
					<div class="payment-mode-wrapper">
						<div class="mode-of-payment" data-mode="${mode}" data-payment-type="${payment_type}">
							${p.mode_of_payment}
							<div class="${mode}-amount pay-amount">${amount}</div>
							<div class="${mode} mode-of-payment-control"></div>
						</div>
					</div>
				`;
            })
            .join('')}`
        );

        payments.forEach((p) => {
          const mode = p.mode_of_payment.replace(/ +/g, '_').toLowerCase();
          const me = this;
          this[`${mode}_control`] = frappe.ui.form.make_control({
            df: {
              label: p.mode_of_payment,
              fieldtype: 'Currency',
              placeholder: __('Enter {0} amount.', [p.mode_of_payment]),
              onchange: function () {
                const current_value = frappe.model.get_value(
                  p.doctype,
                  p.name,
                  'amount'
                );
                if (current_value != this.value) {
                  frappe.model
                    .set_value(p.doctype, p.name, 'amount', flt(this.value))
                    .then(() => me.update_totals_section());

                  const formatted_currency = format_currency(
                    this.value,
                    currency
                  );
                  me.$payment_modes
                    .find(`.${mode}-amount`)
                    .html(formatted_currency);
                }
              },
            },
            parent: this.$payment_modes.find(
              `.${mode}.mode-of-payment-control`
            ),
            render_input: true,
          });
          this[`${mode}_control`].toggle_label(false);
          this[`${mode}_control`].set_value(p.amount);

          if (set_default && p.default) {
            setTimeout(() => {
              this.$payment_modes
                .find(`.${mode}.mode-of-payment-control`)
                .parent()
                .click();
            }, 500);
          }
        });

        this.render_loyalty_points_payment_mode();

        this.attach_cash_shortcuts(doc);
      }

      /**
       * temporary fix.
       * being resolved by https://github.com/frappe/erpnext/pull/27251
       */
      auto_set_remaining_amount() {
        const doc = this.events.get_frm().doc;
        const grand_total = cint(frappe.sys_defaults.disable_rounded_total)
          ? doc.grand_total
          : doc.rounded_total;
        const remaining_amount = grand_total - doc.paid_amount;
        const current_value = this.selected_mode
          ? this.selected_mode.get_value()
          : undefined;
        if (!current_value && remaining_amount > 0 && this.selected_mode) {
          this.selected_mode.set_value(remaining_amount);
        }
      }
    }
  );
}
