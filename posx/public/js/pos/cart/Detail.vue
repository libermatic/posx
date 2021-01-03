<template>
  <fragment>
    <div class="root">
      <div class="actions">
        <button class="btn btn-default" @click="onClose">
          <i class="octicon octicon-x" />
        </button>
      </div>
      <div class="content">
        <h1>{{ item.item_name }}</h1>
        <p>
          <span class="faded">{{ item.item_code }}</span> ·
          {{ item.item_group }}
        </p>
        <dl>
          <dt>Description</dt>
          <dd>
            {{ description }}
            <button
              class="btn btn-xs"
              @click="onDescriptionEdit(item)"
              v-if="config.px_can_edit_desc"
            >
              <i class="octicon octicon-pencil" />
            </button>
          </dd>
        </dl>
        <div>
          <span
            class="chip"
            v-for="pricing_rule in pricing_rules"
            :key="pricing_rule"
            >{{ pricing_rule }}</span
          >
        </div>
        <batch-selector v-if="item.has_batch_no" :item="item" />
        <item-edit v-else :item="item" />
      </div>
    </div>
    <div class="back-drop" @click="onClose" />
  </fragment>
</template>

<script>
import { Fragment } from 'vue-fragment';
import * as R from 'ramda';

import store from './store';
import BatchSelector from './BatchSelector.vue';
import ItemEdit from './ItemEdit.vue';

export default {
  components: { Fragment, BatchSelector, ItemEdit },
  props: {
    onClose: Function,
    onDescriptionEdit: Function,
  },
  data: function () {
    return {
      doc: store.doc,
      state: store.state,
      config: store.config,
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
    description: function () {
      if (!this.item || !this.item.description) {
        return '';
      }
      return this.item.description.replace(/(<([^>]+)>)/gi, '');
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
  z-index: 1032;
  .actions {
    min-height: 70px;
    text-align: right;
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
    dt {
      font-size: 0.7em;
      font-weight: 300;
      text-transform: uppercase;
    }
  }
}
.back-drop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1031;
  cursor: not-allowed;
}
</style>
