import * as R from 'ramda';

import db from './db';
import { ENTITIES } from './entities';

const LIMIT = 100;

export async function pull_entities() {
  return Promise.all(ENTITIES.map(make_request()));
}

function make_request() {
  const start_time = frappe.datetime.get_datetime_as_string();
  return async function request({
    doctype,
    fields,
    children = [],
    start = 0,
    limit = LIMIT,
    get_filters,
  }) {
    const _fields = [
      ...get_fields({ doctype, fields }),
      ...children.flatMap((x) => get_fields(x, true)),
    ];
    const modified = await db.sync_state
      .get(doctype)
      .then((x) =>
        x ? x.lastUpdated : frappe.datetime.get_datetime_as_string('1970-01-01')
      );
    const filters = get_filters ? await get_filters({ modified }) : {};

    const data = await frappe.db.get_list(doctype, {
      fields: _fields,
      start,
      limit,
      filters: { ...filters, modified: ['>', modified] },
    });

    if (data.length === 0) {
      return db.sync_state.put({ doctype, lastUpdated: start_time });
    }

    db.table(doctype).bulkPut(
      R.uniqBy(
        (x) => x.name,
        data.map((x) => get_data(x, { doctype, fields }))
      )
    );
    children.forEach((child) =>
      db.table(child.doctype).bulkPut(
        data
          .map(({ name: parent, ...x }) => ({
            ...get_data(x, child, true),
            parent,
            parenttype: doctype,
          }))
          .filter((x) => x.name)
      )
    );

    return request({
      doctype,
      fields,
      children,
      start: start + limit,
      limit,
      get_filters,
    });
  };
}

function get_fields(model, is_child = false) {
  return ['name', ...model.fields].map(
    (x) =>
      `\`tab${model.doctype}\`.${x}${
        is_child ? ` as '${model.doctype}:${x}'` : ''
      }`
  );
}

function get_data(data, model, is_child = false) {
  if (is_child) {
    const fields = ['name', ...model.fields].map(
      (x) => `${model.doctype}:${x}`
    );
    const picked = R.pick(fields, data);
    return Object.keys(picked).reduce(
      (a, x) => ({ ...a, [x.split(':')[1]]: picked[x] }),
      {}
    );
  }

  return R.pick(['name', ...model.fields], data);
}

export function pull_stock_qtys({ warehouse }) {
  async function storeStock(stock) {
    const existing = await db.batch_stock
      .where({
        batch_no: stock.batch_no,
        warehouse: stock.warehouse,
      })
      .first();
    return db.batch_stock.put({ ...existing, ...stock });
  }
  return async function () {
    const entities = await db.table('Batch').toArray().then(R.pluck('name'));
    Promise.all(
      R.splitEvery(LIMIT, entities).map((batches) =>
        frappe
          .call({
            method: 'posx.api.pos.get_stock_qtys',
            args: { batches, warehouse },
          })
          .then(({ message: data }) => Promise.all(data.map(storeStock)))
      )
    );
  };
}

export async function set_session_state(args) {
  return db.session_state.bulkPut(
    Object.keys(args).map((key) => ({ key, value: args[key] }))
  );
}

export async function cache_settings() {
  const entities = [
    {
      doctype: 'Accounts Settings',
      fields: ['determine_address_tax_category_from'],
    },
  ];

  return Promise.all(
    entities.map(({ doctype, fields }) =>
      frappe
        .call({
          method: 'posx.api.pos.get_settings',
          args: { doctype, fields },
        })
        .then(({ message }) => db.settings.put({ doctype, ...message }))
    )
  );
}
