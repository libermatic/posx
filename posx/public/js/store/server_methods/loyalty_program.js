import db from '../db';
import { ValidationError } from '../../utils/exceptions';

export async function erpnext__accounts__doctype__loyalty_program__loyalty_program__get_loyalty_program_details(
  args
) {
  const message = await get_loyalty_program_details(args);
  if (message) {
    return { message };
  }
}

async function get_loyalty_program_details({
  customer,
  loyalty_program = null,
  expiry_date = null,
  company = null,
  silent = false,
  include_expired_entry = false,
}) {
  const _loyalty_program =
    loyalty_program ||
    (await db
      .table('Customer')
      .get(customer)
      .then((x) => x && x.loyalty_program));
  if (!_loyalty_program) {
    if (!silent) {
      throw new ValidationError(
        "Customer isn't enrolled in any Loyalty Program"
      );
    }
    return { loyalty_program: null };
  }

  const doc = await db.table('Loyalty Program').get(_loyalty_program);
  if (!doc) {
    return;
  }
  const { name } = doc;
  const collection_rules = await db
    .table('Loyalty Program Collection')
    .where('parent')
    .equals(name)
    .toArray();
  return { ...doc, loyalty_program: doc.name, collection_rules };
}
