import Dexie from 'dexie';
import { ENTITIES } from './entities';

function getModelSchema() {
  return Object.assign(
    {},
    ...ENTITIES.flatMap((x) => [
      {
        doctype: x.doctype,
        indices: ['name', ...(x.indices || [])],
      },
      ...(x.children || []).map((y) => ({
        doctype: y.doctype,
        indices: ['name', 'parent', ...(y.indices || [])],
      })),
    ]).map(({ doctype, indices }) => ({ [doctype]: indices.join(',') }))
  );
}

const db = new Dexie('posx');

db.version(1).stores({
  sync_state: 'doctype',
  session_state: 'key',
  settings: 'doctype',
  item_stock: '++id, [item_code+warehouse]',
  batch_stock: '++id, [batch_no+warehouse]',
  ...getModelSchema(),
});

export default db;
