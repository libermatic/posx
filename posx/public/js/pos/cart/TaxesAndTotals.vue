<template>
  <fragment>
    <div class="taxes-and-totals" v-show="showTaxes">
      <cart-total-item label="Net Total" class_name="net-total">{{
        formatCurrency(doc.net_total)
      }}</cart-total-item>
      <cart-total-item label="Taxes" class_name="taxes">
        <div v-for="tax in doc.taxes" :key="tax.name">
          <span>{{ tax.description }}</span>
          <span class="text-right bold">
            {{ formatCurrency(tax.tax_amount) }}
          </span>
        </div>
      </cart-total-item>
    </div>
    <div class="discount-amount" v-show="showDiscount && showTaxes">
      <cart-total-item label="Discount" class_name="discount-inputs">
        <div>
          <input
            type="text"
            class="form-control additional_discount_percentage text-right"
            placeholder="0.00"
            :value="formatted_discount_percentage"
            @change="onDiscountPercentageChange"
          />
          <span class="adornment">%</span>
        </div>
        <div>
          <input
            type="text"
            class="form-control discount_amount text-right"
            placeholder="0.00"
            :value="formatted_discount_amount"
            @change="onDiscountAmountChange"
          />
          <span class="adornment">{{ currency_symbol }}</span>
        </div>
      </cart-total-item>
    </div>
    <div class="grand-total" @click="toggleTaxes">
      <cart-total-item label="Grand Total" class_name="grand-total-value">{{
        doc.grand_total
      }}</cart-total-item>
      <cart-total-item
        label="Rounded Total"
        class_name="rounded-total-value"
        v-show="showRounded"
        >{{ formatCurrency(doc.rounded_total) }}</cart-total-item
      >
    </div>
    <div class="quantity-total">
      <cart-total-item label="Total Qty" class_name="quantity-total">{{
        totalItemQty
      }}</cart-total-item>
    </div>
  </fragment>
</template>

<script>
import { Fragment } from 'vue-fragment';
import * as R from 'ramda';

import CartTotalItem from './CartTotalItem.vue';
import store from './store';

export default {
  components: { Fragment, CartTotalItem },
  data: function () {
    return {
      doc: store.doc,

      showTaxes: false,
      showDiscount: !!store.frm.allow_edit_discount,
      showRounded: !cint(frappe.sys_defaults.disable_rounded_total),
    };
  },
  computed: {
    totalItemQty: function () {
      return R.sum(R.map(R.prop('qty'), this.doc.items));
    },
    formatted_discount_percentage: function () {
      return (
        this.doc.additional_discount_percentage &&
        flt(
          this.doc.additional_discount_percentage,
          precision('additional_discount_percentage')
        )
      );
    },
    formatted_discount_amount: function () {
      return (
        this.doc.discount_amount &&
        flt(this.doc.discount_amount, precision('discount_amount'))
      );
    },
    currency_symbol: function () {
      return get_currency_symbol(this.doc.currency);
    },
  },
  methods: {
    toggleTaxes: function () {
      this.showTaxes = !this.showTaxes;
    },
    formatCurrency: function (value) {
      return format_currency(value, this.doc.currency);
    },
    onDiscountPercentageChange: function (e) {
      const additional_discount_percentage = Number(e.target.value);
      return store.updateDiscount({ additional_discount_percentage });
    },
    onDiscountAmountChange: function (e) {
      const discount_amount = Number(e.target.value);
      return store.updateDiscount({ discount_amount });
    },
  },
};
</script>

<style lang="scss" scoped>
.discount-inputs {
  & > div {
    position: relative;
    & > .adornment {
      position: absolute;
      left: 0;
      bottom: 10px;
      padding: 5px;
      filter: opacity(0.5);
    }
  }
}
</style>
