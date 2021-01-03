import Vue from 'vue/dist/vue.js';

import store from './store';
import db from '../../store/db';
import Cart from './Cart.vue';
import makeExtension from '../../utils/make-extension';

export default class POSCart {
  constructor({ frm, wrapper, events }) {
    this.frm = frm;
    this.wrapper = wrapper;
    this.events = events;
    store.init({ frm });
    frm.doc = store.doc;
    this.make();
  }
  make() {
    this.vm = new Vue({
      el: $('<div />').appendTo(this.wrapper)[0],
      render: (h) =>
        h(Cart, {
          props: Object.keys(this.events).reduce(
            (a, x) => ({ ...a, [x]: this.events[x] }),
            {}
          ),
        }),
    });
  }
  unselect_all() {}
  exists(item_code, batch_no) {
    return !!this.frm.doc.items.find(
      (x) => x.item_code === item_code && x.batch_no === batch_no
    );
  }
  update_taxes_and_totals() {}
  update_grand_total() {}
  update_qty_total() {}
  scroll_to_item(item_code) {}
  add_item(item) {}
  reset() {}

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
    Object.keys(invoice).forEach((field) => {
      store.doc[field] = invoice[field];
    });
  }
}

export function updated_cart(Pos) {
  return makeExtension(
    'updated_cart',
    class PosWithUpdatedCart extends Pos {
      make_cart() {
        if (!this.frm.config.px_use_cart_ext) {
          return super.make_cart();
        }
        this.wrapper.find('.pos').css('min-height', 'calc(100vh - 111px)');
        this.cart = new POSCart({
          frm: this.frm,
          wrapper: this.wrapper.find('.cart-container'),
          events: {
            onPay: () => {
              if (!this.payment) {
                this.make_payment_modal();
              } else {
                this.frm.doc.payments.map((p) => {
                  this.payment.dialog.set_value(p.mode_of_payment, p.amount);
                });
                this.payment.set_title();
              }
              this.payment.open_modal();
            },
            toggleItems: this._toggleItemsArea.bind(this),
            localDraftProps: {
              onSave: this._local_draft_on_save.bind(this),
              onList: this._local_draft_on_list.bind(this),
              onPrev: this._local_draft_on_prev.bind(this),
            },
            editableDescriptionProps: {
              onDescriptionEdit: this.edit_description.bind(this),
            },
          },
        });
      }

      /**
       *
       * @param {string} item_code
       * @param {string} field _qty_ | _serial_no_ | _batch_no_. Possible but unused values - _discount_percentage_, _rate_
       * @param {string | number} value
       * @param {string} _batch_no unused
       */
      async update_item_in_cart(
        item_code,
        field = 'qty',
        value = 1,
        _batch_no
      ) {
        if (!this.frm.config.px_use_cart_ext) {
          return super.update_item_in_cart(item_code, field, value, _batch_no);
        }
        try {
          frappe.dom.freeze();

          const existing = this.frm.doc.items.find(
            (x) => x.item_code === item_code
          );
          if (existing) {
            const qty = existing.qty + 1;
            if (
              (existing.has_batch_no && qty <= existing.actual_batch_qty) ||
              qty <= existing.actual_qty
            ) {
              frappe.model.set_value(existing, { qty });
            } else {
              store.setSelected(existing.name);
              this._toggleItemsArea(false);
            }
          } else {
            const item = await store.addItem(
              Object.assign(
                { item_code },
                ['batch_no', 'serial_no'].includes(field) && { [field]: value }
              )
            );
            if (item.has_batch_no && !item.batch_no) {
              store.setSelected(item.name);
              this._toggleItemsArea(false);
            }
            await store.updateItem(item);
          }
        } finally {
          frappe.dom.unfreeze();
        }
      }
      _toggleItemsArea(state) {
        this.wrapper.find('.item-container').toggle(state);
      }
      select_batch_and_serial_no(row) {
        if (!this.frm.config.px_use_cart_ext) {
          return super.select_batch_and_serial_no(row);
        }
      }

      handle_selection(direction) {
        if (!this.frm.config.px_use_cart_ext) {
          return super.handle_selection(direction);
        }
      }
      handle_qty_change(direction) {
        if (!this.frm.config.px_use_cart_ext) {
          return super.handle_qty_change(direction);
        }
      }
      handle_qty_focus() {
        if (!this.frm.config.px_use_cart_ext) {
          return super.handle_qty_focus();
        }
      }
      handle_delete() {
        if (!this.frm.config.px_use_cart_ext) {
          return super.handle_delete();
        }
      }
      handle_pay() {
        if (!this.frm.config.px_use_cart_ext) {
          return super.handle_pay();
        }
      }
    }
  );
}
