const SalesInvoiceController = erpnext.accounts.SalesInvoiceController.extend({
  _get_item_list: function (item) {
    const item_list = this._super(item);
    if (!this.frm.doc.is_return) {
      return item_list;
    }
    if (item) {
      return item_list.map((x) =>
        x.child_docname === item.name ? { ...x, batch_no: item.batch_no } : x
      );
    }

    return item_list.map((x) => ({
      ...x,
      batch_no: (
        this.frm.doc.items.find((row) => row.name === x.child_docname) || {}
      ).batch_no,
    }));
  },
});

$.extend(cur_frm.cscript, new SalesInvoiceController({ frm: cur_frm }));
