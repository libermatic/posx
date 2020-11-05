import * as R from 'ramda';

import logger from '../../../utils/logger';
import db from '../../db';
import { get_conversion_factor } from '../get_item_details';
import { ValidationError } from '../../../utils/exceptions.js';
import {
  get_pricing_rules,
  get_applied_pricing_rules,
  get_pricing_rule_items,
  snakeCase,
} from './utils';

export async function erpnext__accounts__doctype__pricing_rule__pricing_rule__apply_pricing_rule({
  args: _args,
  doc: _doc = null,
}) {
  const { items, ...args } = JSON.parse(_args);
  const doc = _doc ? JSON.parse(_doc) : null;
  const x = await Promise.all(
    items.map((x) => get_pricing_rule_for_item({ ...args, ...x }, doc))
  );
  const ex = {
    transaction_type: 'selling',
  };
  logger('apply_pricing_rule', { bgcolor: 'darkgrey', args: { args, doc } });
  console.log(x);
}

async function get_pricing_rule_for_item(args, doc, for_validate = false) {
  if (is_free_item) {
    return {};
  }

  const initial = {
    ...R.pick(
      ['doctype', 'name', 'parent', 'parenttype', 'child_docname'],
      args
    ),
    discount_percentage_on_rate: [],
    discount_amount_on_rate: [],
  };

  if (args.ignore_pricing_rule || !args.item_code) {
    // upstream: checks if doc exists in db
    // maybe the conditional below is not required because all docs will be client
    // docs anyways
    const { pricing_rules, item_code } = args;
    if (pricing_rules) {
      return remove_pricing_rule_for_item(pricing_rules, initial, item_code);
    }
    return initial;
  }

  async function getValue(doctype, name, field) {
    if (others[field]) {
      return others[field];
    }
    return db.table(doctype).get(name).then(R.prop(field));
  }

  const [item_group, brand, customer_group, territory] = await Promise.all([
    ...['item_group', 'brand'].map((field) =>
      getValue('Item', item_code, field)
    ),
    ...['customer_group', 'territory'].map((field) =>
      getValue('Customer', customer, field)
    ),
  ]);

  const _pricing_rules = await (for_validate && pricing_rules
    ? get_applied_pricing_rules({ pricing_rules: pricing_rules })
    : get_pricing_rules(
        {
          item_code,
          item_group,
          brand,
          price_list,
          warehouse,
          company,
          customer,
          customer_group,
          territory,
          campaign,
          sales_partner,
          transaction_date,
        },
        doc
      ));

  async function get_mixed_or_other(pr) {
    if (pr.mixed_conditions || pr.apply_rule_on_other) {
      const apply_rule_on_other_items = await get_pricing_rule_items(pr).then(
        JSON.stringify
      );
      const apply_rule_on = pr.apply_rule_on_other
        ? snakeCase(pr.apply_rule_on_other)
        : snakeCase(pr.apply_on);
      return {
        apply_rule_on_other_items,
        price_or_product_discount: pr.price_or_product_discount,
        apply_rule_on,
      };
    }
    return {};
  }

  const filtered_prs = _pricing_rules.filter((x) => !!x && !x.suggestion);
  if (filtered_prs.length === 0 && pricing_rules) {
    console.log('>> ', filtered_prs, pricing_rules);

    return remove_pricing_rule_for_item(pricing_rules, initial, item_code);
  }

  const coupon_code_pr = filtered_prs.find(
    (x) => x.coupon_code_based === 1 && !coupon_code
  );
  if (coupon_code_pr) {
    const {
      validate_applied_rule = 0,
      price_or_product_discount,
    } = coupon_code_pr;
    const mixed_or_other = await get_mixed_or_other(pr);
    return {
      ...initial,
      ...mixed_or_other,
      validate_applied_rule,
      price_or_product_discount,
    };
  }

  const discount_prs = filtered_prs
    .filter((x) => !x.validate_applied_rule)
    .map((pr) => {
      if (pr.price_or_product_discount === 'Price') {
        return apply_price_discount_rule(pr, { currency, conversion_factor });
      }
      return get_product_discount_rule(pr);
    });
  const filter_discount_fields = (field, prs) =>
    prs.map((x) => x[field]).filter((x) => !!x);
  const get_free_fields = (prs) =>
    R.tail(prs.filter((x) => !!x.free_item_data)) || {};

  function get_other_props(prs) {
    if (prs.length > 0) {
      return {
        has_pricing_rule: 1,
        pricing_rules: prs.map((x) => x.name).join(','),
      };
    }
  }

  return {
    ...initial,
    discount_amount_on_rate: filter_discount_fields(
      'discount_amount_on_rate',
      discount_prs
    ),
    discount_percentage_on_rate: filter_discount_fields(
      'discount_percentage_on_rate',
      discount_prs
    ),
    ...get_free_fields(discount_prs),
    ...get_other_props(discount_prs),
  };
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

function apply_price_discount_rule(pr, { currency, conversion_factor = 1 }) {
  function getMarginProps() {
    const { margin_type, margin_rate_or_amount } = pr;
    return (margin_type === 'Amount' && pr.currency === currency) ||
      margin_type === 'Percentage'
      ? { margin_type, margin_rate_or_amount }
      : { margin_type: null, margin_rate_or_amount: 0 };
  }
  function getRateOrDiscountProps() {
    if (pr.rate_or_discount === 'Rate') {
      const rate = pr.currency === currency ? pr.rate : 0;
      return {
        price_list_rate: rate * conversion_factor,
        discount_percentage: 0,
      };
    }
    const field = snakeCase(pr.rate_or_discount);
    if (pr.apply_discount_on_rate) {
      return { [`${field}_on_rate`]: pr[field] || 0 };
    }
    return { [field]: pr[field] || 0 };
  }

  return {
    pricing_rule_for: pr.rate_or_discount,
    ...getMarginProps(),
    ...getRateOrDiscountProps(),
  };
}

async function get_product_discount_rule(
  pr,
  initial,
  { item_code, company },
  doc
) {
  const free_item = pr.same_item
    ? initial.item_code || item_code
    : pr.free_item;

  if (!free_item) {
    throw new ValidationError(
      `Free item not set in the pricing rule ${pr.name}`
    );
  }

  const {
    item_name,
    description,
    stock_uom,
    item_group,
    brand,
  } = await db.table('Item').get(free_item);
  const uom = pr.free_item_uom || stock_uom;
  const { conversion_factor = 1 } = await get_conversion_factor({
    item_code: free_item,
    uom,
  });

  async function getDefaultIncomeAccount() {
    const _company = company || doc.company;
    const getDefault = (doctype, name) =>
      db
        .get('Item Default')
        .where('parent')
        .equals(name)
        .and((x) => x.parenttype === doctype && x.company === company)
        .first()
        .then((x) => x.income_account);
    const income_account =
      (await getDefault('Item', free_item)) ||
      (await getDefault('Item Group', item_group)) ||
      (await getDefault('Brand', brand));

    return income_account;
  }

  const income_account = await getDefaultIncomeAccount();
  return {
    free_item_data: {
      item_code: free_item,
      qty: pr.free_qty || 1,
      rate: pr.free_item_rate || 0,
      price_list_rate: pr.free_item_rate || 0,
      is_free_item: 1,
      item_name,
      description,
      stock_uom,
      uom,
      conversion_factor,
      income_account,
    },
  };
}

async function getAncestors(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft <= lft && x.rgt >= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}

async function getParents(doctype, value) {
  function query(allowed) {
    const apply_on = snakeCase(doctype);
    const get_parents = R.compose(
      (x) => Array.from(new Set(x)),
      R.map(R.prop(apply_on))
    );
    return db
      .table(`Pricing Rule ${doctype}`)
      .where(apply_on)
      .anyOf(allowed)
      .toArray()
      .then(get_parents);
  }

  if (doctype === 'Item') {
    const allowed = await db
      .table('Item')
      .get(value)
      .then((x) => (x && x.variant_of ? [value, x.variant_of] : [value]));
    return query(allowed);
  }
  if (doctype === 'Item Group') {
    const allowed = await getAncestors('Item Group', value);
    return query(allowed);
  }
  if (doctype === 'Brand') {
    const allowed = [value];
    return query(allowed);
  }
  return [];
}
