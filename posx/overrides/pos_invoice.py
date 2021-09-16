import frappe
from erpnext.accounts.doctype.pos_invoice.pos_invoice import POSInvoice


class CustomPOSInvoice(POSInvoice):
    def validate_stock_availablility(self):
        if self.pos_profile and frappe.get_cached_value(
            "POS Profile", self.pos_profile, "px_ignore_availability"
        ):
            return

        super(POSInvoice, self).validate_stock_availablility()
