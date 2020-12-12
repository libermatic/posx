<template>
  <div class="batch-selector" v-if="item.has_batch_no">
    <div>
      <p>Selected Batches</p>
      <ul>
        <li class="list-item" v-for="batch in batches" :key="batch.batch_no">
          <div>
            <div class="list-item-title">
              {{ batch.batch_no }}
            </div>
            <div class="list-item-subtitle">
              {{ batch.price_list_rate }} · exp:
              {{ batch.expiry_date }}
            </div>
          </div>
          <div class="input-group input-group-xs">
            <span class="input-group-btn">
              <button
                class="btn btn-default"
                @click="onUpdate(batch, batch.qty + 1)"
              >
                +
              </button>
            </span>
            <input
              class="form-control"
              type="number"
              :value="batch.qty"
              @change="(e) => onUpdate(batch, Number(e.target.value))"
            />
            <span class="input-group-btn">
              <button
                class="btn btn-default"
                @click="onUpdate(batch, batch.qty - 1)"
              >
                -
              </button>
            </span>
          </div>
        </li>
      </ul>
    </div>
    <div>
      <p>Available Batches</p>
      <ul>
        <li
          class="list-item"
          v-for="batch in allBatches"
          :key="batch.batch_no"
          @click="addToCart(batch)"
        >
          <div>
            <div class="list-item-title">{{ batch.batch_no }}</div>
            <div class="list-item-subtitle faded smaller">
              {{ batch.price_list_rate }} · {{ batch.actual_batch_qty }}
              {{ batch.uom }} · exp: {{ batch.expiry_date }}
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import * as R from 'ramda';

import store from './store';

export default {
  props: {
    item: Object,
  },
  data: function () {
    return {
      doc: store.doc,
      state: store.state,
      batches: [],
      allBatches: [],
    };
  },
  watch: {
    item: function () {
      this.setAllBatches();
      this.setSelectedBatches();
    },
  },
  methods: {
    setSelectedBatches: async function () {
      if (!this.item || !this.item.has_batch_no) {
        this.batches = [];
        return;
      }

      const rows = this.doc.items.filter(
        (x) => x.item_code === this.item.item_code
      );

      this.batches = await Promise.all(
        rows.map(
          async function (row) {
            const { message: { expiry_date } = {} } =
              row.batch_no &&
              (await frappe.db.get_value('Batch', row.batch_no, 'expiry_date'));
            return {
              name: row.name,
              batch_no: row.batch_no,
              price_list_rate: format_currency(
                row.price_list_rate,
                this.doc.currency
              ),
              qty: row.qty,
              actual_batch_qty: row.actual_batch_qty,
              expiry_date: expiry_date
                ? frappe.datetime.str_to_user(expiry_date)
                : 'N/A',
            };
          }.bind(this)
        )
      );
    },
    setAllBatches: async function () {
      if (!this.item || !this.item.has_batch_no) {
        this.allBatches = [];
        return;
      }

      const { item_code, warehouse } = this.item;
      const { results = [] } = await frappe.call({
        method: 'frappe.desk.search.search_link',
        args: {
          txt: '',
          doctype: 'Batch',
          reference_doctype: '',
          filters: JSON.stringify({ item_code, warehouse }),
          query: 'posx.api.queries.get_batch_no',
        },
      });

      this.allBatches = results.map(({ value: batch_no, description }) => {
        if (warehouse) {
          const [_qty, uom, _mfg, _exp = '', _price = ''] = description.split(
            ', '
          );
          const price_list_rate = _price.replace('PRICE-', '');
          const actual_batch_qty = Number(_qty);
          const expiry_date = _exp.replace('EXP-', '');
          return {
            batch_no,
            price_list_rate: price_list_rate
              ? format_currency(price_list_rate, this.doc.currency)
              : 'N/A',
            actual_batch_qty,
            uom,
            expiry_date: expiry_date
              ? frappe.datetime.str_to_user(expiry_date)
              : 'N/A',
          };
        }
        const [_mfg, _exp = '', _price = ''] = description.split(', ');
        const price_list_rate = _price.replace('PRICE-', '');
        const expiry_date = _exp.replace('EXP-', '');
        return {
          batch_no,
          price_list_rate: price_list_rate
            ? format_currency(price_list_rate, this.doc.currency)
            : 'N/A',
          actual_batch_qty: 'N/A',
          uom: '',
          expiry_date: expiry_date
            ? frappe.datetime.str_to_user(expiry_date)
            : 'N/A',
        };
      });
    },
    onUpdate: async function ({ name, actual_batch_qty }, _qty) {
      if (_qty > actual_batch_qty) {
        frappe.msgprint(`Qty for this batch cannot exceed ${actual_batch_qty}`);
      }

      const qty = Math.min(_qty, actual_batch_qty);
      await store.updateQty({ name, qty });
      const row = this.batches.find((x) => x.name === name);
      row.qty = qty;
    },
    addToCart: async function (batch) {
      const existing = this.batches.find((x) => x.batch_no === batch.batch_no);
      if (existing) {
        return this.onUpdate(existing, existing.qty + 1);
      }

      const row = await store.addItem({
        item_code: this.item.item_code,
        batch_no: batch.batch_no,
      });
      store.updateActualBatchQty(row, batch.actual_batch_qty);
      this.batches.push({
        name: row.name,
        batch_no: row.batch_no,
        price_list_rate: format_currency(
          row.price_list_rate,
          this.doc.currency
        ),
        qty: row.qty,
        actual_batch_qty: row.actual_batch_qty,
        expiry_date: batch.expiry_date,
      });
    },
  },
  mounted() {
    this.setSelectedBatches();
    this.setAllBatches();
  },
};
</script>

<style lang="scss" scoped>
.batch-selector {
  ul {
    list-style: none;
    padding-inline-start: 0;
  }
  li {
    display: flex;
    flex-flow: row nowrap;
    & > *:first-child {
      flex: 1 1 auto;
    }
    .input-group > input {
      max-width: 4em;
      text-align: right;
    }
  }
  .list-item-subtitle {
    color: #888;
    font-size: 0.9em;
  }
  .list-item-crit {
    padding: 0 0.5em;
    margin-left: 0.5em;
    background-color: rgba($color: #000000, $alpha: 0.1);
    display: flex;
    align-items: center;
  }
}
</style>
