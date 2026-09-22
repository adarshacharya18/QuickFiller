import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import ReactDOM from 'react-dom/client';
import { Drawer } from './Drawer';
import { isExtensionValid } from '../../utils/storage';
import { isSensitiveOrInternalUrl } from '../../utils/drawerUtils';
import './styles.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Skip mounting on sensitive authentication pages (e.g. accounts.google.com) or internal URLs
    if (typeof window !== 'undefined' && isSensitiveOrInternalUrl(window.location?.href)) {
      return;
    }

    // Singleton check: Ensure only one instance of quickfiller-drawer exists in the DOM
    if (typeof document !== 'undefined') {
      const existing = document.querySelector('quickfiller-drawer');
      if (existing) {
        if (typeof window !== 'undefined' && (window as any).__QUICKFILLER_AUTO_OPEN__) {
          window.dispatchEvent(new CustomEvent('quickfiller:open_drawer'));
        }
        return;
      }
    }
    if (typeof window !== 'undefined') {
      if ((window as any).__QUICKFILLER_MOUNTED__) {
        if ((window as any).__QUICKFILLER_AUTO_OPEN__) {
          window.dispatchEvent(new CustomEvent('quickfiller:open_drawer'));
        }
        return;
      }
      (window as any).__QUICKFILLER_MOUNTED__ = true;
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'quickfiller-drawer',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      isolateEvents: ['keydown', 'keyup', 'keypress', 'wheel'],
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<Drawer />);
        return root;
      },
      onRemove: (root) => {
        if (typeof window !== 'undefined') {
          delete (window as any).__QUICKFILLER_MOUNTED__;
        }
        root?.unmount();
      },
    });

    ui.mount();

    // Proactive liveness monitor to instantly teardown and remove UI when extension context is invalidated
    const livenessCheck = setInterval(() => {
      if (ctx.isInvalid || !isExtensionValid()) {
        clearInterval(livenessCheck);
        if (typeof window !== 'undefined') {
          delete (window as any).__QUICKFILLER_MOUNTED__;
        }
        try {
          ui.remove();
        } catch {}
      }
    }, 1500);

    ctx.onInvalidated(() => {
      clearInterval(livenessCheck);
      if (typeof window !== 'undefined') {
        delete (window as any).__QUICKFILLER_MOUNTED__;
      }
      try {
        ui.remove();
      } catch {}
    });
  },
});
