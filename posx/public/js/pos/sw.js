import makeExtension from '../utils/make-extension';
import {
  pull_entities,
  clear_entities,
  pull_stock_qtys,
  update_qtys,
} from '../store';
import { uuid4 } from '../utils';

export default function sw(Pos) {
  return makeExtension(
    'sw',
    class PosWithSW extends Pos {
      async make() {
        const result = await super.make();
        this._setup_datastore();
        this._setup_indicator();
        return result;
      }
      async on_change_pos_profile() {
        const result = await super.on_change_pos_profile();
        this._setup_datastore();
        return result;
      }
      submit_sales_invoice() {
        if (this.frm.config.px_use_local_datastore) {
          update_qtys(this.frm.doc);
          this.frm.doc.offline_pos_name = uuid4();
        }
        super.submit_sales_invoice();
      }
      async set_online_status() {}

      async _setup_datastore() {
        const { px_use_local_datastore, warehouse } = this.frm.config;
        if (px_use_local_datastore) {
          this._sync_datastore({ warehouse });
        }
        handle_sw(Boolean(px_use_local_datastore), {
          onUpdate: (registration) =>
            frappe.confirm(
              'Application has updated in the background. Do you want to reload?',
              () => {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload(true);
              }
            ),
          onUnregister: clear_entities,
        });
      }
      _sync_datastore({ warehouse }) {
        const poll_duration = 1000 * 60 * 30;
        if (this.frm.config.px_use_local_datastore && warehouse) {
          const [route] = frappe.get_route();
          if (route === 'point-of-sale') {
            if (!this._data_loaded) {
              frappe.dom.freeze('<h1 style="color: red;">Updating store</h1>');
            }
            pull_entities()
              .then(pull_stock_qtys({ warehouse }))
              .finally(() => {
                setTimeout(
                  () => this._sync_datastore({ warehouse }),
                  poll_duration
                );
                this._data_loaded = true;
                frappe.dom.unfreeze();
              });
          } else {
            setTimeout(
              () => this._sync_datastore({ warehouse }),
              poll_duration
            );
          }
        }
      }
      _setup_indicator() {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'SYNC_STATUS') {
              const { last_sync = null, unsynced_count = 0 } =
                event.data.data || {};
              const saved_msg = last_sync
                ? `Last saved on ${moment(last_sync).format(
                    'ddd, MMM D, hh:mm:ss a'
                  )}`
                : 'Never saved';

              if (unsynced_count) {
                this.page.set_indicator(
                  `${saved_msg}. <span style="font-weight:normal">${unsynced_count} invoice(s) remaining.</span>`,
                  'orange'
                );
              } else {
                this.page.set_indicator(
                  `<span style="font-weight:normal">${saved_msg}</span>`,
                  'lightblue'
                );
              }
            }
          });

          // get init state
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'GET_SYNC_STATUS',
            });
          }
        }
      }
    }
  );
}

async function handle_sw(shouldInstall, { onUpdate, onUnregister }) {
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
          registration.unregister().then(onUnregister);
        })
        .catch((error) => {
          console.error(error.message);
        });
    }
  }
}
