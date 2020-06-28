# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from toolz.curried import merge


@frappe.whitelist()
def create_opening(
    opening_cash, company, pos_profile, user=None, branch=None, start_datetime=None
):
    xzreport = frappe.get_doc(
        {
            "doctype": "XZ Report",
            "start_datetime": start_datetime or frappe.utils.now(),
            "user": user or frappe.session.user,
            "pos_profile": pos_profile,
            "branch": branch,
            "company": company,
            "opening_cash": opening_cash,
        }
    ).insert(ignore_permissions=True, ignore_mandatory=True)
    return xzreport.name


@frappe.whitelist()
def get_unclosed(user, pos_profile=None, company=None):
    return frappe.db.exists(
        "XZ Report",
        merge(
            {"user": user, "company": company, "docstatus": 0},
            {"pos_profile": pos_profile} if pos_profile else {},
        ),
    )
