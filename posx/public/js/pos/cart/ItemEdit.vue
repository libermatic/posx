<template>
  <div class="item-edit">
    <div class="item-edit-quantity">
      <div class="input-group input-group-xs">
        <span class="input-group-btn">
          <button class="btn btn-default" @click="onUpdate(item, item.qty + 1)">
            +
          </button>
        </span>
        <input
          class="form-control"
          type="number"
          :value="item.qty"
          @change="(e) => onUpdate(item, Number(e.target.value))"
        />
        <span class="input-group-btn">
          <button class="btn btn-default" @click="onUpdate(item, item.qty - 1)">
            -
          </button>
        </span>
      </div>
      <div>{{ item.uom }}</div>
    </div>
    <div class="item-edit-rate">
      <div class="control-label">Rate</div>
      <div class="value">
        @ {{ rate }}
        <span class="faded" v-if="item.rate !== item.price_list_rate">
          <s>{{ price_list_rate }}</s> (less {{ item.discount_percentage }}%)
        </span>
      </div>
    </div>
    <div class="item-edit-amount">
      <div class="control-label">Amount</div>
      <div class="value">
        {{ amount }}
      </div>
    </div>
  </div>
</template>

<script>
import store from './store';
export default {
  props: {
    item: Object,
  },
  computed: {
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
  methods: {
    onUpdate: async function ({ name, actual_qty }, _qty) {
      if (_qty > actual_qty) {
        frappe.msgprint(`Qty for this item cannot exceed ${actual_qty}`);
      }

      const qty = Math.min(_qty, actual_qty);
      await store.updateQty({ name, qty });
    },
  },
};
</script>

<style lang="scss" scoped>
.item-edit {
  .item-edit-quantity {
    display: flex;
    align-items: center;
    & > * {
      margin-right: 1em;
    }
    .input-group > input {
      max-width: 4em;
      text-align: right;
    }
  }
  .control-label {
    margin-bottom: 0;
  }
  .faded {
    color: rgba($color: #000000, $alpha: 0.5);
  }
  .item-edit-rate {
    margin: 12px 0;
  }
  .item-edit-amount {
    margin: 12px 0;
    .value {
      font-weight: bold;
      font-size: 1.5em;
    }
  }
}
</style>
