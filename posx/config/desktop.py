# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe


def get_data():
    return [
        {
            "module_name": "POS X",
            "color": "green",
            "icon": "octicon octicon-light-bulb",
            "type": "module",
            "label": frappe._("POS X"),
        }
    ]
