export default {
  title:"VueClipboard",
  component:document.body
}

export const ClipBoard = (...args)=>{
  return {
    template:`<div
    v-clipboard:copy="text"
    v-clipboard:success="onCopySuccess"
    v-clipboard:error="onCopyError">拷贝</div>`,
    data(){
      return {
        text:"拷贝的文字"
      }
    },
    methods:{
      onCopySuccess(){
        alert("拷贝成功")
      },
      onCopyError(){
        alert("拷贝失败")
      }
    }
  }
}