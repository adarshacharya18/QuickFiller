import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const remToPx = () => ({
  postcssPlugin: 'postcss-rem-to-px',
  Declaration(decl) {
    if (decl.value && decl.value.includes('rem')) {
      decl.value = decl.value.replace(/([0-9]*\.?[0-9]+)\s*rem\b/g, (_, val) => {
        const px = parseFloat(val) * 16;
        return `${Math.round(px * 100) / 100}px`;
      });
    }
  },
});
remToPx.postcss = true;

export default {
  plugins: [
    tailwindcss(),
    remToPx(),
    autoprefixer(),
  ],
};
