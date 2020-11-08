import {
  get_batch_no,
  get_batch_qty,
  get_batch_qty_and_serial_no,
  get_batch_price,
} from './batch';

export async function erpnext__stock__doctype__batch__batch__get_batch_no({
  item_code,
  warehouse,
  qty = 1,
  throw: _throw = false,
  serial_no = null,
}) {
  const message = await get_batch_no(
    item_code,
    warehouse,
    qty,
    _throw,
    serial_no
  );

  if (message) {
    return { message };
  }
}

export async function posx__api__sales_invoice__get_batch_price(args) {
  const message = await get_batch_price(args);
  if (message) {
    return { message };
  }
}

export async function posx__api__sales_invoice__get_batch_qty({
  batch_no,
  warehouse,
  item_code,
  customer,
  price_list,
  transaction_date,
  company,
}) {
  const message = await get_batch_qty(
    batch_no,
    warehouse,
    item_code,
    customer,
    price_list,
    transaction_date,
    company
  );

  if (message) {
    return { message };
  }
}

export async function erpnext__stock__get_item_details__get_batch_qty_and_serial_no({
  batch_no,
  stock_qty,
  warehouse,
  item_code,
  has_serial_no,
}) {
  const message = await get_batch_qty_and_serial_no(
    batch_no,
    stock_qty,
    warehouse,
    item_code,
    has_serial_no
  );
  if (message) {
    return { message };
  }
}
