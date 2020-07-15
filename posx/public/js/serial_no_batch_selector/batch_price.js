import makeExtension from '../utils/make-extension';

export default function with_batch_price(SBSelector) {
  return makeExtension(
    'batch_price',
    class SBSelectorWithBatchPrice extends SBSelector {
      get_batch_fields() {
        const fields = super.get_batch_fields();
        try {
          if (frappe.flags.use_batch_price) {
            const [batch_no, ...rest] = fields[1].fields;
            batch_no.get_query = () => ({
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
            fields[1].fields = [
              batch_no,
              {
                fieldtype: 'Currency',
                read_only: 1,
                fieldname: 'batch_price_list_rate',
                label: __('Batch Price'),
                in_list_view: 1,
              },
              ...rest,
            ];
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
