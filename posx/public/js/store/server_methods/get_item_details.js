import * as R from 'ramda';

import db from '../db';
import { UnsupportedFeatureError } from '../../utils/exceptions.js';
import logger from '../../utils/logger';

export async function erpnext__stock__get_item_details__apply_price_list({
  args: _args,
  as_doc = false,
}) {
  if (as_doc) {
    return;
  }
  const args = JSON.parse(_args);
  const parent = await getCurrencyAndConversion(args);
  const children = await getChildrenWithPriceDetails(args, parent);
  return { message: { parent, children } };
}

export async function erpnext__stock__get_item_details__get_item_details({
  args,
  doc = null,
  for_validate = false,
  overwrite_warehouse = true,
}) {}

export async function erpnext__stock__get_item_details__get_item_tax_info({
  company,
  tax_category,
  item_codes,
}) {}

async function getCurrencyAndConversion({
  price_list,
  company,
  plc_conversion_rate,
}) {
  // NOTE: `price_list_uom_dependant` does not exists
  // but `price_not_uom_dependent` does
  const [
    { currency: price_list_currency, price_list_uom_dependant = null } = {},
    { default_currency } = {},
  ] = await Promise.all([
    db
      .table('Price List')
      .where('name')
      .equals(price_list)
      .and((x = {}) => x.enabled)
      .first(),
    db.table('Company').get(company),
  ]);

  if (price_list_currency !== default_currency) {
    throw new UnsupportedFeatureError('Multi-currency not yet supported!');
  }
  return {
    price_list_currency,
    price_list_uom_dependant,
    plc_conversion_rate: plc_conversion_rate || 1,
  };
}

async function getChildrenWithPriceDetails(args, parent) {
  return Promise.all(
    args.items.map(async function (x) {
      const price_list_rate = await getPriceListRate({
        ...R.pick(['uom', 'conversion_factor', 'item_code', 'stock_uom'], x),
        ...R.pick(['customer', 'price_list', 'transaction_date'], args),
        ...R.pick(['price_list_uom_dependant'], parent),
      });
      const pricingRuleDetails = getRowWithPricingRule(x);
      return {
        ...pricingRuleDetails,
        price_list_rate:
          (price_list_rate * R.propOr(1, 'conversion_rate', args)) /
          R.propOr(1, 'plc_conversion_rate', parent),
      };
    })
  );
}

export async function get_price_list_rate({
  item_code,
  customer,
  price_list,
  price_list_uom_dependant,
  transaction_date,
  qty,
  uom,
  stock_uom,
  conversion_factor,
}) {
  async function getPrice(item_code) {
    const customerPrice = await getItemPrices({
      item_code,
      price_list,
      uom,
      customer,
      transaction_date,
      qty,
    }).then(getOne);
    if (customerPrice) {
      return customerPrice;
    }

    const generalPrice = await getItemPrices({
      item_code,
      price_list,
      uom,
      transaction_date,
      qty,
      ignore_party: true,
    }).then(getOne);
    if (generalPrice) {
      return generalPrice;
    }

    if (uom !== stock_uom) {
      const stockGeneralPrice = await getItemPrices({
        item_code,
        price_list,
        uom: stock_uom,
        transaction_date,
        qty,
        ignore_party: true,
      }).then(getOne);
      if (stockGeneralPrice) {
        return stockGeneralPrice;
      }
    }
  }

  function getOne(prices) {
    const first = R.head(prices);
    if (first) {
      if (first.uom !== uom && !price_list_uom_dependant) {
        return first.price_list_rate * (conversion_factor || 1);
      }
      return first.price_list_rate;
    }
  }

  const item_price = await getPrice(item_code);
  if (item_price) {
    return item_price;
  }

  const { variant_of } = (await db.table('Item').get(item_code)) || {};
  if (variant_of) {
    const template_price = await getPrice(variant_of);
    if (template_price) {
      return template_price;
    }
  }

  return 0;
}

async function getItemPrices({
  item_code,
  price_list,
  uom,
  customer,
  transaction_date,
  qty,
  ignore_party = false,
}) {
  return db
    .table('Item Price')
    .where('item_code')
    .equals(item_code)
    .and((x) => x.price_list === price_list)
    .and((x) => !x.uom || x.uom === uom)
    .and((x) => (ignore_party ? x.customer === customer : !x.customer))
    .and(
      (x) =>
        new Date(x.valid_from || '2000-01-01') <= new Date(transaction_date) &&
        new Date(transaction_date) <= new Date(x.valid_upto || '2500-12-31')
    )
    .and((x) => !qty || !x.packing_unit || x.packing_unit % qty === 0)
    .toArray();
}

function getRowWithPricingRule(row) {
  logger('unhandled', { bgcolor: '#7f0000' });
  return {
    doctype: row.doctype,
    name: row.name,
    parent: row.parent,
    parenttype: row.parenttype,
    child_docname: row.child_docname,
    discount_percentage_on_rate: [],
    discount_amount_on_rate: [],
  };
}

export async function get_conversion_factor({ item_code, uom }) {
  const { variant_of } = (await db.table('Item').get(item_code)) || {};
  const parents = variant_of ? [item_code, variant_of] : [item_code];
  const { conversion_factor = 1 } =
    (await db
      .table('UOM Conversion Detail')
      .where('parent')
      .anyOf(parents)
      .and((x) => x.uom === uom)
      .first()) || {};
  return { conversion_factor };
}
