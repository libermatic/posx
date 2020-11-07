import * as R from 'ramda';

import db from './db';
import { ENTITIES } from './entities';

const LIMIT = 100;

export async function pull_entities() {
  return Promise.all(ENTITIES.map(make_request()));
}

export async function clear_entities() {
  const omit = ['session_state', 'settings', 'draft_invoices'];
  return Promise.all(
    db.tables.map((x) => {
      if (!omit.includes(x.name)) {
        return x.clear();
      }
    })
  );
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
  const start_time = frappe.datetime.get_datetime_as_string();

  return async function request({ start = 0, limit = LIMIT }) {
    const last_updated = await db.sync_state
      .get('item_stock')
      .then((x) =>
        x ? x.lastUpdated : frappe.datetime.get_datetime_as_string('1970-01-01')
      );
    const { message: result = {} } = await frappe.call({
      method: 'posx.api.pos.get_stock_qtys',
      args: { warehouse, last_updated, start, limit },
    });

    ['item_stock', 'batch_stock'].forEach((tableName) => {
      const data = result[tableName] || [];
      if (data.length > 0) {
        db.table(tableName).bulkPut(data[tableName]);
      }
    });

    if (!result.has_more) {
      return db.sync_state.put({
        doctype: 'item_stock',
        lastUpdated: start_time,
      });
    }

    return request({ start: start + limit, limit });
  };
}

export async function update_qtys({ pos_profile, items }) {
  const { warehouse } = await db.table('POS Profile').get(pos_profile);
  return Promise.all(
    items.map(({ item_code, batch_no, qty }) =>
      Promise.all([
        db.item_stock
          .where({ item_code, warehouse })
          .first()
          .then((x) => db.item_stock.put({ ...x, qty: x.qty - qty })),
        batch_no &&
          db.batch_stock
            .where({ batch_no, warehouse })
            .first()
            .then((x) => db.batch_stock.put({ ...x, qty: x.qty - qty })),
      ])
    )
  );
}
