<template>
  <tr>
    <td>{{ doctype }}</td>
    <td class="text-right">{{ count }}</td>
    <td class="text-right date">{{ lastUpdated }}</td>
  </tr>
</template>

<script>
import db from '../../store/db';

export default {
  props: ['doctype'],
  data() {
    return { count: '-', lastUpdated: '-' };
  },
  mounted() {
    db.table(this.doctype)
      .count()
      .then(x => {
        this.count = x;
      });
    db.sync_state.get(this.doctype).then(x => {
      if (x) {
        const date = new Date(x.lastUpdated);
        this.lastUpdated = date.toLocaleString();
      }
    });
  },
};
</script>

<style lang="scss" scoped>
.date {
  font-weight: 300;
}
</style>