<template>
  <div
    class="list-item indicator"
    :class="[indicator_class, { 'current-item': isActive }]"
    :title="title"
    @click="onSelect(item.name)"
  >
    <div class="list-item-content">
      <div class="item-name list-item-title">
        <div>{{ item.item_name }}</div>
        <div v-if="item.pricing_rules.length > 0" class="chips">
          <span
            v-for="pricing_rule in item.pricing_rules"
            :key="pricing_rule"
            >{{ pricing_rule }}</span
          >
        </div>
      </div>

      <div class="list-item-subtitle">
        <div>
          @ {{ rate }}
          <span v-if="item.rate !== item.price_list_rate">
            <s>{{ price_list_rate }}</s> (less {{ item.discount_percentage }}%)
          </span>
        </div>
        <div>Σ {{ amount }}</div>
      </div>
    </div>
    <div class="quantity">
      <div>{{ item.qty }}</div>
      <div>{{ item.uom }}</div>
    </div>
  </div>
</template>

<script>
import store from './store';

export default {
  props: {
    item: {
      name: String,
      item_name: String,
      qty: Number,
      uom: String,
      actual_qty: Number,
      stock_uom: String,
      price_list_rate: Number,
      rate: Number,
      amount: Number,
      pricing_rules: Array,
    },
    currency: String,
    isActive: Boolean,
    onSelect: Function,
  },
  computed: {
    indicator_class: function () {
      const is_stock_item = true;
      return !is_stock_item || this.item.actual_qty >= this.item.qty
        ? 'green'
        : 'red';
    },
    title: function () {
      return `Item: ${this.item.item_name}  Available Qty: ${this.item.actual_qty} ${this.item.stock_uom}`;
    },
    price_list_rate: function () {
      return format_currency(this.item.price_list_rate, this.currency);
    },
    rate: function () {
      return format_currency(this.item.rate, this.currency);
    },
    amount: function () {
      return format_currency(this.item.amount, this.currency);
    },
  },
};
</script>

<style lang="scss" scoped>
.list-item {
  align-items: flex-start;
  padding: 0.2em 1em;
  &::before {
    margin-top: 6px;
  }
}
.list-item-content {
  width: 100%;
  .chips {
    padding: 4px 0;
    & > * {
      background-color: var(--dt-border-color);
      font-weight: normal;
      font-size: 0.9em;
      margin-left: 4px;
      padding: 4px 8px;
      border-radius: 2em;
    }
  }
}
.list-item-title {
  padding: 0 0.2em;
  & > * {
    display: inline-block;
  }
}
.list-item-subtitle {
  padding: 0 0.2em;
  font-weight: normal;
  display: flex;
  & > * {
    padding-right: 1em;
  }
}
.quantity {
  font-weight: normal;
  text-align: center;
  & > *:first-child {
    white-space: nowrap;
    font-weight: bold;
    font-size: 1.2em;
  }
  & > *:last-child {
    white-space: nowrap;
    font-size: 0.9em;
  }
}
</style>
