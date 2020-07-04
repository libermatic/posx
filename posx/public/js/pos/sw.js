import makeExtension from '../utils/make-extension';

export default function sw(Pos) {
  return makeExtension(
    'sw',
    class PosWithSW extends Pos {
      constructor(wrapper) {
        super(wrapper);
        handle_sw({
          onUpdate: (registration) =>
            frappe.confirm(
              'Application has updated in the background. Do you want to reload?',
              () => {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload(true);
              }
            ),
        });
      }
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        const {
          message: { px_use_local_datastore } = {},
        } = await frappe.db.get_value(
          'POS Profile',
          this.frm.doc.pos_profile,
          'px_use_local_datastore'
        );
        this._use_local_datastore = Boolean(px_use_local_datastore);
        return result;
      }
    }
  );
}

async function handle_sw({ onUpdate }) {
  const { message: settings = {} } = await frappe.db.get_value(
    'POS X Settings',
    null,
    'install_service_worker'
  );

  const install_service_worker = Boolean(
    parseInt(settings.install_service_worker)
  );
  if ('serviceWorker' in navigator) {
    if (install_service_worker) {
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
