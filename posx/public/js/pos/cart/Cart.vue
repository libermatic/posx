<template>
  <div class="pos-cart-root">
    <div class="pos-cart">
      <customer-field />
      <div class="cart-wrapper">
        <div class="list-item-table">
          <div class="list-item list-item--head">
            <div
              class="list-item__content list-item__content--flex-1.5 text-muted"
            >
              Item Description
            </div>
            <div class="list-item__content text-muted text-right">Quantity</div>
          </div>
          <div class="cart-items" v-if="isEmpty">
            <div class="empty-state">
              <span>No Items added to cart</span>
            </div>
          </div>
          <div class="cart-items" v-else>
            <cart-item
              v-for="item in items"
              :key="item.name"
              :currency="doc.currency"
              :item="item"
              :onSelect="handleSelect"
            />
          </div>
        </div>
      </div>
      <div class="free-items" v-if="freeItems.length > 0">
        <div class="list-item-table">
          <div class="list-item list-item--head">
            <div
              class="list-item__content list-item__content--flex-1.5 text-muted"
            >
              Free Items
            </div>
          </div>
          <div>
            <cart-free-item
              v-for="item in freeItems"
              :key="item.name"
              :currency="doc.currency"
              :item="item"
              :onSelect="handleSelect"
            />
          </div>
        </div>
      </div>
      <div class="totals list-item-table">
        <taxes-and-totals />
      </div>
      <div class="row">
        <div class="col-sm-12 text-right">
          <button class="btn btn-primary" @click="onPay">Pay</button>
        </div>
      </div>
    </div>
    <detail v-if="!!state.selected" :onClose="onDeselect" />
  </div>
</template>

<script>
import * as R from 'ramda';

import CustomerField from './CustomerField.vue';
import CartItem from './CartItem.vue';
import CartFreeItem from './CartFreeItem.vue';
import CartTotalItem from './CartTotalItem.vue';
import TaxesAndTotals from './TaxesAndTotals.vue';
import Detail from './Detail.vue';
import store from './store';

const getItems = R.compose(
  R.values,
  R.reduceBy(
    (a, x) =>
      R.mergeWithKey(
        (k, l, r) => {
          console.log(k, l, r);
          if (['amount', 'qty'].includes(k)) {
            return l + r;
          }
          if (k === 'pricing_rules') {
            return R.uniq(R.concat(l, r));
          }
          return r;
        },
        a,
        x
      ),
    {},
    (x) => `${x.item_code}__${x.rate}`
  ),
  R.map((x) =>
    R.mergeRight(x, {
      pricing_rules:
        x.pricing_rules && typeof x.pricing_rules === 'string'
          ? JSON.parse(x.pricing_rules)
          : [],
    })
  ),
  R.filter((x) => !x.is_free_item)
);

export default {
  components: {
    CustomerField,
    CartItem,
    CartFreeItem,
    CartTotalItem,
    TaxesAndTotals,
    Detail,
  },
  props: {
    onPay: Function,
    toggleItems: Function,
  },
  data: function () {
    return {
      doc: store.doc,
      state: store.state,
    };
  },
  computed: {
    isEmpty: function () {
      return this.doc.items.length === 0;
    },
    items: function () {
      return getItems(this.doc.items);
    },
    freeItems: function () {
      return this.doc.items.filter((x) => x.is_free_item);
    },
  },
  mounted() {},
  methods: {
    handleSelect: function (name) {
      const value = this.state.selected === name ? null : name;
      store.setSelected(value);
      this.toggleItems(!value);
    },
    onDeselect: function () {
      store.setSelected(null);
      this.toggleItems(true);
    },
  },
};
</script>

<style lang="scss" scoped>
.pos-cart-root {
  display: flex;
  flex-flow: row nowrap;
  flex: 1 1 auto;
  height: 100%;
  .pos-cart {
    flex: 1 1 auto;
  }
  .free-items {
    margin-bottom: 12px;
  }
  .totals {
    border-top: none;
    margin-bottom: 1em;
  }
}
</style>
