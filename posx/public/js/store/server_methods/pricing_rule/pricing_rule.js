import * as R from 'ramda';

import logger from '../../../utils/logger';
import db from '../../db';
import { get_conversion_factor } from '../get_item_details';
import {
  ValidationError,
  UnsupportedFeatureError,
} from '../../../utils/exceptions.js';

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

async function remove_pricing_rule_for_item(
  pricing_rules,
  initial,
  item_code = null
) {
  function getRateOrDiscount(pricing_rule) {
    if (pricing_rule.price_or_product_discount === 'Price') {
      if (pricing_rule.rate_or_discount === 'Discount Percentage') {
        return { discount_percentage: 0, discount_amount: 0 };
      }
      if (pricing_rule.rate_or_discount === 'Discount Amount') {
        return { discount_amount: 0 };
      }
    }
  }
  function getFreeItem(pricing_rule) {
    if (pricing_rule.free_item) {
      return {
        remove_free_item: pricing_rule.same_item
          ? item_code
          : pricing_rule.free_item,
      };
    }
  }
  function getMarginType(pricing_rule) {
    if (
      pricing_rule.price_or_product_discount === 'Price' &&
      ['Percentage', 'Amount'].includes(pricing_rule.margin_type)
    ) {
      return { margin_rate_or_amount: 0, margin_type: null };
    }
  }
  async function getMixedConditions(pricing_rule) {
    if (pricing_rule.mixed_conditions || pricing_rule.apply_rule_on_other) {
      const items = await get_pricing_rule_items(pricing_rule);
      return {
        apply_on: pricing_rule.apply_rule_on_other
          ? snakeCase(pricing_rule.apply_rule_on_other)
          : snakeCase(pricing_rule.apply_on),
        applied_on_items: items.join(','),
      };
    }
  }

  const resets = await Promise.all(
    pricing_rules.split(',').map(async function (name) {
      const pr = await db.table('Pricing Rule').get(name);
      console.log('promise.all', pr);

      const props = await Promise.all([
        getRateOrDiscount(pr),
        getFreeItem(pr),
        getMarginType(pr),
        getMixedConditions(pr),
      ]);
      return Object.assign(...props);
    })
  );

  return { ...initial, pricing_rules: '', ...Object.assign(...resets) };
}

async function get_applied_pricing_rules({ pricing_rules }) {
  if (!pricing_rules) {
    return [];
  }
  if (pricing_rules.startsWith('[')) {
    return JSON.parse(pricing_rules);
  }
  return pricing_rules.split(',');
}

async function get_pricing_rules(
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
) {
  const [customer_groups, territories, warehouses] = await Promise.all([
    customer_group ? getAncestors('Customer Group', customer_group) : [],
    territory ? getAncestors('Territory', territory) : [],
    warehouse ? getAncestors('Warehouse', warehouse) : [],
  ]);

  async function getRules(doctype) {
    const other_fields = {
      company,
      customer,
      campaign,
      sales_partner,
    };
    const other_trees = { customer_groups, territories, warehouses };
    const apply_on = snakeCase(doctype);
    const values = { item_code, item_group, brand };

    const parents = await getParents(doctype, values[apply_on]);
    if (parents.length === 0) {
      return [];
    }

    return db
      .table('Pricing Rule')
      .where('name')
      .anyOf(parents)
      .or('apply_rule_on_other')
      .equals(doctype)
      .and((x) => x[`other_${apply_on}`] === values[apply_on])
      .and((x) => !x.disable && x.selling === 1)
      .and((x) =>
        ['company', 'customer', 'campaign', 'sales_partner'].every(
          (field) =>
            !x[field] ||
            !other_fields[field] ||
            x[field] === other_fields[field]
        )
      )
      .and((x) =>
        ['customer_group', 'territory', 'warehouse'].every(
          (field) => !x[field] || other_trees[`${field}s`].includes(x[field])
        )
      )
      .and(
        (x) =>
          !transaction_date ||
          (new Date(x.valid_from || '2000-01-01') <=
            new Date(transaction_date) &&
            new Date(transaction_date) <=
              new Date(x.valid_upto || '2500-12-31'))
      )
      .and(
        (x) =>
          !x.for_price_list || !price_list || x.for_price_list === price_list
      )
      .reverse()
      .sortBy('priority');
  }

  let pricing_rules = [];
  for (const doctype of ['Item Code', 'Item Group', 'Brand']) {
    pricing_rules = [...pricing_rules, ...(await getRules(doctype))];
    if (
      pricing_rules.length > 0 &&
      !apply_multiple_pricing_rules(pricing_rules)
    ) {
      break;
    }
  }

  if (pricing_rules.length === 0) {
    return [];
  }

  // const pricing_rules = [...item_rules, ...group_rules, ...brand_rules];
  // if (pricing_rules.length === 0) {
  //   return [];
  // }

  return [];
}

