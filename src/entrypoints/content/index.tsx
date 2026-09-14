import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import ReactDOM from 'react-dom/client';
import { Drawer } from './Drawer';
import { isExtensionValid } from '../../utils/storage';
import './styles.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'quickfiller-drawer',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<Drawer />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();

    // Proactive liveness monitor to instantly teardown and remove UI when extension context is invalidated
    const livenessCheck = setInterval(() => {
      if (ctx.isInvalid || !isExtensionValid()) {
        clearInterval(livenessCheck);
        try {
          ui.remove();
        } catch {}
      }
    }, 1500);

    ctx.onInvalidated(() => {
      clearInterval(livenessCheck);
      try {
        ui.remove();
      } catch {}
    });
  },
});
