# Copyright (c) 2022, Libermatic and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class POSAsset(Document):
	def validate(self):
		if bool(self.overriden_class) != bool(self.script):
			frappe.throw('<em>Overriden Component</em> and <em>JS</em> should both be set or unset.')
