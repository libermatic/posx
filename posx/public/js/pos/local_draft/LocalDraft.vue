<template>
  <div class="btn-group">
    <button class="btn btn-xs" @click="onSave">Save for Later</button>
    <button class="btn btn-xs btn-info" @click="onList">List Saved</button>
    <button class="btn btn-xs" @click="onPrev">Load Last</button>
  </div>
</template>

<script>
export default {
  props: {
    onSave: Function,
    onList: Function,
    onPrev: Function,
  },
};
</script>

<style></style>
