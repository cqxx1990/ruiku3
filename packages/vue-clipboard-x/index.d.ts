declare module 'vue-clipboard2' {
  import Vue, { WatchOptions } from 'vue'
  module "vue/types/vue" {
    interface Vue {
      $clipboardConfig: {
        autoSetContainer: boolean,
        appendToBody: boolean
      }
      $copyText(text: string, container?: object | HTMLElement | null): Promise<{
        action: string,
        text: string,
        trigger: String | HTMLElement | HTMLCollection | NodeList,
        clearSelection: () => void
      }>
    }
  }

  class VueClipboard {
    static install: any
    static config: {
      autoSetContainer: boolean
      appendToBody: boolean
    }
  }
  export default VueClipboard
}
