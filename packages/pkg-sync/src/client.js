const net = require("net");
const path = require("path");
const fs = require("fs");
const crypto = require('crypto');

let config = null;

function filterFile(locate) {
  let list = config.ignores;
  for (let i = 0, len = list.length; i < len; ++i) {
    let e = list[i];
    if (locate.substr(locate.length - e.length) == e)
      return true;
  }
  list = config.filter;
  if (list.length == 0) return false;
  for (let i = 0, len = list.length; i < len; ++i) {
    let e = list[i];
    if (locate.substr(locate.length - e.length) == e)
      return false;
  }
  return true;
}
function filterDir(locate) {
  let list = config.ignores;
  for (let i = 0, len = list.length; i < len; ++i) {
    let e = list[i];
    if (locate.substr(locate.length - e.length) == e)
      return true;
  }
  return false;
}
function loopFiles(dir, result) {
  let list = fs.readdirSync(dir);
  for (let i = 0, len = list.length; i < len; ++i) {
    let filename = list[i];
    let filepath = path.join(dir, filename);
    let stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      if (filterDir(filename)) continue;
      loopFiles(filepath, result);
    } else if (stats.isFile()) {
      if (filterFile(filename)) continue;
      result.push(filepath);
    }
  }
}
let CID = 0;
let CMD = {
  CS_REG_CONTROLLER: CID++,
  CS_REG_FILETRANSFER: CID++,
  CS_CHECK_VERSION: CID++,
  CS_CHECK_FILE_EXIST: CID++,
  CS_COMPLETE: CID++,
  CS_INIT_FILETRANSFER: CID++,

  SC_REG_CONTROLLER: CID++,
  SC_REG_FILETRANSFER: CID++,
  SC_CHECK_VERSION: CID++,
  SC_CHECK_FILE_EXIST: CID++,
  SC_COMPLETE: CID++,
  SC_INIT_FILETRANSFER: CID++,
  SC_FILETRANSFER_OVER: CID++,
}
class Component {
  constructor() {
    this.socket = net.connect({ host: config.host, port: 23456 }, function () {
      //console.log('连接到服务器！');  
    });
    this.socket.on("connect", this.onconnect.bind(this));
    this.socket.on("data", this.ondata.bind(this));
    this.socket.on("close", this.onclose.bind(this));
    this.socket.on("error", this.onerror.bind(this));
  }
  onconnect() {

  }
  ondata(data) {

  }
  onclose() {

  }
  onerror() {
    console.log("连接错误");
  }
  send(data) {
    this.socket.write(data);
  }
  close() {
    this.socket.end();
  }
}
class Controller extends Component {
  constructor(dir) {
    super();
    this.id = 0;
    this.maxThread = 5;
    this.transfors = {};
    this.count = 0;
    this.isComplete = false;
    this.basePath = dir;
    this.queue = [];
    this.index = this.last = 0;
    this.ver = "";
  }
  onconnect() {
    let req = { cmd: CMD.CS_REG_CONTROLLER };
    this.send(Buffer.from(JSON.stringify(req)));
  }
  ondata(data) {
    let pack = JSON.parse(data.toString());
    if (pack.err) {
      if (pack.over)
        this.close();
      return console.log(pack.err);
    }
    if (pack.cmd == CMD.SC_REG_CONTROLLER) {
      this.id = pack.id;
      this.checkversion();
    } else if (pack.cmd == CMD.SC_CHECK_VERSION) {
      loopFiles(this.basePath, this.queue);
      this.last = this.queue.length;
      console.log(this.queue);
      console.log("文件数量:" + (this.last));
      this.loop();
    } else if (pack.cmd == CMD.SC_CHECK_FILE_EXIST) {
      let tf = this.transfors[pack.data];
      tf.checkresult(pack.exist);
    } else if (pack.cmd == CMD.SC_COMPLETE) {
      this.close();
    }
  }
  onclose() {
    if (this.isComplete) return;
    //重连
  }
  checkversion() {
    let stat = fs.statSync(config.srcpath);
    delete stat.atimeMs;
    delete stat.atime;
    let ver = crypto.createHash('md5').update(JSON.stringify(stat)).digest("hex");
    let req = { cmd: CMD.CS_CHECK_VERSION, dir: config.destpath, ver };
    this.send(Buffer.from(JSON.stringify(req)));
    this.ver = ver;
  }
  checkfile(path, key) {
    path = path.substr(this.basePath.length);
    let req = { cmd: CMD.CS_CHECK_FILE_EXIST, path, data: key };
    this.send(Buffer.from(JSON.stringify(req)));
  }
  loop() {
    if (this.count < 1 && this.index >= this.last) {
      console.log("同步完成");
      this.complete();
      return;
    }
    if (this.count < this.maxThread) {
      let path = this.queue[this.index++];
      let tf = new FileTransfer(this, this.id, path, this.onceOver.bind(this));
      this.transfors[tf.key] = tf;
      ++this.count;
    }
  }
  onceOver(tf, success) {
    --this.count;
    tf.close();
    delete this.transfors[tf.key];
    if (!success) {
      this.queue.push(tf.path);
      this.last++;
    }
    this.loop();
  }
  complete() {
    this.isComplete = true;
    let req = { cmd: CMD.CS_COMPLETE, ver: this.ver };
    this.send(Buffer.from(JSON.stringify(req)));
  }
}
let g_transforid = 0;
class FileTransfer extends Component {
  constructor(owner, id, path, oncomplete) {
    super();
    this.owner = owner;
    this.path = path;
    this.id = id;
    this.key = ++g_transforid;
    this.steam = null;
    this.oncomplete = oncomplete;
  }
  onconnect() {
    let req = { cmd: CMD.CS_REG_FILETRANSFER, id: this.id };
    this.send(Buffer.from(JSON.stringify(req)));
  }
  ondata(data) {
    let pack = JSON.parse(data.toString());
    if (pack.err) {
      console.log(pack.err);
      return this.oncomplete(this, false);
    }
    if (pack.cmd == CMD.SC_REG_FILETRANSFER) {
      this.owner.checkfile(this.path, this.key);
    } else if (pack.cmd == CMD.SC_INIT_FILETRANSFER) {
      console.log("传输文件：" + this.path);
      this.steam = fs.createReadStream(this.path);
      this.steam.pipe(this.socket);
    } else if (pack.cmd == CMD.SC_FILETRANSFER_OVER) {
      return this.oncomplete(this, true);
    }
  }
  checkresult(exist) {
    if (exist) {
      console.log("**已存在：" + this.path);
      return this.oncomplete(this, true);
    }
    let stat = fs.statSync(this.path);
    let path = this.path.substr(this.owner.basePath.length);
    let req = { cmd: CMD.CS_INIT_FILETRANSFER, path, size: stat.size };
    this.send(Buffer.from(JSON.stringify(req)));
  }
}


module.exports = function () {
  let package = require(path.join(process.cwd(),"package.json"))
  if(!package["pkg-sync"]) return console.log("未指定配置文件");
  config = package["pkg-sync"];
  if(!path.isAbsolute(config.srcpath)){
    config.srcpath = path.resolve(process.cwd(),config.srcpath)
  }
  new Controller(config.srcpath);
}