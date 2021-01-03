# -*- coding: utf-8 -*-
# pylint: disable=no-member,access-member-before-definition
# Copyright (c) 2020, Libermatic and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import operator
import frappe
from frappe.model.document import Document
from toolz.curried import (
    merge,
    keyfilter,
    compose,
    unique,
    pluck,
    excepts,
    first,
    partial,
    filter,
    map,
)

from posx.utils import sumby


class XZReport(Document):
    def validate(self):
        existing = frappe.db.sql(
            """
                SELECT 1 FROM `tabXZ Report`
                WHERE
                    docstatus = 1 AND
                    name != %(name)s AND
                    company = %(company)s AND
                    pos_profile = %(pos_profile)s AND
                    user = %(user)s AND
                    start_datetime <= %(end_datetime)s AND
                    end_datetime >= %(start_datetime)s
            """,
            values={
                "name": self.name,
                "company": self.company,
                "pos_profile": self.pos_profile,
                "user": self.user,
                "start_datetime": self.start_datetime or frappe.utils.now(),
                "end_datetime": self.end_datetime or frappe.utils.now(),
            },
        )
        if existing:
            frappe.throw(
                frappe._("Another XZ Report already exists during this time frame.")
            )

    def before_insert(self):
        if not self.start_datetime:
            self.start_datetime = frappe.utils.now()

    def before_save(self):
        self.expected_cash = sum(
            [
                frappe.utils.flt(self.get(x))
                for x in [
                    "opening_cash",
                    "cash_sales",
                    "cash_returns",
                    "cash_payins",
                    "cash_payouts",
                ]
            ]
        )
        self.short_cash = self.expected_cash - frappe.utils.flt(self.closing_cash)

    def set_report_details(self):
        args = merge(
            keyfilter(
                lambda x: x in ["user", "pos_profile", "company"], self.as_dict()
            ),
            {
                "start_datetime": self.start_datetime or frappe.utils.now(),
                "end_datetime": self.end_datetime or frappe.utils.now(),
            },
        )

        sales, returns = _get_invoices(args)
        sales_payments, returns_payments = _get_si_payments(args)
        payin_payments, payout_payments = _get_pe_payments(args)

        def get_mop_amount(mode_of_payment=None, payments=[]):
            return compose(
                lambda x: x.get("amount"),
                excepts(StopIteration, first, lambda x: {"amount": 0}),
                filter(lambda x: x.get("mode_of_payment") == mode_of_payment),
            )(payments)

        get_sales_amount = partial(get_mop_amount, payments=sales_payments)
        get_returns_amount = partial(get_mop_amount, payments=returns_payments)
        get_payin_amount = partial(get_mop_amount, payments=payin_payments)
        get_payout_amount = partial(get_mop_amount, payments=payout_payments)

        sum_by_total = sumby("total")
        sum_by_net = sumby("net_total")
        sum_by_discount = compose(operator.neg, sumby("discount_amount"))
        sum_by_taxes = sumby("total_taxes_and_charges")
        sum_by_change = sumby("change_amount")
        sum_by_grand = sumby("grand_total")
        sum_by_rounded = sumby("rounded_total")

        get_cash = compose(
            sum,
            map(lambda x: x.get("amount")),
            filter(lambda x: x.get("type") == "Cash"),
        )

        def make_payment(mode_of_payment):
            type = frappe.get_cached_value("Mode of Payment", mode_of_payment, "type")
            is_cash = mode_of_payment == "Cash" and type == "Cash"
            sales_amount = (
                get_sales_amount(mode_of_payment) - sum_by_change(sales)
                if is_cash
                else get_sales_amount(mode_of_payment)
            )
            returns_amount = (
                get_returns_amount(mode_of_payment) - sum_by_change(returns)
                if is_cash
                else get_returns_amount(mode_of_payment)
            )
            payins = get_payin_amount(mode_of_payment)
            payouts = get_payout_amount(mode_of_payment)
            return {
                "mode_of_payment": mode_of_payment,
                "type": type,
                "sales": sales_amount,
                "returns": returns_amount,
                "payins": payins,
                "payouts": payouts,
                "total": sales_amount + returns_amount + payins + payouts,
            }

        self.cash_sales = get_cash(sales_payments) - sum_by_change(sales)
        self.cash_returns = get_cash(returns_payments) - sum_by_change(returns)
        self.cash_payins = get_cash(payin_payments)
        self.cash_payouts = get_cash(payout_payments)

        self.sales__total = sum_by_total(sales)
        self.sales__discount_amount = sum_by_discount(sales)
        self.returns__net_total = sum_by_net(returns)
        self.total__net_total = sum_by_net(sales + returns)
        self.total__total_taxes_and_charges = sum_by_taxes(sales + returns)
        self.total__change_amount = sum_by_change(sales + returns)
        self.total__grand_total = sum_by_grand(sales + returns)
        self.total__rounded_total = sum_by_rounded(sales + returns)

        make_invoice = keyfilter(
            lambda x: x
            in [
                "invoice",
                "total_taxes_and_charges",
                "rounded_total",
                "grand_total",
                "outstanding_amount",
            ]
        )
        mops = compose(unique, pluck("mode_of_payment"))

        self.sales = []
        for invoice in sales:
            self.append("sales", make_invoice(invoice))
        self.returns = []
        for invoice in returns:
            self.append("returns", make_invoice(invoice))
        self.payments = []
        for payment in mops(
            sales_payments + returns_payments + payin_payments + payout_payments
        ):
            self.append("payments", make_payment(payment))


