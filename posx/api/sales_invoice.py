# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from toolz.curried import merge, dissoc
from erpnext.stock.get_item_details import get_price_list_rate_for


@frappe.whitelist()
def get_batch_price(batch_no, **kwargs):
    """
        Args:
            batch_no: Batch
            item_code: Item
            customer: Customer
            price_list: Price List
            qty: Float
            transaction_date: Date
            uom: UOM
        Returns
            Currency
    """
    batch_price = frappe.get_cached_value("Batch", batch_no, "px_price_list_rate")
    if batch_price:
        return batch_price

    item_code = kwargs.get("item_code")
    uom = kwargs.get("uom") or frappe.get_cached_value("Item", item_code, "stock_uom")
    item_price = get_price_list_rate_for(merge(kwargs, {"uom": uom}), item_code)
    if item_price:
        return item_price

    template = frappe.get_cached_value("Item", item_code, "variant_of")
    if template:
        return get_price_list_rate_for(merge(kwargs, {"uom": uom}), template)

    return None


@frappe.whitelist()
def get_batch_qty(warehouse=None, **kwargs):
    from erpnext.stock.doctype.batch.batch import get_batch_qty

    item_code = kwargs.get("item_code")
    batch_no = kwargs.get("batch_no")
    available_qty = get_batch_qty(batch_no, warehouse, item_code)

    batch_price_list_rate = get_batch_price(
        batch_no, qty=1, **dissoc(kwargs, "batch_no")
    )

    return {
        "available_qty": available_qty,
        "batch_price_list_rate": batch_price_list_rate,
    }

