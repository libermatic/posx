# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import json
import frappe
from toolz.curried import merge, compose, concatv


@frappe.whitelist()
def get_stock_qtys(warehouse, items=None, batches=None):
    if not warehouse:
        frappe.throw(frappe._("Please set Warehouse in POS Profile"))

    if items:
        return frappe.get_all(
            "Bin",
            filters={"item_code": ("in", json.loads(items)), "warehouse": warehouse},
            fields=["item_code", "warehouse", "actual_qty as qty"],
        )

    if batches:
        return frappe.db.get_list(
            "Stock Ledger Entry",
            filters={"batch_no": ("in", json.loads(batches)), "warehouse": warehouse},
            fields=["batch_no", "warehouse", "sum(actual_qty) as qty"],
            group_by="batch_no, warehouse",
        )

    frappe.throw(frappe._("Either a list of items or batches is required"))


@frappe.whitelist()
def get_settings(doctype, fields):
    _fields = json.loads(fields)
    return frappe.get_cached_value(doctype, None, fieldname=_fields, as_dict=1)
