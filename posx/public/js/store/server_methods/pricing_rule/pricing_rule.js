import * as R from 'ramda';

import db from '../../db';
import { ValidationError } from '../../../utils/exceptions.js';
import {
  get_pricing_rules,
  get_applied_pricing_rules,
  get_pricing_rule_items,
  snakeCase,
} from './utils';
import logger from '../../../utils/logger';

export async function erpnext__accounts__doctype__pricing_rule__pricing_rule__apply_pricing_rule({
  args: _args,
  doc: _doc = null,
}) {
  const { items: item_list, ...args } = JSON.parse(_args);
  const doc = _doc ? JSON.parse(_doc) : null;

  let out = [];

  for (const item of item_list) {
    const { has_serial_no } = await db.table('Item').get(item.item_code);
    if (has_serial_no) {
      logger(
        'apply_pricing_rule: delegate queries containing serialized items to network'
      );
      return;
    }

    const _args = {
      ...args,
      ...item,
      transaction_type: args.transaction_type || 'selling',
    };
    const data = await get_pricing_rule_for_item(
      _args,
      args.price_list_rate,
      doc
    );

    // not implemented get_serial_no_for_item
    out = [...out, data];
  }

  return out;
}

export async function get_pricing_rule_for_item(
  _args,
  _price_list_rate = 0,
  doc,
  for_validate = false
) {
  if (_args.is_free_item) {
    return {};
  }

  let item_details = {
    ...R.pick(
      ['doctype', 'name', 'parent', 'parenttype', 'child_docname'],
      _args
    ),
    discount_percentage_on_rate: [],
    discount_amount_on_rate: [],
  };

  if (_args.ignore_pricing_rule || !_args.item_code) {
    // upstream: checks if doc exists in db
    // maybe the conditional below is not required because all docs will be client
    // docs anyways
    if (pricing_rules) {
      return remove_pricing_rule_for_item(
        _args.pricing_rules,
        item_details,
        _args.item_code
      );
    }
    return item_details;
  }

  const args = await update_args_for_pricing_rule(_args);

  const pricing_rules =
    for_validate && args.pricing_rules
      ? get_applied_pricing_rules(args.pricing_rules)
      : get_pricing_rules(args, doc);

  if (pricing_rules.length > 0) {
    let rules = [];
    for (const _pricing_rule of pricing_rules) {
      if (!_pricing_rule) {
        continue;
      }
      let pricing_rule =
        typeof _pricing_rule === 'string'
          ? await db.table('Pricing Rule').get(_pricing_rule)
          : pricing_rule;

      pricing_rule.apply_rule_on_other_items = get_pricing_rule_items(
        pricing_rule
      );
      if (pricing_rule.suggestion) {
        continue;
      }

      item_details = {
        ...item_details,
        validate_applied_rule: pricing_rule.validate_applied_rule || 0,
        price_or_product_discount: pricing_rule.price_or_product_discount,
      };

      rules = [...rules, get_pricing_rule_details(args, pricing_rule)];
      if (pricing_rule.mixed_conditions || pricing_rule.apply_rule_on_other) {
        item_details = {
          ...item_details,
          apply_rule_on_other_items: JSON.stringify(
            pricing_rule.apply_rule_on_other_items
          ),
          price_or_product_discount: pricing_rule.price_or_product_discount,
          apply_rule_on: pricing_rule.apply_rule_on_other
            ? snakeCase(pricing_rule.apply_rule_on_other)
            : snakeCase(pricing_rule.apply_on),
        };
      }

      if (pricing_rule.coupon_code_based === 1 && !args.coupon_code) {
        return item_details;
      }

      if (!pricing_rule.validate_applied_rule) {
        if (pricing_rule.price_or_product_discount === 'Price') {
          item_details = {
            ...item_details,
            ...apply_price_discount_rule(pricing_rule, item_details, args),
          };
        }
      } else {
        item_details = {
          ...item_details,
          ...get_product_discount_rule(pricing_rule, item_details, args, doc),
        };
      }
    }
    item_details = {
      ...item_details,
      has_pricing_rule: 1,
      pricing_rules: JSON.stringify(rules.map(R.prop('pricing_rule'))),
    };
    if (!doc) {
      return item_details;
    }
  } else if (args.pricing_rules) {
    const removed = await remove_pricing_rule_for_item(
      args.pricing_rules,
      item_details,
      args.item_code
    );
    item_details = { ...item_details, ...removed };
  }

  return item_details;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/pricing_rule.py#L371
async function remove_pricing_rule_for_item(
  pricing_rules,
  item_details,
  item_code = null
) {
  const result = { ...item_details };
  for (const name of get_applied_pricing_rules(pricing_rules)) {
    const pricing_rule = await db.table('Pricing Rule').get(name);
    if (!pricing_rule) {
      continue;
    }

    if (pricing_rule.price_or_product_discount === 'Price') {
      if (pricing_rule.rate_or_discount === 'Discount Percentage') {
        result.discount_percentage = 0.0;
        result.discount_amount = 0.0;
      } else if (pricing_rule.rate_or_discount === 'Discount Amount') {
        result.discount_amount = 0.0;
      }

      if (['Percentage', 'Amount'].includes(pricing_rule.margin_type)) {
        result.margin_rate_or_amount = 0.0;
        result.margin_type = null;
      }
    } else if (pricing_rule.free_item) {
      result.remove_free_item = pricing_rule.same_item
        ? item_code
        : pricing_rule.free_item;
    }

    if (pricing_rule.mixed_conditions || pricing_rule.apply_rule_on_other) {
      items = get_pricing_rule_items(pricing_rule);
      result.apply_on = snakeCase(
        pricing_rule.apply_rule_on_other
          ? pricing_rule.apply_rule_on_other
          : pricing_rule.apply_on
      );
      result.applied_on_items = JSON.stringify(items);
      result.price_or_product_discount = pricing_rule.price_or_product_discount;
    }

    result.pricing_rules = '';
    return result;
  }
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/pricing_rule.py#L293
async function update_args_for_pricing_rule(args) {
  let result = { ...args };
  if (!(args.item_group && args.brand)) {
    const { item_group, brand } =
      (await db.table('Item').get(args.item_code)) || {};
    result.item_group = item_group;
    result.brand = brand;
    if (!result.item_group) {
      throw new ValidationError(
        `Item Group not mentioned in item master for item ${args.item_code}`
      );
    }
  }

  // upstream asks args.transaction_type == "selling". but assuming all transactions are sale here
  // code for other transaction_type is omitted
  if (args.customer && !(args.customer_group && args.territory)) {
    const { customer_group, territory } =
      args.quotation_to && args.quotation_to !== 'Customer'
        ? {}
        : (await db.table('Customer').get(args.customer)) || {};
    result.customer_group = customer_group;
    result.territory = territory;
    result.supplier = null;
    result.supplier_group = null;
  }

  return result;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/pricing_rule.py#L320
function get_pricing_rule_details(args, pricing_rule) {
  return {
    pricing_rule: pricing_rule.name,
    rate_or_discount: pricing_rule.rate_or_discount,
    margin_type: pricing_rule.margin_type,
    item_code: args.item_code,
    child_docname: args.child_docname,
  };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/pricing_rule.py#L329
function apply_price_discount_rule(pricing_rule, item_details, args) {
  let result = { rate_or_discount: pricing_rule.rate_or_discount };
  if (
    (pricing_rule.margin_type === 'Amount' &&
      pricing_rule.currency === args.currency) ||
    pricing_rule.margin_type === 'Percentage'
  ) {
    result = {
      ...result,
      ...R.pick(['margin_type', 'margin_rate_or_amount'], pricing_rule),
    };
  } else {
    result = { ...result, margin_type: null, margin_rate_or_amount: 0 };
  }

  if (pricing_rule.rate_or_discount === 'Rate') {
    const pricing_rule_rate =
      pricing_rule.currency === args.currency ? pricing_rule.rate : 0;
    result = {
      ...result,
      price_list_rate: pricing_rule_rate * (args.conversion_factor || 1),
      discount_percentage: 0,
    };
  }

  for (const apply_on of ['Discount Amount', 'Discount Percentage']) {
    if (pricing_rule.rate_or_discount !== apply_on) {
      continue;
    }

    const field = snakeCase(apply_on);
    if (pricing_rule.apply_discount_on_rate) {
      const discount_field = `${field}_on_rate`;
      result = {
        ...result,
        [discount_field]: [
          ...(result[discount_field] || item_details[discount_field]),
          pricing_rule[field] || 0,
        ],
      };
    } else {
      if (!result.hasOwnProperty(field)) {
        result = { ...result, [field]: item_details[field] || 0 };
      }
      result = {
        ...result,
        [field]:
          result[field] +
          (pricing_rule ? pricing_rule[field] || 0 : args[field] || 0),
      };
    }
  }

  return result;
}
