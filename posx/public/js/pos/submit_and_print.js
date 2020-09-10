import { clone } from 'ramda';
import makeExtension from '../utils/make-extension';

export default function submit_and_print(Pos) {
  return makeExtension(
    'submit_and_print',
    class PosWithSubmitAndPrint extends Pos {
      async submit_sales_invoice() {
        if (!this.frm.config.px_hide_modal) {
          super.submit_sales_invoice();
        } else {
          try {
            const { doc } = await this._handle_savesubmit();
            this.frm.doc.docstatus = doc.docstatus;
            frappe.show_alert({
              indicator: 'green',
              message: __(`Sales invoice ${doc.name} created succesfully`),
            });
          } catch (error) {
            frappe.throw('Something happened!');
          }
          this.toggle_editing();
          this.set_form_action();
          const frm = clone(this.frm);
          frm.print_preview.printit(true);
          this.make_new_invoice();
        }
      }

      async _handle_savesubmit() {
        this.frm.validate_form_action('Submit');
        frappe.validated = true;
        await this.frm.script_manager.trigger('before_submit');
        return new Promise((resolve, reject) => {
          this.frm.save('Submit', (r) => {
            if (r.exc) {
              reject(r);
            } else {
              frappe.utils.play_sound('submit');
              this.frm.script_manager
                .trigger('on_submit')
                .then(() => resolve(this.frm));
            }
          });
        });
      }
    }
  );
}

export function submit_and_print_payment(Payment) {
  return makeExtension(
    'submit_and_print_payment',
    class PaymentWithSubmitAndPrint extends Payment {
      set_primary_action() {
        super.set_primary_action();
        if (this.frm.config.px_hide_modal) {
          const $btn = this.dialog.get_primary_btn();
          $btn.text('Submit & Print');
        }
      }
    }
  );
}
