import * as R from 'ramda';

import db from '../db';
import logger from '../../utils/logger';
import { UnableToSelectBatchError } from '../../utils/exceptions.js';

export async function erpnext__stock__doctype__batch__batch__get_batch_no({
  item_code,
  warehouse,
  qty = 1,
  throw: _throw = false,
  serial_no = null,
}) {
  if (serial_no) {
    logger('get_batch_no: delegate queries with serial_no from network');
    return;
  }

  const batch_no = await db
    .table('Batch')
    .where('item')
    .equals(item_code)
    .and((x) => !x.expiry_date || new Date(x.expiry_date) >= new Date())
    .sortBy('expiry_date')
    .then((x) =>
      Promise.all(
        x.map(({ name: batch_no }) =>
          db.batch_stock
            .where({ batch_no, warehouse })
            .and((x) => x.qty >= qty)
            .first()
        )
      )
    )
    .then(R.compose(R.prop('batch_no'), R.head, R.filter(R.identity)));

  if (!batch_no) {
    throw new UnableToSelectBatchError(
      `Please select a Batch for Item ${item_code}. ` +
        `Unable to find a single batch that fulfills this requirement`
    );
  }

  return { message: batch_no };
}
