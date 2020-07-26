<template>
  <table class="table">
    <tbody>
      <tr v-for="invoice in invoices" :key="invoice.offline_pos_name">
        <td>
          <a class="no-decoration text-muted" @click="onSelect(invoice.offline_pos_name)">
            <div class="table-line table-line-title">
              <div>{{ invoice.customer_name }}</div>
              <div>{{ invoice.customer }}</div>
            </div>
            <div class="table-line">
              <div>{{ invoice.offline_pos_name }}</div>
            </div>
            <div class="table-line table-line-subtitle">
              <div>{{ formatDate(invoice.posting_date, invoice.posting_time) }}</div>
              <div>{{ formatQty(invoice.pos_total_qty) }}</div>
              <div class="bold">{{ formatCurrency(invoice.rounded_total, invoice.currency) }}</div>
            </div>
          </a>
        </td>
        <td class="text-right">
          <a class="no-decoration text-muted" @click="removeInvoice(invoice.offline_pos_name)">
            <i class="fa fa-lg fa-trash-o" />
          </a>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import db from '../../store/db';

export default {
  props: ['onSelect'],
  data: function() {
    return { invoices: [] };
  },
  methods: {
    getInvoices: async function() {
      this.invoices = await db.draft_invoices.toArray();
    },
    removeInvoice: async function(ofn) {
      await db.draft_invoices.delete(ofn);
      this.getInvoices();
    },
    formatDate: function(date, time) {
      return new Date(`${date} ${time}`).toLocaleString();
    },
    formatQty: function(qty) {
      return `${qty} nos`;
    },
    formatCurrency: function(amount, currency) {
      const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      });
      return `${formatter.format(amount)}`;
    },
  },
  mounted() {
    this.getInvoices();
  },
};
</script>

<style lang="scss" scoped>
.table td {
  vertical-align: middle;
}
.table-line {
  font-size: 0.9em;
  line-height: 1.5;
  & > * {
    display: inline;
    &:not(:last-child)::after {
      content: ' · ';
    }
  }
}
.table-line-title {
  color: #121212;
  font-size: 1em;
}
.table-line-subtitle {
  color: #121212;
  font-size: 1em;
  font-weight: 300;
}
</style>