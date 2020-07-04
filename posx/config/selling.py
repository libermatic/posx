# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from frappe import _


def get_data():
    return [
        {
            "label": _("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "X POS Settings",
                    "label": _("X POS Settings"),
                    "description": _("Extended POS settings"),
                    "settings": 1,
                },
            ],
        },
    ]
