frappe.pages['point-of-sale'].on_page_load = function (wrapper) {
  frappe.ui.make_app_page({
    parent: wrapper,
    title: __('Point of Sale'),
    single_column: true,
  });

  frappe.require(
    ['point-of-sale.bundle.js', 'posx-pos.bundle.js', 'posx-pos.bundle.css'],
    async function () {
      posx.pos.override(erpnext.PointOfSale);
      await siteOverride();
      wrapper.pos = new erpnext.PointOfSale.Controller(wrapper);
      window.cur_pos = wrapper.pos;
    }
  );
};

async function siteOverride() {
  const { message: asset_names } = await frappe.call({
    method: 'posx.api.pos.list_asset_names',
  });
  if (asset_names.length === 0) {
    return;
  }

  const sources = asset_names.filter((x) => !frappe.assets.exists(x));
  if (sources.length > 0) {
    const { message: pos_assets } = await frappe.call({
      method: 'posx.api.pos.list_assets',
      args: { sources },
    });
    pos_assets.forEach((x) => frappe.assets.add(x.name, x.code));
  }

  frappe.assets.eval_assets(asset_names);
}
