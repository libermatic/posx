# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from erpnext.stock.get_item_details import get_item_price


@frappe.whitelist(0)
def get_price(item_code, price_list):
    args = {
        "price_list": price_list,
        "uom": frappe.get_cached_value("Item", item_code, "stock_uom"),
        "transaction_date": frappe.utils.today(),
    }
    try:
        item_price = get_item_price(args, item_code, ignore_party=True)
        if item_price:
            return item_price[0][1]
        variant_of = frappe.get_cached_value("Item", item_code, "variant_of")
        if variant_of:
            return get_item_price(args, variant_of, ignore_party=True)[0][1]
    except IndexError:
        return None
