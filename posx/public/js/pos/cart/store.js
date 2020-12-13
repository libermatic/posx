import * as R from 'ramda';

class Store {
  constructor() {
    this.doc = {};
    this.state = { selected: null };
  }
  init({ frm }) {
    this.frm = frm;
    this.doc = frm.doc;
  }

  setSelected(name) {
    this.state.selected = name;
  }

  updateCustomer({ customer, language }) {
    this.frm.set_value({ customer, language });
  }
  async updateItem(item) {
    const idx = this.doc.items.findIndex((x) => x.name === item.name);
    this.doc.items.splice(idx, 1, { ...item });
    if (item.free_item_data) {
      const free_item = this.doc.items.find(
        (x) => x.item_code === item.free_item_data.item_code && x.is_free_item
      );
      if (free_item) {
        const free_idx = this.doc.items.findIndex(
          (x) => x.name === free_item.name
        );
        this.doc.items.splice(free_idx, 1, { ...free_item });
      }
    }
  }
  async addItem({ item_code, batch_no, serial_no }) {
    const item = this.frm.add_child('items', {
      item_code,
      batch_no,
      serial_no,
    });

    await this.frm.script_manager.trigger('item_code', item.doctype, item.name);
    await this.frm.script_manager.trigger('qty', item.doctype, item.name);
    if (batch_no) {
      // required because batch_no is reset by qty trigger
      await frappe.model.set_value(item, { batch_no });
    }
    await this.updateItem(item);
    return item;
  }
  updateActualBatchQty(item, actual_batch_qty) {
    if (!item.has_batch_no) {
      return;
    }
    const existing = this.doc.items.find((x) => x.name === item.name);
    if (existing) {
      existing.actual_batch_qty = actual_batch_qty;
    }
  }
  async updateQty({ name, qty }) {
    frappe.dom.freeze();
    const item = this.doc.items.find((x) => x.name === name);
    if (!item) {
      return;
    }
    item.qty = qty;
    await this.frm.script_manager.trigger('qty', item.doctype, item.name);
    if (qty === 0) {
      await frappe.model.clear_doc(item.doctype, item.name);
    }
    frappe.dom.unfreeze();
  }
  async updateDiscount({ additional_discount_percentage, discount_amount }) {
    frappe.model.set_value(
      this.doc,
      R.pickBy((x) => !R.isNil(x), {
        additional_discount_percentage,
        discount_amount,
      })
    );
  }
}

const store = new Store();
