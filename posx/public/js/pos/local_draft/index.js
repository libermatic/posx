import Vue from 'vue/dist/vue.js';

import SavedInvoices from './SavedInvoices.vue';
import LocalDraft from './LocalDraft.vue';
import makeExtension from '../../utils/make-extension';
import { uuid4 } from '../../utils';
import db from '../../store/db';

export function showSavedInvoices({ onSelect }) {
  const dialog = new frappe.ui.Dialog({
    title: 'Saved Invoices',
  });
  new Vue({
    el: dialog.body,
    render: (h) =>
      h(SavedInvoices, {
        props: {
          onSelect: (ofn) => onSelect(ofn).then(() => dialog.hide()),
        },
      }),
  });
  dialog.show();
  dialog.onhide = function () {
    this.$wrapper.remove();
  };
}

export default function local_draft(Pos) {
  return makeExtension(
    'local_draft',
    class PosWithLocalDraft extends Pos {
      make_cart() {
        super.make_cart();
        if (
          this.frm.config.px_use_local_draft &&
          !this.frm.config.px_use_cart_ext
        ) {
          this._make_local_draft_action();
        }
      }
      prepare_menu() {
        super.prepare_menu();
        this.page.add_menu_item(
          __('Pending Sales'),
          this._local_draft_on_list.bind(this)
        );
      }

      _make_local_draft_action() {
        const $container = $('<div />');
        this.$px_actions.prepend($container);

        new Vue({
          el: $container[0],
          render: (h) =>
            h(LocalDraft, {
              props: {
                onSave: this._local_draft_on_save.bind(this),
                onList: this._local_draft_on_list.bind(this),
                onPrev: this._local_draft_on_prev.bind(this),
              },
            }),
        });
      }

      async _local_draft_on_save() {
        if (this.frm.doc.items.length === 0) {
          frappe.msgprint(__('Please add items to the cart first'));
          return;
        }

        const offline_pos_name = this.frm.doc.offline_pos_name || uuid4();
        await db.draft_invoices.put({
          ...this.frm.doc,
          offline_pos_name,
        });
        db.session_state.put({
          key: 'last_invoice',
          value: offline_pos_name,
        });
        this.make_new_invoice();
      }

      _local_draft_on_list() {
        showSavedInvoices({
          onSelect: (ofn) => this.cart.load_invoice_to_cart(ofn),
        });
      }

      async _local_draft_on_prev() {
        const last_invoice = await db.session_state.get('last_invoice');
        if (!last_invoice) {
          frappe.msgprint(__('No draft invoice found'));
          return;
        }

        this.cart.load_invoice_to_cart(last_invoice.value);
      }
    }
  );
}

export function local_draft_cart(POSCart) {
  return makeExtension(
    'local_draft_cart',
    class CartWithLocalDraft extends POSCart {
      async load_invoice_to_cart(offline_pos_name) {
        if (this.frm.doc.items.length > 0) {
          await new Promise((resolve, reject) => {
            frappe.confirm(
              'Your current cart contains some items. ' +
                'Do you really want to clear them and load the saved invoice?',
              resolve,
              reject
            );
          });
        }

        const invoice = await db.draft_invoices.get(offline_pos_name);
        frappe.model.add_to_locals(invoice);
        ['items', 'payments', 'taxes'].forEach((field) =>
          invoice[field].forEach(frappe.model.add_to_locals)
        );
        this.frm.refresh(invoice.name);

        this.customer_field.value = this.frm.doc.customer;
        this.customer_field.refresh();

        this.available_loyalty_points.value = this.frm.doc.loyalty_points;
        this.available_loyalty_points.refresh();

        this.$cart_items.empty();
        this.$cart_items.append(
          this.frm.doc.items.map(this.get_item_html.bind(this))
        );

        this.update_discount_fields();
        this.update_grand_total();
        this.update_taxes_and_totals();
        this.update_qty_total();
      }
    }
  );
}
