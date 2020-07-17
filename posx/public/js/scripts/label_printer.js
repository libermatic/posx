export function label_printer() {
  return {
    setup: function (frm) {
      frm.set_query('print_dt', () => ({
        filters: [['name', 'in', 'Purchase Receipt, Purchase Invoice']],
      }));
      frm.set_query('print_dn', ({ company }) => ({
        filters: { company },
      }));
      ['print_dt', 'print_dn'].forEach((field) => {
        frm.set_df_property(field, 'only_select', 1);
      });

      frm.page.wrapper.on('view-change', () => {
        setup_buttons(frm);
      });
    },
    refresh: function (frm) {
      setup_buttons(frm);
    },
    print_dn: async function (frm) {
      const { print_dt, print_dn } = frm.doc;
      if (print_dt && print_dn) {
        try {
          frappe.dom.freeze();
          await frappe.call({
            method: 'set_items_from_reference',
            doc: frm.doc,
          });
          frm.refresh_field('items');
        } finally {
          frappe.dom.unfreeze();
        }
      }
    },
  };
}

export function label_printer_item() {
  return {
    item_code: async function (frm, cdt, cdn) {
      const { item_code } = frappe.get_doc(cdt, cdn) || {};
      const { price_list } = frm.doc;
      if (item_code && price_list) {
        const { message: price } = await frappe.call({
          method: 'posx.api.label_printer.get_price',
          args: { item_code, price_list },
        });
        frappe.model.set_value(cdt, cdn, 'price', price);
      } else {
        frappe.model.set_value(cdt, cdn, 'price', null);
      }
    },
  };
}

function setup_buttons(frm) {
  frm.disable_save();
  const is_print_preview = frm.page.current_view_name === 'print' || frm.hidden;

  frm.page.set_primary_action('Print', async function () {
    console.log('primary_action');
    if (!is_print_preview) {
      let has_errored;
      await frm.save(undefined, undefined, undefined, () => {
        has_errored = true;
      });
      if (!has_errored) {
        frm.print_doc();
      }
    }
  });

  frm.page.set_secondary_action('Clear', async function () {
    ['print_dt', 'print_dn', 'skip'].forEach((field) =>
      frm.set_value(field, null)
    );
    frm.clear_table('items');
    frm.refresh_field('items');
  });
  frm.page.btn_secondary.toggle(!is_print_preview);
}
