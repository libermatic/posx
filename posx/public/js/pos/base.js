import makeExtension from '../utils/make-extension';

import { set_session_state, cache_settings } from '../store';

const FIELDS = [
  'warehouse',
  'px_theme',
  'px_enable_xz_report',
  'px_use_batch_price',
  'px_use_cart_ext',
  'px_can_edit_desc',
  'px_disabled_write_off',
  'px_use_local_draft',
  'px_use_local_datastore',
  'px_hide_numpads',
  'px_hide_modal',
];

export default function base(Pos) {
  return makeExtension(
    'base',
    class PosWithBase extends Pos {
      async make() {
        const result = await super.make();
        await this._setup_base();
        return result;
      }
      async on_change_pos_profile() {
        const result = await super.on_change_pos_profile();
        await this._setup_base();
        return result;
      }
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        if (!this.frm.config) {
          await this._setup_base();
        }
        return result;
      }

      make_cart() {
        super.make_cart();
        $(`<div class="px-actions" style="margin-bottom: 1em;" />`).insertAfter(
          this.wrapper.find('.cart-wrapper')
        );
        this.$px_actions = this.wrapper.find('.px-actions');
      }

      async _setup_base() {
        this.frm.config = await get_config(this.frm.doc.pos_profile);
        const {
          px_use_local_draft,
          px_use_local_datastore,
          warehouse,
        } = this.frm.config;
        const { pos_profile } = this.frm.doc;
        if (px_use_local_draft || px_use_local_datastore) {
          set_session_state({
            user: frappe.session.user,
            pos_profile,
            warehouse,
          });
          cache_settings();
        }
      }
    }
  );
}

async function get_config(pos_profile) {
  const { message: config = {} } = await frappe.db.get_value(
    'POS Profile',
    pos_profile,
    FIELDS
  );

  return { ...config, pos_profile };
}
