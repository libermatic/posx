<template>
  <div class="root">
    <div class="actions">actions</div>
    <div class="content">
      <h1>{{ item.item_name }}</h1>
      <p>
        <span class="faded">{{ item.item_code }}</span> ·
        {{ item.item_group }}
      </p>
      <div>
        <span
          class="chip"
          v-for="pricing_rule in pricing_rules"
          :key="pricing_rule"
          >{{ pricing_rule }}</span
        >
      </div>
      <batch-selector v-if="item.has_batch_no" :item="item" />
    </div>
  </div>
</template>

<script>
import * as R from 'ramda';

import store from './store';
import BatchSelector from './BatchSelector.vue';

export default {
  components: { BatchSelector },
  data: function () {
    return {
      doc: store.doc,
      state: store.state,
    };
  },
  computed: {
    item: function () {
      return this.doc.items.find((x) => x.name === this.state.selected) || {};
    },
    pricing_rules: function () {
      if (!this.item) {
        return [];
      }
      return Array.from(
        new Set(
          this.doc.items
            .filter((x) => x.item_code === this.item.item_code)
            .map(R.prop('pricing_rules'))
            .map((x) => (x ? JSON.parse(x) : []))
            .flat()
        )
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.root {
  flex: 0 1 546px;
  display: flex;
  flex-flow: column nowrap;
  margin-left: 30px;
  .actions {
    min-height: 70px;
  }
  .content {
    border: 1px solid var(--dt-border-color);
    border-radius: var(--dt-border-radius);
    flex: 1 1 auto;
    margin-bottom: 42px;
    & > * {
      padding-left: 14px;
      padding-right: 14px;
    }
    .faded {
      color: #888;
    }
    .smaller {
      font-size: 0.9em;
    }
    .chip {
      background-color: var(--dt-border-color);
      padding: 4px 12px;
      border-radius: 12px;
      margin: 0 4px;
    }
  }
}
</style>
