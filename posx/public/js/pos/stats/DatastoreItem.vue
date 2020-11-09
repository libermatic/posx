<template>
  <tr>
    <td>{{ doctype }}</td>
    <td class="text-right">{{ count }}</td>
    <td class="text-right date">{{ last_updated }}</td>
  </tr>
</template>

<script>
import db from '../../store/db';

export default {
  props: ['doctype'],
  data() {
    return { count: '-', last_updated: '-' };
  },
  mounted() {
    db.table(this.doctype)
      .count()
      .then(x => {
        this.count = x;
      });
    db.sync_state.get(this.doctype).then(x => {
      if (x) {
        const date = new Date(x.last_updated);
        this.last_updated = date.toLocaleString();
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