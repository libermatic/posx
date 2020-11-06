import * as R from 'ramda';

import db from '../../db';
import { get_conversion_factor } from '../utils';
import {
  UnsupportedFeatureError,
  MultiplePricingRuleConflict,
  ValidationError,
} from '../../../utils/exceptions.js';

export function snakeCase(text) {
  return text.toLowerCase().replace(' ', '_');
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L33
export async function get_pricing_rules(args, doc = null) {
  const pricing_rules = await getRules(args);
  if (pricing_rules.length === 0) {
    return [];
  }

  let rules = [];
  if (apply_multiple_pricing_rules(pricing_rules)) {
    for (const pricing_rule of pricing_rules) {
      const filtered = filter_pricing_rules(args, pricing_rule, doc);
      if (filtered) {
        rules = [...rules, filtered];
      }
    }
  } else {
    const filtered = filter_pricing_rules(args, pricing_rules, doc);
    if (filtered) {
      rules = [...rules, filtered];
    }
  }

  return rules;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L480
export async function get_applied_pricing_rules({ pricing_rules }) {
  if (!pricing_rules) {
    return [];
  }
  if (pricing_rules.startsWith('[')) {
    return JSON.parse(pricing_rules);
  }
  return pricing_rules.split(',');
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L536
export async function get_pricing_rule_items(pr_doc) {
  let apply_on_data = [];
  const apply_on = snakeCase(pr_doc.apply_on);

  const children = await db
    .table(`Pricing Rule ${pr_doc.apply_on}`)
    .where('parent')
    .equals(pr_doc.name)
    .toArray();

  for (const row of children) {
    if (apply_on === 'item_group') {
      const descendents = await getDescendents('Item Group', row[apply_on]);
      apply_on_data = [...apply_on_data, ...descendents];
    } else {
      apply_on_data = [...apply_on_data, row[apply_on]];
    }
  }

  if (pr_doc.apply_rule_on_other) {
    const other_apply_on = snakeCase(pr_doc.apply_rule_on_other);
    apply_on_data = [...apply_on_data, pr_doc[`other_${other_apply_on}`]];
  }

  return Array.from(new Set(apply_on_data));
}

async function getAncestors(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft <= lft && x.rgt >= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}

async function getDescendents(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft >= lft && x.rgt <= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}

async function getRules(args) {
  const [customer_groups, territories, warehouses] = await Promise.all([
    args.customer_group
      ? getAncestors('Customer Group', args.customer_group)
      : [],
    args.territory ? getAncestors('Territory', args.territory) : [],
    args.warehouse ? getAncestors('Warehouse', args.warehouse) : [],
  ]);
  const other_trees = { customer_groups, territories, warehouses };

  async function getAllowable(doctype, value) {
    const apply_on = snakeCase(doctype);

    const other = await db
      .table('Pricing Rule')
      .where('apply_rule_on_other')
      .notEqual('')
      .and((x) => x[`other_${apply_on}`] === value)
      .toArray(R.map(R.prop('name')));

    const get_parents = R.compose(
      (x) => Array.from(new Set([...x, ...other])),
      R.map(R.prop('parent'))
    );

    const query = async (allowed) => {
      return db
        .table(`Pricing Rule ${doctype}`)
        .where(apply_on)
        .anyOf(allowed)
        .toArray(get_parents);
    };

    if (doctype === 'Item Code') {
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
    if (doctype === 'Brand' && value) {
      const allowed = [value];
      return query(allowed);
    }
    return [];
  }

  async function withChild(row, doctype, value) {
    const apply_on = snakeCase(doctype);
    const { uom } =
      (await db
        .table(`Pricing Rule ${doctype}`)
        .where('parent')
        .equals(row.name)
        .and((x) => x[apply_on] === value)
        .first()) || {};

    return { ...row, [apply_on]: value, uom };
  }

  async function getAllowed(doctype) {
    const apply_on = snakeCase(doctype);
    const allowable = await getAllowable(doctype, args[apply_on]);
    return db
      .table('Pricing Rule')
      .where('name')
      .anyOf(allowable)
      .and((x) => !x.disable && x.selling === 1)
      .and((x) =>
        ['company', 'customer', 'campaign', 'sales_partner'].every(
          (field) => !x[field] || !args[field] || x[field] === args[field]
        )
      )
      .and((x) =>
        ['customer_group', 'territory', 'warehouse'].every(
          (field) => !x[field] || other_trees[`${field}s`].includes(x[field])
        )
      )
      .and(
        (x) =>
          !args.transaction_date ||
          (new Date(x.valid_from || '2000-01-01') <=
            new Date(args.transaction_date) &&
            new Date(args.transaction_date) <=
              new Date(x.valid_upto || '2500-12-31'))
      )
      .and(
        (x) =>
          !x.for_price_list ||
          !args.price_list ||
          x.for_price_list === args.price_list
      )
      .reverse()
      .sortBy('priority', (result) =>
        Promise.all(
          result.map((row) => withChild(row, doctype, args[apply_on]))
        )
      );
  }

  let rules = [];
  for (const doctype of ['Item Code', 'Item Group', 'Brand']) {
    rules = [...rules, ...(await getAllowed(doctype))];
  }

  return R.uniqBy(R.prop('name'), rules);
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L118
function apply_multiple_pricing_rules(rules) {
  return rules.every((x) => x.apply_multiple_pricing_rules);
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L177
async function filter_pricing_rules(args, _pricing_rules, doc = null) {
  let pricing_rules =
    _pricing_rules instanceof Array ? _pricing_rules : [_pricing_rules];

  const original_pricing_rule = R.clone(pricing_rules);

  if (pricing_rules.length > 0) {
    let stock_qty = Number(args.stock_qty);
    let amount = Number(args.price_list_rate) * Number(args.qty);
    if (pricing_rules[0].apply_rule_on_other) {
      const field = snakeCase(pricing_rules[0].apply_rule_on_other);
      if (field && pricing_rules[0][`other_${field}`] !== args[field]) {
        return;
      }
    }
    const pr_doc = await db.table('Pricing Rule').get(pricing_rules[0].name);
    if (pricing_rules[0].mixed_conditions && doc) {
      const result = await get_qty_and_rate_for_mixed_conditions(
        doc,
        pr_doc,
        args
      );
      stock_qty = result[0];
      amount = result[1];
      for (const pricing_rule_args of pricing_rule_args) {
        pricing_rule_args.apply_rule_on_other_items = result[2];
      }
    } else if (pricing_rules[0].is_cumulative) {
      const items = [args[snakeCase(pr_doc.apply_on)]];
      const data = await get_qty_amount_data_for_cumulative(
        pr_doc,
        args,
        items
      );
      if (data) {
        stock_qty += data[0];
        amount += data[1];
      }
    }

    if (
      pricing_rules[0].apply_rule_on_other &&
      !pricing_rules[0].mixed_conditions &&
      doc
    ) {
      pricing_rules =
        (await get_qty_and_rate_for_other_item(doc, pr_doc, pricing_rules)) ||
        [];
    } else {
      pricing_rules = await filter_pricing_rules_for_qty_amount(
        stock_qty,
        amount,
        pricing_rules,
        args
      );
    }
    if (pricing_rules.length === 0) {
      for (const d of original_pricing_rule) {
        if (!d.d.threshold_percentage) {
          continue;
        }
        const { item_code } = args;
        const suggestion = await validate_quantity_and_amount_for_suggestion(
          d,
          stock_qty,
          amount,
          item_code,
          args.transaction_type
        );
        if (suggestion) {
          return { suggestion, item_code };
        }
      }
    }
    for (const p of pricing_rules) {
      p.variant_of = p.item_code && args.variant_of ? args.variant_of : null;
    }
  }

  if (pricing_rules.length > 0) {
    const max_priority = Math.max(pricing_rules.map(R.prop('priority')));
    if (max_priority) {
      pricing_rules = pricing_rules.filter((x) => x.priority === max_priority);
    }
  }

  const all_fields = [
    'item_code',
    'item_group',
    'brand',
    'customer',
    'customer_group',
    'territory',
    'campaign',
    'sales_partner',
    'variant_of',
  ];

  if (pricing_rules.length > 1) {
    for (const field_set of [
      ['item_code', 'variant_of', 'item_group', 'brand'],
      ['customer', 'customer_group', 'territory'],
    ]) {
      const remaining_fields = all_fields.filter((x) => !field_set.includes(x));
      if (if_all_rules_same(pricing_rules, remaining_fields)) {
        pricing_rules = apply_internal_priority(pricing_rules, field_set, args);
        break;
      }
    }
  }

  if (pricing_rules.length > 1) {
    const rate_or_discount = Array.from(
      new Set(pricing_rules.map((x) => x.rate_or_discount))
    );
    if (
      rate_or_discount.length === 1 &&
      rate_or_discount[0] === 'Discount Percentage'
    ) {
      const filtered = pricing_rules.filter(
        (x) => x.for_price_list === args.price_list
      );
      if (filtered.length > 0) {
        pricing_rules = filtered;
      }
    }
  }

  if (pricing_rules.length > 1 && !args.for_shopping_cart) {
    throw new MultiplePricingRuleConflict(
      `Multiple Price Rules exists with same criteria, please resolve conflict by assigning priority.
      Price Rules: ${pricing_rules.map((x) => x.name).join(', ')}`
    );
  }

  return pricing_rules[0];
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L340
async function get_qty_and_rate_for_mixed_conditions(doc, pr_doc, args) {
  let sum_qty = 0;
  let sum_amt = 0;
  const items = (await get_pricing_rule_items(pr_doc)) || [];
  const apply_on = snakeCase(pr_doc.apply_on);

  if (items.length > 0 && doc.items && doc.items.length > 0) {
    for (const row of doc.items) {
      if (!items.includes(pr_doc[apply_on])) {
        continue;
      }
      if (pr_doc.mixed_conditions) {
        const qty = row.stock_qty || args.stock_qty || args.qty;
        const amt =
          args.item_code === row.item_code
            ? args.qty * args.price_list_rate
            : row.qty * (row.price_list_rate || rate);

        sum_qty += qty;
        sum_amt += amt;
      }
    }
    if (pr_doc.is_cumulative) {
      data = await get_qty_amount_data_for_cumulative(pr_doc, doc, items);
      if (data && data[0]) {
        sum_qty += data[0];
        sum_amt += data[1];
      }
    }
  }

  return [sum_qty, sum_amt, items];
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L378
async function get_qty_amount_data_for_cumulative(pr_doc, doc, items = []) {
  throw new UnsupportedFeatureError(
    'Pricing Rule: Is Cumulative is not supported by Client'
  );
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L366
async function get_qty_and_rate_for_other_item(doc, pr_doc, pricing_rules) {
  const items = await get_pricing_rule_items(pr_doc);

  for (const row of doc.items) {
    if (items.includes(row[snakeCase(pr_doc.apply_rule_on_other)])) {
      let filtered = await filter_pricing_rules_for_qty_amount(
        row.stock_qty,
        row.amount,
        pricing_rules,
        row
      );
      if (filtered.length > 0 && filtered[0]) {
        filtered[0].apply_rule_on_other_items = items;
        return filtered;
      }
    }
  }

  return [];
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L289
async function filter_pricing_rules_for_qty_amount(
  qty,
  rate,
  pricing_rules,
  args = null
) {
  let rules = [];

  for (const rule of pricing_rules) {
    let status = false;
    let conversion_factor = 1;

    if (rule.uom) {
      conversion_factor = await get_conversion_factor(rule.item_code, rule.uom);
    }
    if (
      qty >= rule.min_qty * conversion_factor &&
      (!rule.max_qty || qty <= rule.max_qty * conversion_factor)
    ) {
      status = true;
    }
    if (args && rule.uom === args.uom) {
      conversion_factor = 1;
    }
    if (
      status &&
      rate >= rule.min_amt * conversion_factor &&
      (!rule.max_amt || rate <= rule.max_amt * conversion_factor)
    ) {
      status = true;
    } else {
      status = false;
    }
    if (status) {
      rules = [...rules, rule];
    }
  }
  return rules;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L263
async function validate_quantity_and_amount_for_suggestion(
  args,
  qty,
  amount,
  item_code,
  transaction_type
) {
  function getFieldname(field) {
    const fieldCompare = field.include('min') ? R.lt : R.gt;
    const thresholdCompare = field.include('min') ? R.lte : R.gte;
    const value = field.includes('qty') ? qty : amount;
    if (
      args[field] &&
      fieldCompare(value, args[field]) &&
      thresholdCompare(
        args[field] - args[field] * args.threshold_percentage * 0.01,
        value
      )
    ) {
      return field;
    }
  }
  const fieldname =
    getFieldname('max_amt') ||
    getFieldname('max_qty') ||
    getFieldname('min_amt') ||
    getFieldname('min_qty');
  if (fieldname) {
    return `If you sell ${args[fieldname]} ${
      ['min_amt', 'max_amt'].includes(fieldname) ? 'worth' : 'quantities of the'
    } item <strong>${item_code}</strong>, the scheme <strong>${
      args.rule_description
    }</strong> will be applied on the item.`;
  }
  return '';
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L318
function if_all_rules_same(pricing_rules, fields) {
  const val = fields.map((x) => (pricing_rules[0] || {})[x]);
  for (const p of pricing_rules.slice(1)) {
    if (
      R.equals(
        val,
        fields.map((x) => p[x])
      )
    ) {
      return false;
    }
  }
  return true;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L328
function apply_internal_priority(pricing_rules, field_set, args) {
  for (const field of field_set) {
    if (args[field]) {
      for (const rule of pricing_rules) {
        if (rule[field] === args[field]) {
          return [rule];
        }
      }
    }
  }

  return pricing_rules;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L489
export async function get_product_discount_rule(
  pricing_rule,
  item_details,
  args,
  doc
) {
  const free_item = pricing_rule.same_item
    ? item_details.item_code || args.item_code
    : pricing_rule.free_item;

  if (!free_item) {
    throw new ValidationError(
      `Free item not set in the pricing rule ${pricing_rule.name}`
    );
  }

  let free_item_data = {
    item_code: free_item,
    qty: pricing_rule.free_qty || 1,
    rate: pricing_rule.free_item_rate || 0,
    price_list_rate: pricing_rule.free_item_rate || 0,
    is_free_item: 1,
  };

  const item_data = await db.table('Item').get(free_item);
  const { conversion_factor = 1 } = await get_conversion_factor(
    free_item,
    pricing_rule.free_item_uom || item_data.stock_uom
  );
  free_item_data = {
    ...free_item_data,
    ...R.pick(['item_name', 'description', 'stock_uom', item_data]),
    uom: pricing_rule.free_item_uom || item_data.stock_uom,
    conversion_factor,
  };

  async function getDefaultIncomeAccount() {
    const company = args.get('company') || doc.company;
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
      (await getDefault('Item Group', item_data.item_group)) ||
      (await getDefault('Brand', item_date.brand));

    return income_account || args.income_account;
  }

  const income_account = await getDefaultIncomeAccount();
  free_item_data = { ...free_item_data, income_account };
  return { free_item_data };
}
