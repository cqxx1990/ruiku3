import PullTo from '..'

export default {
  title:"vue-next-pull",
  component:PullTo
}

export const NextPull = (args)=>{
  return {
    components:{PullTo},
    template:`<pull-to
    :top-load-method="refresh"
    :bottom-load-method="pullmore"
    >
      <div style="
        background:#000;
        color:#fff;
        margin-bottom:10px;
        display:flex;
        align-items:center
        " v-for="(v,i) in list" :key="i">{{v}}</div>
    </pull-to>`,
    data(){
      return {
        list:Math.random().toString().split("")
      }
    },
    methods:{
      refresh(loaded){
        setTimeout(loaded, 2000);
      },
      pullmore(loaded){
        setTimeout(loaded, 2000);
      }
    }
  }
}