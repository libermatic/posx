import Dexie from 'dexie';
import relationships from 'dexie-relationships';

const db = new Dexie('posx', { addons: [relationships] });

db.version(1).stores({
  sync_state: 'doctype',

  // backend models
  Company: 'name',
  Account: 'name',
  'Cost Center': 'name',
  Currency: 'name',
  'Price List': 'name',

  'Sales Taxes and Charges Template': 'name',
  'Sales Taxes and Charges':
    'name, parent -> "Sales Taxes and Charges Template".name',

  'POS Profile': 'name',
  'POS Profile User': 'name, parent -> "POS Profile".name',
  'Sales Invoice Payment': 'name, parent -> "POS Profile".name',
  'POS Item Group': 'name, parent -> "POS Profile".name',
  'POS Customer Group': 'name, parent -> "POS Profile".name',

  'Item Group': 'name',
  'Item Default': 'name, parent',
  'Item Tax': 'name, parent',

  Customer: 'name',
  Territory: 'name',
  'Customer Group': 'name',
});

export default db;
