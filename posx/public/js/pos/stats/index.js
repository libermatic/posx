import Vue from 'vue/dist/vue.js';

import Stats from './Stats.vue';
import makeExtension from '../../utils/make-extension';

function showStats() {
  const dialog = new frappe.ui.Dialog({
    title: 'Stats',
  });
  new Vue({
    el: dialog.body,
    render: (h) => h(Stats),
  });
  dialog.show();
  dialog.onhide = function () {
    this.$wrapper.remove();
  };
}

export default function stats(Pos) {
  return makeExtension(
    'stats',
    class PosWithStats extends Pos {
      prepare_menu() {
        super.prepare_menu();
        this.page.add_menu_item(__('Stats'), showStats);
      }
    }
  );
}
