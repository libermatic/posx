import { compose } from 'ramda';

import { overrides } from '../serial_no_batch_selector';

const withOverrides = compose(...overrides);

export function show_serial_batch_selector(
  frm,
  d,
  callback,
  on_close,
  show_dialog
) {
  frappe.require(
    'assets/erpnext/js/utils/serial_no_batch_selector.js',
    function () {
      const SerialNoBatchSelector = withOverrides(
        erpnext.SerialNoBatchSelector
      );
      new SerialNoBatchSelector(
        {
          frm: frm,
          item: d,
          warehouse_details: {
            type: 'Warehouse',
            name: d.warehouse,
          },
          callback: callback,
          on_close: on_close,
        },
        show_dialog
      );
    }
  );
}
