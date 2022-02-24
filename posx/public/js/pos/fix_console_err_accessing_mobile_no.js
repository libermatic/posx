import { makeExtension } from '../utils';

/**
 * hack to fix console error because of referencing non-existent property
 */
export default function fix_console_err_accessing_mobile_no(Payment) {
  return makeExtension(
    'fix_console_err_accessing_mobile_no',
    class PaymentFixConsoleErrWhenAccessingMobileNo extends Payment {
      bind_events() {
        this.request_for_payment_field = { $input: $('<div />') };
        super.bind_events();
      }
    }
  );
}
