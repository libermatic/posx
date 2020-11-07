import db from './db';

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
    {
      doctype: 'Stock Settings',
      fields: ['default_warehouse'],
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
