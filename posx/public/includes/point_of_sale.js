frappe.pages['point-of-sale'].on_page_load = function (wrapper) {
  frappe.ui.make_app_page({
    parent: wrapper,
    title: __('Point of Sale'),
    single_column: true,
  });

  frappe.require(
    [
      'assets/js/point-of-sale.min.js',
      'assets/js/posx-pos.min.js',
      'assets/css/posx-pos.min.css',
    ],
    function () {
      posx.pos.override(erpnext.PointOfSale);
      wrapper.pos = new erpnext.PointOfSale.Controller(wrapper);
      window.cur_pos = wrapper.pos;
    }
  );
};
