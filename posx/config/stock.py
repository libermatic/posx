# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe


def get_data():
    return [
        {
            "label": frappe._("Tools"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Label Printer",
                    "description": frappe._(
                        "Print labels manaully or from Reference Documents"
                    ),
                },
            ],
        },
    ]
