<template>
  <div class="list-item">
    <div class="list-item__content text-muted">{{ label }}</div>
    <div
      class="list-item__content list-item__content--flex-2"
      :class="class_name"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    label: String,
    class_name: String,
    value: String,
  },
};
</script>

<style>
.list-item__content--flex-2 {
  flex: 0 1 96px;
  justify-content: flex-end;
}
</style>