function apply_multiple_pricing_rules(rules) {
  return rules.every((x) => x.apply_multiple_pricing_rules);
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L536
async function get_pricing_rule_items(pr_doc) {
  let apply_on_data = [];
  const apply_on = snakeCase(pr_doc.apply_on);

  const children = await db
    .table(`Pricing Rule ${pr_doc.apply_on}`)
    .where('parent')
    .equals(pr_doc.name)
    .toArray();

  for (let row of children) {
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

async function filter_pricing_rules(
  { stock_qty: _stock_qty, price_list_rate, qty: _qty, ...args },
  pricing_rules,
  doc = null
) {
  function filterApplyOnOther(pr) {
    if (pr.apply_rule_on_other) {
      const other_apply_on = `other_${snakeCase(pr.apply_rule_on_other)}`;
      return !other_apply_on || pr[other_apply_on] === args[other_apply_on];
    }
  }
  async function getQtyAndRateForMixedConditions(pr) {
    if (pr.mixed_conditions && doc) {
      const { stock_qty, amount } = await get_qty_and_rate_for_mixed_conditions(
        {
          item_code: args.item_code,
          qty: _qty,
          stock_qty: _stock_qty,
          price_list_rate,
          rate: args.rate,
        },
        pr,
        doc
      );
      return { stock_qty, amount };
    }
    if (pr.is_cumulative) {
      const { stock_qty, amount } = await get_qty_amount_data_for_cumulative(
        pr,
        doc,
        items
      );
      return { stock_qty, amount };
    }
    return { stock_qty: _stock_qty, amount: price_list_rate * _qty };
  }

  if (pricing_rules.length > 0) {
    if (filterApplyOnOther(pricing_rules[0])) {
      return;
    }
    const { stock_qty, amount } = await getQtyAndAmount(pricing_rules[0]);
    const filtered_prs =
      pricing_rules[0].apply_rule_on_other &&
      !pricing_rules[0].mixed_conditions &&
      doc
        ? await get_qty_and_rate_for_other_item(
            doc,
            pricing_rules[0],
            pricing_rules
          )
        : await filter_pricing_rules_for_qty_amount(
            stock_qty,
            amount,
            pricing_rules,
            args
          );
    if (filtered_prs.length === 0) {
      for (const pr of pricing_rules) {
        if (pr.threshold_percentage) {
          const { item_code } = args;
          const suggestion = validate_quantity_and_amount_for_suggestion(
            pr,
            stock_qty,
            amount,
            item_code
          );
          if (suggestion) {
            return { suggestion, item_code };
          }
        }
      }
    }

    const prioritized_prs = filtered_prs.filter(
      (x) => x.priority === Math.max(...filtered_prs.map((y) => y.priority))
    );

    function allRulesSame(field) {
      return (
        Array.from(new Set(pricing_rules.map((x) => x[field]))).length === 1
      );
    }

    // prioritized_prs.filter(x => )
    // L#230 utils.py

    return R.head(prioritized_prs);
  }
}

async function get_qty_and_rate_for_mixed_conditions(
  { item_code, qty, stock_qty: _stock_qty, price_list_rate, rate },
  pr,
  doc
) {
  const items = await get_pricing_rule_items(pr);
  const apply_on = snakeCase(pr.apply_on);
  if (items.length > 0 && doc.items && doc.items.length > 0) {
    const { stock_qty, amount } = doc.items
      .filter((x) => items.includes(x[apply_on]))
      .reduce(
        (a, x) => {
          if (pr.mixed_conditions) {
            const stock_qty = x.stock_qty || _stock_qty || qty;
            const amount =
              item_code === x.item_code
                ? qty * price_list_rate
                : x.qty * (x.price_list_rate || rate);
            return {
              stock_qty: a.stock_qty + stock_qty,
              amount: a.amount + amount,
            };
          }
          return a;
        },
        { stock_qty: 0, amount: 0 }
      );
    if (pr.is_cumulative) {
      const cumulative = get_qty_amount_data_for_cumulative(pr, doc, items);
      return {
        items,
        stock_qty: stock_qty + cumulative.stock_qty,
        amount: amount + cumulative.amount,
      };
    }

    return { items, stock_qty, amount };
  }
  return { items, stock_qty: 0, amount: 0 };
}

async function get_qty_amount_data_for_cumulative(pr, doc, items) {
  throw UnsupportedFeatureError(
    'Pricing Rule: Is Cumulative is not yet supported'
  );
}

async function filter_pricing_rules_for_qty_amount(
  qty,
  rate,
  pricing_rules,
  { uom } = {}
) {
  return Promise.all(
    pricing_rules.map(async function (rule) {
      const { conversion_factor } = await get_conversion_factor({
        item_code: rule.item_code,
        uom: rule.uom,
      });
      return { ...rule, conversion_factor };
    })
  ).then((rules) =>
    rules.filter((x) => {
      const qty_cf = x.conversion_factor;
      const rate_cf = uom === x.uom ? 1 : x.conversion_factor;
      return (
        qty >= x.min_qty * qty_cf &&
        (!x.max_qty || qty <= x.max_qty * qty_cf) &&
        rate >= x.min_amt * rate_cf &&
        (!x.max_amt || rate <= x.max_amt * rate_cf)
      );
    })
  );
}

async function get_qty_and_rate_for_other_item(doc, pr, pricing_rules) {
  const items = await get_pricing_rule_items(pr);

  for (const row of doc.items) {
    if (items.includes(row[snakeCase(pr.apply_rule_on_other)])) {
      const filtered_prs = await filter_pricing_rules_for_qty_amount(
        row.stock_qty,
        row.amount,
        pricing_rules,
        row
      );
      if (filtered_prs.length > 0) {
        return filtered_prs;
      }
    }
  }

  return [];
}

function validate_quantity_and_amount_for_suggestion(
  pr,
  stock_qty,
  amount,
  item_code
) {
  function getFieldname(field) {
    const fieldCompare = field.include('min') ? R.lt : R.gt;
    const thresholdCompare = field.include('min') ? R.lte : R.gte;
    const value = field.includes('qty') ? stock_qty : amount;
    if (
      pr[field] &&
      fieldCompare(value, pr[field]) &&
      thresholdCompare(
        pr[field] - pr[field] ** pr.threshold_percentage * 0.01,
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
      pr.rule_description
    }</strong> will be applied on the item.`;
  }
  return '';
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

async function getDescendents(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft >= lft && x.rgt <= rgt)
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

function snakeCase(text) {
  return text.toLowerCase().replace(' ', '_');
}
