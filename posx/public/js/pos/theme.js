import makeExtension from '../utils/make-extension';

export default function theme(Pos) {
  return makeExtension(
    'theme',
    class PosWithTheme extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        await load_theme(this.frm.config.px_theme);
        return result;
      }
    }
  );
}

async function load_theme(theme) {
  if (!theme) {
    return;
  }
  const {
    message: { theme_url },
  } = await frappe.db.get_value('Website Theme', theme, 'theme_url');
  if (theme_url) {
    frappe.require([theme_url]);
  }
}
