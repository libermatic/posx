<template>
  <div class="root">
    <section>
      <h2>Storage</h2>
      <div class="title">
        <dl>
          <dt>Usage</dt>
          <dd class="highlight">{{ usage }}</dd>
          <dd>{{ quota }}</dd>
        </dl>
      </div>
      <div class="content">
        <dl v-for="feature in features" :key="feature.value">
          <dt>{{ feature.label }}</dt>
          <dd>{{ feature.value }}</dd>
        </dl>
      </div>
    </section>
    <section>
      <div class="datastore">
        <h2>Datastore</h2>
        <button type="button" class="btn btn-danger btn-xs" @click="clear">Clear</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Doctype</th>
            <th class="text-right">Count</th>
            <th class="text-right">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          <datastore-item v-for="doctype in entities" :key="doctype" :doctype="doctype" />
        </tbody>
      </table>
    </section>
  </div>
</template>

<script>
import db from '../../store/db';
import DatastoreItem from './DatastoreItem.vue';

const factor = 1024 * 1024;
function convert(value) {
  const converted = value / factor;
  return `${converted.toFixed(2)} MB`;
}
export default {
  components: { DatastoreItem },
  data: function() {
    return {
      usage: '0',
      quota: '0',
      lastUpdated: { time: 'N/A', date: '' },
      features: [],
      entities: [],
    };
  },
  methods: {
    clear: async function() {
      await db.delete();
      this.getStorage();
      this.entities = [];
    },
    getStorage: async function() {
      const {
        usage,
        quota,
        usageDetails = [],
      } = await navigator.storage.estimate();
      this.usage = convert(usage);
      this.quota = convert(quota);
      this.features = [
        ...Object.keys(usageDetails).map(k => ({
          label: k,
          value: convert(usageDetails[k]),
        })),
      ];
    },
    getTables: function() {
      console.log(db.tables);

      this.entities = db.tables
        .filter(x => !x.schema.indexes.map(x => x.name).includes('parent'))
        .map(x => x.name);
    },
  },
  mounted: function() {
    this.getStorage();
    this.getTables();
  },
};
</script>

<style lang="scss" scoped>
.root {
  section {
    display: flex;
    flex-flow: row wrap;
    h2 {
      font-size: 1.2em;
      width: 100%;
    }
    dl {
      margin: 0;
    }
    dt {
      font-weight: 300;
    }
    .title {
      min-width: 10em;
      text-align: center;
      dd.highlight {
        font-size: 1.8em;
        padding-bottom: 0.1em;
        border-bottom: 1px solid #d1d8dd;
        margin-bottom: 0.1em;
      }
    }
    .content {
      dl {
        display: flex;
        dd {
          order: -1;
          width: 5em;
          text-align: right;
          margin: 0 1em;
          white-space: nowrap;
        }
      }
    }
  }
}
.datastore {
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  align-items: baseline;
}
</style>
