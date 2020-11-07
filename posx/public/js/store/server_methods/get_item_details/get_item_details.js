import * as R from 'ramda';

import db from '../../db';
import {
  UnsupportedFeatureError,
  ValidationError,
} from '../../../utils/exceptions.js';
import logger from '../../../utils/logger';
import {
  get_item_defaults,
  get_item_group_defaults,
  get_brand_defaults,
  get_conversion_factor,
} from '../utils';
import { get_pricing_rule_for_item } from '../pricing_rule/pricing_rule';
import { get_batch_no } from '../batch/batch';
import get_price_list_rate, {
  get_price_list_currency_and_exchange_rate,
} from './get_price_list_rate';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L26
export async function get_item_details(
  _args,
  _doc = null,
  for_validate = false,
  overwrite_warehouse = true
) {
  let args = await process_args(_args);
  const item = await db.table('Item').get(args.item_code);
  validate_item_details(args, item);

  let out = await get_basic_details(args, item, overwrite_warehouse);

  const doc = typeof _doc === 'string' ? JSON.parse(_doc) : _doc;
  if (doc) {
    args = { ...args, ...R.pick(['posting_date', 'transaction_date'], doc) };
  }

  out.item_tax_template = await get_item_tax_template(args, item, out);
  out.item_tax_rate = await get_item_tax_map(
    args.company,
    out.item_tax_template || args.item_tax_template,
    true
  );
  out = await get_party_item_code(args, item, out);
  out = await set_valuation_rate(out, args);
  out = await update_party_blanket_order(args, out);
  out = await get_price_list_rate(args, item, out);
  if (args.customer && args.is_pos) {
    const data = await get_pos_profile_item_details(args.company, args);
    out = { ...out, ...data };
  }
  if (out.warehouse) {
    const data = await get_bin_details(args.item_code, out.warehouse);
    out = { ...out, ...data };
  }

  Object.keys(out).forEach((key) => {
    if (R.isNil(args[key])) {
      args[key] = out[key];
    }
  });

  const pricing_rule_details = await get_pricing_rule_for_item(
    args,
    out.price_list_rate,
    doc,
    for_validate
  );
  out = { ...out, ...pricing_rule_details };
  out = await update_stock(args, out);
  out = get_gross_profit(out);

  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L904
export async function apply_price_list(_args, as_doc = false) {
  let args = await process_args(_args);
  const parent = await get_price_list_currency_and_exchange_rate(args);
  let children = [];

  if (args.hasOwnProperty('items')) {
    const item_list = args.items;
    args = { ...args, parent };

    for (const item of item_list) {
      const args_copy = { ...R.clone(args), ...item };
      const item_details = await apply_price_list_on_item(args_copy);
      children = [...children, item_details];
    }
  }

  if (as_doc) {
    args = {
      ...args,
      ...R.pick(['price_list_currency', 'comversion_rate'], parent),
    };
    if (args.items) {
      for (let i = 0; i < args.items.length; i++) {
        for (const fieldname of Object.keys(children[i])) {
          if (
            !['name', 'doctype'].includes(fieldname) &&
            args.items[i].hasOwnProperty(fieldname)
          ) {
            args.items[i][fieldname] = children[i][fieldname];
          }
        }
      }
    }
    return args;
  } else {
    return { parent, children };
  }
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L148
async function process_args(_args) {
  const args = typeof _args === 'string' ? JSON.parse(_args) : _args;
  let result = { ...args };
  if (!args.price_list) {
    result.price_list = args.selling_price_list;
  }
  if (args.barcode) {
    result.item_code = await get_item_code({ barcode: args.barcode });
  } else if (!args.item_code && args.serial_no) {
    result.item_code = await get_item_code({ serial_no: args.serial_no });
  }

  result.transaction_type = args.transaction_type || 'selling';
  return { ...args, ...result };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L167
async function get_item_code({ barcode, serial_no }) {
  if (barcode) {
    const doc = await db
      .table('Item Barcode')
      .where('barcode')
      .equals(barcode)
      .first();
    if (doc) {
      return doc.parent;
    }
  }
  throw new UnsupportedFeatureError(
    'get_item_code: Serialized items not supported on client'
  );
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L961
async function apply_price_list_on_item(args) {
  const item_doc = await db.table('Item').get(args.item_code);
  const item_details = await get_price_list_rate(args, item_doc, {});
  const pricing_rule_details = await get_pricing_rule_for_item(
    args,
    item_details.price_list_rate
  );
  return { ...item_details, ...pricing_rule_details };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L180
function validate_item_details(args, item) {
  if (!args.company) {
    throw new ValidationError('Please specify Company');
  }

  // validate_end_of_life not implemented

  if (args.transaction_type === 'selling' && item.has_variants) {
    throw new ValidationError(
      `Item ${item.name} is a template, please select one of its variants`
    );
  }
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L195
async function get_basic_details(_args, _item, overwrite_warehouse = true) {
  const item = _item || (await db.table('Item').get(args.item_code));
  let args = R.clone(_args);

  // update_template_tables not implemented

  const defaults = await getDefaults(item.name, args.company);
  const warehouse = await get_item_warehouse(
    item,
    args,
    overwrite_warehouse,
    defaults
  );

  let expense_account = null;
  if (!args.uom) {
    args.uom = item.sales_uom || item.stock_uom;
  }

  let out = {
    item_code: item.name,
    item_name: item.item_name,
    description: item.description,
    image: item.image,
    warehouse: warehouse,
    income_account: get_default_income_account(
      args,
      defaults.item_defaults,
      defaults.item_group_defaults,
      defaults.brand_defaults
    ),
    expense_account:
      expense_account ||
      get_default_expense_account(
        args,
        defaults.item_defaults,
        defaults.item_group_defaults,
        defaults.brand_defaults
      ),
    cost_center: get_default_cost_center(
      args,
      defaults.item_defaults,
      defaults.item_group_defaults,
      defaults.brand_defaults
    ),
    has_serial_no: item.has_serial_no,
    has_batch_no: item.has_batch_no,
    batch_no: args.batch_no,
    uom: args.uom,
    min_order_qty: '',
    qty: args.qty || 1.0,
    stock_qty: args.qty || 1.0,
    price_list_rate: 0.0,
    base_price_list_rate: 0.0,
    rate: 0.0,
    base_rate: 0.0,
    amount: 0.0,
    base_amount: 0.0,
    net_rate: 0.0,
    net_amount: 0.0,
    discount_percentage: 0.0,
    supplier: get_default_supplier(
      args,
      defaults.item_defaults,
      defaults.item_group_defaults,
      defaults.brand_defaults
    ),
    update_stock: args.update_stock,
    delivered_by_supplier: item.delivered_by_supplier,
    is_fixed_asset: item.is_fixed_asset,
    weight_per_unit: item.weight_per_unit,
    weight_uom: item.weight_uom,
    last_purchase_rate: 0,
    transaction_date: args.transaction_date,
  };

  if (item.enable_deferred_revenue || item.enable_deferred_expense) {
    out = { ...out, ...(await calculate_service_end_date(args, item)) };
  }
  if (item.stock_uom === args.uom) {
    out.conversion_factor = 1;
  } else {
    out.conversion_factor =
      args.conversion_factor ||
      (await get_conversion_factor(item.name, args.uom)).conversion_factor;
  }

  args.conversion_factor = out.conversion_factor;
  out.stock_qty = out.qty * out.conversion_factor;

  const _company = await db.table('Company').get(args.company);
  for (const d of [
    ['Account', 'income_account', 'default_income_account'],
    ['Account', 'expense_account', 'default_expense_account'],
    ['Cost Center', 'cost_center', 'cost_center'],
    ['Warehouse', 'warehouse', ''],
  ]) {
    if (!out[d[1]]) {
      out[d[1]] = d[2] ? _company[d[2]] : null;
    }
  }

  out = {
    ...out,
    ...R.pick(
      ['item_name', 'item_group', 'barcodes', 'brand', 'stock_uom'],
      item
    ),
  };

  if (args.manufacturer) {
    throw new UnsupportedFeatureError(
      'get_basic_details: Manufacturer not supported'
    );
  } else {
    out = {
      ...out,
      manufacturer: item.default_item_manufacturer,
      manufacturer_part_no: item.default_manufacturer_part_no,
    };
  }

  out = update_barcode_value(out);

  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L359
async function get_item_warehouse(
  item,
  args,
  overwrite_warehouse,
  _defaults = {}
) {
  const defaults = _defaults || (await getDefaults(item.name, args.company));
  let warehouse;
  if (overwrite_warehouse || !args.warehouse) {
    warehouse =
      args.set_warehouse ||
      defaults.item_defaults.default_warehouse ||
      defaults.item_group_defaults.default_warehouse ||
      defaults.brand_defaults.default_warehouse ||
      args.warehouse;

    // setting from frappe.defaults not implemented
  } else {
    warehouse = args.warehouse;
  }

  if (!warehouse) {
    const { default_warehouse } =
      (await db.settings.get('Stock Settings')) || {};
    const exists = await db
      .table('Warehouse')
      .where({ name: default_warehouse })
      .and((x) => x.company === args.company)
      .first();
    if (exists) {
      return default_warehouse;
    }
  }
  return warehouse;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L510
const get_default_income_account = getDefaultProp('income_account');

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L516
const get_default_expense_account = getDefaultProp('expense_account');

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L530
// not validated against company. not handled Project
const get_default_cost_center = getDefaultProp('cost_center');

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L549
const get_default_supplier = getDefaultProp('default_supplier');

async function getDefaults(item_code, company) {
  const [
    item_defaults,
    item_group_defaults,
    brand_defaults,
  ] = await Promise.all([
    get_item_defaults(item_code, company),
    get_item_group_defaults(item_code, company),
    get_brand_defaults(item_code, company),
  ]);
  return { item_defaults, item_group_defaults, brand_defaults };
}

function getDefaultProp(field) {
  return function (args, item, item_group, brand) {
    return item[field] || item_group[field] || brand[field] || args[field];
  };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L484
async function calculate_service_end_date(args, item = null) {
  throw new UnsupportedFeatureError(
    'Deferred Revenue / Expense not supported by client'
  );
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L395
async function update_barcode_value(out) {
  const { barcode } =
    db.table('Item Barcode').where({ parent: out.item_code }).first() || {};
  return { ...out, barcode };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L419
async function get_item_tax_template(args, item, out) {
  let item_tax_template =
    args.item_tax_template || _get_item_tax_template(args, item.taxes, out);

  let item_group = item.item_group;
  if (!item_tax_template) {
    while (item_group && !item_tax_template) {
      const item_group_doc = await db.table('Item Group').get(item_group);
      item_tax_template = _get_item_tax_template(
        args,
        item_group_doc.taxes,
        out
      );
      item_group = item_group_doc.parent_item_group;
    }
  }

  return item_tax_template;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L438
function _get_item_tax_template(
  args,
  taxes = [],
  _out = {},
  for_validate = false
) {
  let taxes_with_validity = [];
  let taxes_with_no_validity = [];

  for (const tax of taxes) {
    const validation_date =
      args.transaction_date || args.bill_date || args.posting_date;
    if (new Date(tax.valid_from) <= new Date(validation_date)) {
      taxes_with_validity = [...taxes_with_validity, tax];
    } else {
      taxes_with_no_validity = [...taxes_with_no_validity, tax];
    }
  }

  const sortByValidFrom = R.compose(R.reverse, R.sortBy(R.prop('valid_from')));
  const _taxes =
    taxes_with_validity.length > 0
      ? sortByValidFrom(taxes_with_validity)
      : taxes_with_no_validity;

  if (for_validate) {
    return _taxes
      .filter((x) => x.tax_category === args.tax_category)
      .map(R.prop('item_tax_template'));
  }

  if (taxes_with_validity.length === 0 && taxes_with_no_validity.length === 0) {
    return null;
  }

  for (const tax of _taxes) {
    if (tax.tax_category === args.tax_category) {
      return tax.item_tax_template;
    }
  }

  return null;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L473
async function get_item_tax_map(company, item_tax_template, as_json = true) {
  let item_tax_map = {};
  if (item_tax_template) {
    const taxes = await db
      .table('Item Tax Template Detail')
      .where({ parent: item_tax_template })
      .toArray();
    for (const d of taxes) {
      const account = await db
        .table('Account')
        .where({ name: d.tax_type })
        .first();
      if (account && account.company === company) {
        item_tax_map[d.tax_type] = d.tax_rate;
      }
    }
  }
  return as_json ? JSON.stringify(item_tax_map) : item_tax_map;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L739
async function get_party_item_code(args, item_doc, out) {
  // not implemented
  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L1066
async function update_party_blanket_order(args, out) {
  // not implemented
  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L130
async function set_valuation_rate(out, args) {
  const bundle = await db.table('Product Bundle').get(args.item_code);
  if (bundle) {
    let valuation_rate = 0;
    const bundled_items = await db
      .table('Product Bundle Item')
      .where({ parent: bundle.name })
      .toArray();
    for (const bundle_item of bundled_items) {
      const { valuation_rate: _value = 0 } = await get_valuation_rate(
        bundle_item.item_code,
        args.company,
        out.warehouse
      );
      valuation_rate += _value * bundle_item.qty;
    }
    return { ...out, valuation_rate };
  } else {
    const { valuation_rate } = await get_valuation_rate(
      args.item_code,
      args.company,
      out.warehouse
    );
    return { ...out, valuation_rate };
  }
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L1006
async function get_valuation_rate(item_code, company, warehouse = null) {
  const {
    item_defaults: item,
    item_group_defaults: item_group,
    brand_defaults: brand,
  } = await getDefaults(item_code, company);

  if (item.is_stock_item) {
    const { valuation_rate = 0 } =
      (await db.item_stock.where({
        item_code,
        warehouse:
          warehouse ||
          item.default_warehouse ||
          item_group.default_warehouse ||
          brand.default_warehouse,
      })) || {};
    return { valuation_rate };
  } else {
    // not stock item not handled
  }
  return { valuation_rate: 0.0 };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L760
async function get_pos_profile_item_details(
  company,
  args,
  _pos_profile = null,
  update_data = false
) {
  let res = {};
  const pos_profile =
    _pos_profile || (await get_pos_profile(company, args.pos_profile));
  if (pos_profile) {
    for (const fieldname of [
      'income_account',
      'cost_center',
      'warehouse',
      'expense_account',
    ]) {
      if ((!args[fieldname] || update_data) && pos_profile[fieldname]) {
        res[fieldname] = pos_profile[fieldname];
      }
    }

    if (res.warehouse) {
      const { actual_qty } = await get_bin_details(
        args.item_code,
        res.warehouse
      );
      res.actual_qty = actual_qty;
    }
  }

  return res;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L778
async function get_pos_profile(company, pos_profile = null, _user = null) {
  if (pos_profile) {
    return db.table('POS Profile').get(pos_profile);
  }

  const user = _user || ((await db.session_state.get('user')) || {}).value;
  const allowed = await db
    .table('POS Profile User')
    .where({ user })
    .and((x) => x.default)
    .toArray(R.map(R.prop('parent')));
  if (allowed.length > 0) {
    const _profile = await db
      .table('POS Profile')
      .where('name')
      .anyOf(allowed)
      .and((x) => x.company === company && !x.disabled)
      .first();
    if (_profile) {
      return _profile;
    }
  }

  return db
    .table('POS Profile')
    .filter((x) => x.company === company && !x.disabled)
    .first();
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L861
async function get_bin_details(item_code, warehouse) {
  return db.item_stock
    .where({ item_code, warehouse })
    .first()
    .then(({ qty } = { qty: 0 }) => ({
      projected_qty: qty,
      actual_qty: qty,
      reserved_qty: qty,
    }));
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L109
async function update_stock(args, _out) {
  let out = R.clone(_out);
  if (
    ['Sales Invoice', 'Delivery Note'].includes(args.doctype) &&
    args.update_stock &&
    out.warehouse &&
    out.stock_qty > 0
  ) {
    if (out.has_batch_no && !args.batch_no) {
      out.batch_no = await get_batch_no(out.item_code, out.warehouse, out.qty);
      const actual_batch_qty = await get_batch_qty(
        out.batch_no,
        out.warehouse,
        out.item_code
      );
      if (actual_batch_qty) {
        out = { ...out, ...actual_batch_qty };
      }
    }

    // serialize items not implemented
  }

  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L1028
function get_gross_profit(out) {
  if (out.valuation_rate) {
    return {
      ...out,
      gross_profit: (out.base_rate - out.valuation_rate) * out.stock_qty,
    };
  }
  return out;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L898
async function get_batch_qty(batch_no, warehouse, item_code) {
  if (batch_no) {
    const { qty: actual_batch_qty = 0 } =
      (await db.batch_stock.where({ batch_no, warehouse }).first()) || {};
    return { actual_batch_qty };
  }
}
