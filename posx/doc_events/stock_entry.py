# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from posx.doc_events.purchase_receipt import set_or_create_batch


def before_validate(doc, method):
    if doc.stock_entry_type == "Material Receipt" and doc._action == "submit":
        set_or_create_batch(doc, method)
