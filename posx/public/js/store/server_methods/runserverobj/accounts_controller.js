import * as R from 'ramda';

import db from '../../db';
import { get_item_details } from '../get_item_details/get_item_details';
import { apply_pricing_rule_for_free_items } from '../pricing_rule/utils';
import { get_serial_no } from '../utils';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/accounts_controller.py#L338
export async function set_taxes(_doc) {
  let doc = R.clone(_doc);
  if (!doc.taxes || doc.taxes.length === 0) {
    const tax_master_doctype = 'Sales Taxes and Charges Template';
    if (doc.company && !doc.taxes_and_charges) {
      doc.taxes_and_charges = await db
        .table(tax_master_doctype)
        .filter((x) => x.is_default && x.company === doc.company)
        .first()
        .then((x) => x && x.name);
    }
    const taxes = await get_taxes_and_charges(
      tax_master_doctype,
      doc.taxes_and_charges
    );
    doc.taxes = [
      ...doc.taxes,
      ...taxes.map(R.omit(['name'])).map(
        R.mergeLeft({
          parent: doc.name,
          parentfield: 'taxes',
          parenttype: doc.doctype,
        })
      ),
    ];
  }
  return doc;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/accounts_controller.py#L895
async function get_taxes_and_charges(master_doctype, master_name) {
  if (!master_name) {
    return;
  }
  return db
    .table(master_doctype.replace(' Template', ''))
    .where({ parent: master_name })
    .toArray();
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/accounts_controller.py#L213
export async function set_price_list_currency(_doc, _buying_or_selling) {
  let doc = R.clone(_doc);
  if (doc.selling_price_list) {
    doc.price_list_currency = await db
      .table('Price List')
      .get(doc.selling_price_list)
      .then((x) => x && x.currency);
    if (doc.price_list_currency === doc.company_currency) {
      doc.plc_conversion_rate = 1;
    } else {
      // get_exchange_rate not implemented
      doc.plc_conversion_rate = 1;
    }

    if (!doc.currency) {
      doc.currency = doc.price_list_currency;
      doc.conversion_rate = doc.plc_conversion_rate;
    } else if (doc.currency === doc.company_currency) {
      doc.conversion_rate = 1;
    } else {
      // get_exchange_rate not implemented
      doc.conversion_rate = 1;
    }
  }
  return doc;
}

const force_item_fields = [
  'item_group',
  'brand',
  'stock_uom',
  'is_fixed_asset',
  'item_tax_rate',
  'pricing_rules',
];

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/accounts_controller.py#L249
export async function set_missing_item_details(_doc, for_validate = false) {
  let doc = R.clone(_doc);
  if (doc.items && doc.items.length > 0) {
    const parent_dict = {
      ...R.pickBy((v) => ['String', 'Number'].includes(R.type(v)), doc),
      document_type: 'Sales Invoice Item',
    };

    let updated_items = [];

    for (let item of doc.items) {
      if (item.item_code) {
        let args = {
          ...R.clone(parent_dict),
          ...item,
          doctype: doc.doctype,
          name: doc.name,
          child_docname: item.name,
        };
        if (!args.transaction_date) {
          args.transaction_date = arg.posting_date;
        }
        if (doc.is_subcontracted) {
          args.is_subcontracted = doc.is_subcontracted;
        }
        const ret = await get_item_details(
          args,
          doc,
          true /* for_validate */,
          true /* overwrite_warehouse */
        );
        for (const fieldname in ret) {
          const value = ret[fieldname];
          if (value) {
            if (
              R.isNil(item[fieldname]) ||
              force_item_fields.includes(fieldname)
            ) {
              item[fieldname] = value;
            } else if (
              ['cost_center', 'conversion_factor'].includes(fieldname) &&
              !item[fieldname]
            ) {
              item[fieldname] = value;
            } else if (fieldname === 'serial_no') {
              const item_conversion_factor = item.conversion_factor || 1;
              const item_qty = Math.abs(item.qty) * item_conversion_factor;
              if (item_qty != get_serial_no(item.serial_no).length) {
                item[fieldname] = value;
              }
            }
          }
        }
        item.is_fixed_asset = ret.is_fixed_asset || 0;
        if (ret.pricing_rules) {
          [doc, item] = apply_pricing_rule_on_items(doc, item, ret);
        }

        updated_items = [...updated_items, item];
      }
    }

    // required because code runs async in the prev for-of loop
    for (const item of updated_items) {
      const idx = doc.items.findIndex((x) => x.name === item.name);
      if (idx > -1) {
        doc.items[idx] = item;
      } else {
        doc.items = [...doc.items, item];
      }
    }
  }
  return doc;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/accounts_controller.py#L308
function apply_pricing_rule_on_items(_doc, _item, pricing_rule_args) {
  let doc = R.clone(_doc);
  let item = R.clone(_item);
  if (!pricing_rule_args.validate_applied_rule) {
    if (pricing_rule_args.price_or_product_discount === 'Price') {
      item = {
        ...item,
        ...R.pick(
          ['pricing_rules', 'discount_percentage', 'discount_amount'],
          pricing_rule_args
        ),
      };
      if (pricing_rule_args.pricing_rule_for === 'Rate') {
        item.price_list_rate = pricing_rule_args.price_list_rate;
      }

      if (item.price_list_rate) {
        item.rate = item.discount_amount
          ? item.price_list_rate - item.discount_amount
          : (item.price_list_rate * (1 - item.discount_percentage)) / 100;
      }
    } else if (pricing_rule_args.free_item_data) {
      doc = apply_pricing_rule_for_free_items(
        doc,
        pricing_rule_args.free_item_data
      );
    }
  } else if (pricing_rule_args.validate_applied_rule) {
    // msgprint message to user not implemented
  }

  return [doc, item];
}
