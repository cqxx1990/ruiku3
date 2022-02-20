export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}
// .storybook/preview.js

import { app } from '@storybook/vue3';
import VueClipboard from '../packages/vue-clipboard-x/index'

app.use(VueClipboard);

export const decorators = [
  (story) => ({
    components: { story },
    template: '<div style="margin: 3em;"><story /></div>',
  }),
];