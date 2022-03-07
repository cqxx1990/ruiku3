# 文件同步工具
因为现在webpack打包的东西基本上都是生成了新的文件，而同步到服务器要么用svn，要么用什么git工具，感觉不是特别方便，所以做了这个，其原理就是对比了服务端的文件夹信息版本和本地的是否一致，如果不一致就删除服务端的，上传本地的

# 安装
```
npm install @ruiku/pkg-sync -D
```

# 使用
+ 服务端
```
npx @ruiku/pkg-sync server
```
命令会启动服务端监听，端口为23456

+ 客户端
配置上传信息
```json
// package.json
"pkg-sync":{
    "filter":[],  //过滤规则，以什么结尾，非正则
    "ignores":[], //忽略规则，以什么结尾，非正则
    "srcpath":"dist\\plat_1\\ver_game\\",//可以是相对地址，和绝对地址
    "destpath":"D:\\websoft9\\www\\webclient-test\\",
    "host":"192.168.50.64"
  }
```
```shell
npx @ruiku/pkg-sync client
```

