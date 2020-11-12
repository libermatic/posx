import * as R from 'ramda';

import db from './db';
import { ENTITIES } from './entities';

const LIMIT = 100;

export async function pull_entities() {
  const default_date = frappe.datetime.get_datetime_as_string('1970-01-01');
  const start_time = frappe.datetime.get_datetime_as_string();

  const states = await db.sync_state
    .where('doctype')
    .anyOf(ENTITIES.map((x) => x.doctype))
    .toArray();

  const entities = ENTITIES.map(({ doctype, get_filters }) => {
    const { last_updated = default_date } =
      states.find((x) => x.doctype === doctype) || {};
    return { doctype, last_updated, filters: get_filters && get_filters() };
  });

  const { message: doctypes = [] } = await frappe.call({
    method: 'posx.api.pos.get_modified_doctypes',
    args: { entities },
  });

  if (doctypes.length > 0) {
    await Promise.all(
      doctypes.map(({ count, doctype }) =>
        db.sync_state.get(doctype).then((x) =>
          db.sync_state.put({
            doctype,
            count,
            last_updated: x ? x.last_updated : null,
            start_time,
          })
        )
      )
    );
  }

  const record_count = R.sum(R.map(R.prop('count'), doctypes));

  record_count &&
    frappe.show_alert({
      indicator: 'orange',
      message: `Datastore: ${record_count} record(s) will be fetched.`,
    });

  await Promise.all(ENTITIES.map(make_request(start_time, doctypes)));

  record_count &&
    frappe.show_alert({
      indicator: 'green',
      message: `Datastore: ${record_count} record(s) fetched sucessfully in ${(
        (new Date() - frappe.datetime.str_to_obj(start_time)) /
        1000
      ).toFixed(1)} seconds.`,
    });

  return;
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

function make_request(start_time, doctypes) {
  const willFetch = (dt) =>
    (doctypes.find((x) => x.doctype === dt) || {}).count > 0;

  return async function request({
    doctype,
    fields,
    children = [],
    start = 0,
    limit = LIMIT,
    get_filters,
  } = {}) {
    const state = (await db.sync_state.get(doctype)) || {};

    if (!willFetch(doctype)) {
      return db.sync_state.put({
        ...state,
        doctype,
        updated: 0,
        last_updated: start_time,
      });
    }

    if (start > (state.count || 0)) {
      return db.sync_state.put({
        ...state,
        doctype,
        elapsed: (new Date() - frappe.datetime.str_to_obj(start_time)) / 1000,
        last_updated: start_time,
      });
    }

    const _fields = [
      ...get_fields({ doctype, fields }),
      ...children.flatMap((x) => get_fields(x, true)),
    ];

    const modified =
      state.last_updated ||
      frappe.datetime.get_datetime_as_string('1970-01-01');

    const filters = get_filters ? await get_filters({ modified }) : {};

    const data = await frappe.db.get_list(doctype, {
      fields: _fields,
      start,
      limit,
      filters: { ...filters, modified: ['>', modified] },
    });

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

    await db.sync_state.put({
      ...state,
      doctype,
      updated: (state.updated || 0) + data.length,
    });

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

  return async function request({ start = 0, limit = LIMIT } = {}) {
    const last_updated = await db.sync_state
      .get('item_stock')
      .then((x) =>
        x && x.last_updated
          ? x.last_updated
          : frappe.datetime.get_datetime_as_string('1970-01-01')
      );
    const { message: result = {} } = await frappe.call({
      method: 'posx.api.pos.get_stock_qtys',
      args: { warehouse, last_updated, start, limit },
    });

    ['item_stock', 'batch_stock'].forEach((tableName) => {
      const data = result[tableName] || [];
      if (data.length > 0) {
        db.table(tableName).bulkPut(data);
      }
    });

    if (!result.has_more) {
      frappe.show_alert({
        indicator: 'green',
        message: `Datastore: Updated inventory records in ${(
          (new Date() - frappe.datetime.str_to_obj(start_time)) /
          1000
        ).toFixed(1)} seconds.`,
      });

      return db.sync_state.put({
        doctype: 'item_stock',
        last_updated: start_time,
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
