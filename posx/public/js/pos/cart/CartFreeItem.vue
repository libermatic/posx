<template>
  <div
    class="list-item indicator"
    :class="[indicator_class, { 'current-item': isActive }]"
    :title="title"
  >
    <div class="list-item-content">
      <div class="item-name list-item-title">{{ item.item_name }}</div>
      <div class="list-item-subtitle">
        <span>@ {{ rate }}</span>
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
  cursor: initial;
  &::before {
    margin-top: 6px;
  }
}
.list-item-content {
  width: 100%;
}
.list-item-title {
  padding: 0 0.2em;
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