def _get_invoices(args):
    query = """
        SELECT
            name AS invoice,
            base_total AS total,
            base_net_total AS net_total,
            base_discount_amount AS discount_amount,
            base_total_taxes_and_charges AS total_taxes_and_charges,
            base_change_amount AS change_amount,
            base_grand_total AS grand_total,
            base_rounded_total AS rounded_total,
            outstanding_amount
        FROM `tabSales Invoice`
        WHERE docstatus = 1 AND
            {other} AND
            company = %(company)s AND
            owner = %(user)s AND
            TIMESTAMP(posting_date, posting_time)
                BETWEEN %(start_datetime)s AND %(end_datetime)s
    """
    sales = frappe.db.sql(
        query.format(
            other="""
                is_pos = 1 AND
                is_return != 1 AND
                pos_profile = %(pos_profile)s
            """
        ),
        values=args,
        as_dict=1,
    )
    returns = frappe.db.sql(
        query.format(
            other="""
                is_return = 1
            """
        ),
        values=args,
        as_dict=1,
    )
    return sales, returns


def _get_si_payments(args):
    query = """
        SELECT
            sip.mode_of_payment AS mode_of_payment,
            sip.type AS type,
            SUM(sip.base_amount) AS amount
        FROM `tabSales Invoice Payment` AS sip
        LEFT JOIN `tabSales Invoice` AS si ON
            sip.parent = si.name
        WHERE si.docstatus = 1 AND
            {other} AND
            si.company = %(company)s AND
            si.owner = %(user)s AND
            TIMESTAMP(si.posting_date, si.posting_time)
                BETWEEN %(start_datetime)s AND %(end_datetime)s
        GROUP BY sip.mode_of_payment
    """
    sales_payments = frappe.db.sql(
        query.format(
            other="""
                si.is_pos = 1 AND
                si.is_return != 1 AND
                si.pos_profile = %(pos_profile)s
            """
        ),
        values=args,
        as_dict=1,
    )
    returns_payments = frappe.db.sql(
        query.format(
            other="""
                si.is_return = 1
            """
        ),
        values=args,
        as_dict=1,
    )
    return sales_payments, returns_payments


def _get_pe_payments(args):
    query = """
        SELECT
            pe.mode_of_payment,
            mop.type,
            SUM(
                IF(pe.payment_type = 'Receive', pe.paid_amount, -1 * pe.paid_amount)
            ) AS amount
        FROM `tabPayment Entry` AS pe
        LEFT JOIN `tabMode of Payment` AS mop
            ON mop.name = pe.mode_of_payment
        WHERE pe.docstatus = 1 AND
            pe.payment_type IN %(payment_types)s AND
            pe.company = %(company)s AND
            pe.owner = %(user)s AND
            TIMESTAMP(pe.posting_date, pe.px_posting_time)
                BETWEEN %(start_datetime)s AND %(end_datetime)s
        GROUP BY mode_of_payment
    """
    payin_payments = frappe.db.sql(
        query, values=merge(args, {"payment_types": ["Receive"]}), as_dict=1,
    )
    payout_payments = frappe.db.sql(
        query,
        values=merge(args, {"payment_types": ["Pay", "Internal Transfer"]}),
        as_dict=1,
    )
    return payin_payments, payout_payments
