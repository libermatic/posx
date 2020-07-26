# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe


def get_data():
    return [
        {
            "label": frappe._("Sales"),
            "items": [
                {
                    "type": "doctype",
                    "name": "XZ Report",
                    "description": frappe._("XZ Report"),
                },
            ],
        },
        {
            "label": frappe._("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "POS X Settings",
                    "label": frappe._("POS X Settings"),
                    "description": frappe._("Extended POS settings"),
                    "settings": 1,
                }
            ],
        },
    ]
