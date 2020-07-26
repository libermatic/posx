import makeExtension from '../utils/make-extension';

const FIELDS = [
  'warehouse',
  'px_theme',
  'px_enable_xz_report',
  'px_use_batch_price',
  'px_can_edit_desc',
  'px_disabled_write_off',
  'px_hide_numpads',
];

export default function base(Pos) {
  return makeExtension(
    'base',
    class PosWithBase extends Pos {
      async make() {
        const result = await super.make();
        this.frm.config = await get_config(this.frm.doc.pos_profile);
        return result;
      }
      async on_change_pos_profile() {
        const result = await super.on_change_pos_profile();
        this.frm.config = await get_config(this.frm.doc.pos_profile);
        return result;
      }
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        if (!this.frm.config) {
          this.frm.config = await get_config(this.frm.doc.pos_profile);
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
