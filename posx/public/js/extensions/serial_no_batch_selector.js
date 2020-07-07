import '../../../../../erpnext/erpnext/public/js/utils/serial_no_batch_selector';
import makeExtension from '../utils/make-extension';

function with_batch_price(SBSelector) {
  return makeExtension(
    'batch_price',
    class SBSelectorWithBatchPrice extends SBSelector {
      get_batch_fields() {
        const fields = super.get_batch_fields();
        try {
          if (frappe.flags.use_batch_price) {
            fields[1].fields[0].get_query = () => ({
              filters: {
                item_code: this.item_code,
                warehouse:
                  this.warehouse ||
                  typeof this.warehouse_details.name == 'string'
                    ? this.warehouse_details.name
                    : '',
              },
              query: 'posx.api.queries.get_batch_no',
            });
          }
          return fields;
        } catch (e) {
          if (e instanceof TypeError) {
            return fields;
          }
          throw e;
        }
      }
    }
  );
}

export function show_serial_batch_selector(
  frm,
  d,
  callback,
  on_close,
  show_dialog
) {
  const SerialNoBatchSelector = with_batch_price(erpnext.SerialNoBatchSelector);
  return new SerialNoBatchSelector(
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
