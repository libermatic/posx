import makeExtension from '../utils/make-extension';

export default function with_batch_price(SBSelector) {
  return makeExtension(
    'batch_price',
    class SBSelectorWithBatchPrice extends SBSelector {
      make_dialog() {
        super.make_dialog();
        if (frappe.flags.use_batch_price) {
          const request_args = this._get_batch_request_args();
          Promise.all(
            this.dialog.fields_dict.batches.df.data
              .filter((x) => !!x.batch_no)
              .map((x) =>
                frappe
                  .call({
                    method: 'posx.api.sales_invoice.get_batch_price',
                    args: { ...request_args, batch_no: x.batch_no },
                  })
                  .then(({ message: batch_price_list_rate }) => {
                    x.batch_price_list_rate = batch_price_list_rate;
                  })
              )
          ).then(() => this.dialog.fields_dict.batches.refresh());
        }
      }
      get_batch_fields() {
        const fields = super.get_batch_fields();
        try {
          if (frappe.flags.use_batch_price) {
            const [batch_no, ...rest] = fields[1].fields;
            const request_args = this._get_batch_request_args();

            fields[1].fields = [
              mod_batch_no_field(batch_no, request_args),
              {
                fieldtype: 'Currency',
                read_only: 1,
                fieldname: 'batch_price_list_rate',
                label: __('Price List Rate'),
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
      _get_batch_request_args() {
        const { warehouse_details: { name: warehouse } = {}, item_code } = this;
        const {
          customer,
          posting_date: transaction_date,
          selling_price_list: price_list,
          company,
        } = this.frm.doc;
        return {
          warehouse,
          item_code,
          customer,
          transaction_date,
          price_list,
          company,
        };
      }
    }
  );
}

function mod_batch_no_field(
  field,
  { warehouse, item_code, customer, transaction_date, price_list }
) {
  return {
    ...field,
    get_query: () => ({
      filters: { item_code, warehouse },
      query: 'posx.api.queries.get_batch_no',
    }),
    change: async function () {
      const batch_no = this.get_value();
      if (!batch_no) {
        this.grid_row.on_grid_fields_dict.available_qty.set_value(0);
        return;
      }

      if (
        this.grid.grid_rows.filter(
          (x) => x !== this.grid_row && x.doc && x.doc.batch_no === batch_no
        ).length > 0
      ) {
        this.set_value('');
        frappe.throw(__(`Batch ${batch_no} already selected.`));
        return;
      }

      if (warehouse) {
        const {
          message: { available_qty, batch_price_list_rate },
        } = await frappe.call({
          method: 'posx.api.sales_invoice.get_batch_qty',
          args: {
            batch_no,
            warehouse,
            item_code,
            customer,
            price_list,
            transaction_date,
          },
        });
        this.grid_row.on_grid_fields_dict.available_qty.set_value(
          available_qty || 0
        );
        this.grid_row.on_grid_fields_dict.batch_price_list_rate.set_value(
          batch_price_list_rate || 0
        );
      } else {
        this.set_value('');
        frappe.throw(
          __('Please select a warehouse to get available quantities')
        );
      }
    },
  };
}
