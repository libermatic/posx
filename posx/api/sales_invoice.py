# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from toolz.curried import merge
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
    item_price = get_price_list_rate_for(kwargs, item_code)
    if item_price:
        return item_price

    template = frappe.get_cached_value("Item", item_code, "variant_of")
    if template:
        return get_price_list_rate_for(kwargs, template)

    return None
