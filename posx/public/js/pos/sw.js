import makeExtension from '../utils/make-extension';
import { pull_entities, pull_stock_qtys } from '../store';

export default function sw(Pos) {
  return makeExtension(
    'sw',
    class PosWithSW extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        const {
          message: { px_use_local_datastore, warehouse } = {},
        } = await frappe.db.get_value('POS Profile', this.frm.doc.pos_profile, [
          'px_use_local_datastore',
          'warehouse',
        ]);
        this._use_local_datastore = Boolean(px_use_local_datastore);
        if (this._use_local_datastore) {
          pull_entities().then(pull_stock_qtys({ warehouse }));
        }
        handle_sw(this._use_local_datastore, {
          onUpdate: (registration) =>
            frappe.confirm(
              'Application has updated in the background. Do you want to reload?',
              () => {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload(true);
              }
            ),
        });
        return result;
      }
    }
  );
}

async function handle_sw(shouldInstall, { onUpdate }) {
  if ('serviceWorker' in navigator) {
    if (shouldInstall) {
      navigator.serviceWorker
        .register('/assets/posx/includes/service-worker.js', {
          scope: '/desk',
        })
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('Service worker has updated');
                  onUpdate && onUpdate(registration);
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('Service worker registration failed, error:', error);
        });
    } else {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.unregister();
        })
        .catch((error) => {
          console.error(error.message);
        });
    }
  }
}
