import db from '../db';

export async function erpnext__accounts__doctype__sales_invoice__sales_invoice__get_loyalty_programs({
  customer,
}) {
  const { loyalty_program } = (await db.table('Customer').get(customer)) || {};
  if (loyalty_program) {
    return { message: null };
  }
}
