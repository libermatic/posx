import db from './db';

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
