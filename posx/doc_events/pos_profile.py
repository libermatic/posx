# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe


def validate(doc, method):
    if doc.px_use_local_datastore and not doc.warehouse:
        frappe.throw(frappe._("Warehouse is necessary when local datastore is used"))

