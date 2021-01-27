<template>
  <div class="customer-field" ref="field" />
</template>

<script>
import store from './store';

export default {
  data: function () {
    return {
      doc: store.doc,
    };
  },
  computed: {
    customer: function () {
      return this.doc.customer;
    },
  },
  mounted() {
    const field = frappe.ui.form.make_control({
      df: {
        fieldtype: 'Link',
        label: 'Customer',
        fieldname: 'customer',
        options: 'Customer',
        reqd: 1,
        get_query: function () {
          return {
            query: 'erpnext.controllers.queries.customer_query',
          };
        },
        onchange: () => {
          const customer = field.get_value();
          frappe.db.get_value('Customer', customer, 'language', (r) => {
            const language = r ? r.language : 'en-US';
            store.updateCustomer({ customer, language });
          });
        },
      },
      parent: this.$refs.field,
      render_input: true,
    });

    field.set_value(this.customer);
    this.$watch('customer', (newValue, oldValue) => {
      if (oldValue !== newValue) {
        field.set_input(newValue);
      }
    });
  },
};
</script>

<style></style>
