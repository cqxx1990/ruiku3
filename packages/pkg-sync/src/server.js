const net = require("net");
const fs = require("fs");
const path = require("path");

function createDir(dir){
	if(fs.existsSync(dir)){
		return;
	}else{
		let pdir=path.dirname(dir);
		createDir(pdir);
		fs.mkdirSync(dir);
	}
}
function clearFolder(url,except){
	var files = [];
    if (fs.existsSync(url)) {
        files = fs.readdirSync(url);
        files.forEach(function (file, index){
        	if(file==except) return;
            let curPath = path.join(url, file);
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath)
            } else {
                fs.unlinkSync(curPath);
            }
        });
    } else {
        console.log("给定的路径不存在，请给出正确的路径");
    }
}
function deleteFolderRecursive(url) {
    var files = [];
    if (fs.existsSync(url)) {
        files = fs.readdirSync(url);
        files.forEach(function (file, index){
            let curPath = path.join(url, file);
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath)
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(url);
    } else {
        console.log("给定的路径不存在，请给出正确的路径");
    }
}
let CID=0;
let CMD={
	CS_REG_CONTROLLER:CID++,
	CS_REG_FILETRANSFER:CID++,
	CS_CHECK_VERSION:CID++,
	CS_CHECK_FILE_EXIST:CID++,
	CS_COMPLETE:CID++,
	CS_INIT_FILETRANSFER:CID++,

	SC_REG_CONTROLLER:CID++,
	SC_REG_FILETRANSFER:CID++,
	SC_CHECK_VERSION:CID++,
	SC_CHECK_FILE_EXIST:CID++,
	SC_COMPLETE:CID++,
	SC_INIT_FILETRANSFER:CID++,
	SC_FILETRANSFER_OVER:CID++,
}
class Component{
	constructor(){

	}
	onclose(){

	}
	ondata(data){

	}
	onerror(err){
		console.log("err"+err);
	}
	oncomplete(){

	}
	send(data){

	}
}
let dir_lock={}
let g_masters={};
let gid=0;
class Client extends Component{
	constructor(socket){
		super();
		this.socket=socket;
		this.adapter=null;
		this.id=0;
		socket.on("close",this.onclose.bind(this));
		socket.on("data",this.ondata.bind(this));
		socket.on("error",this.onerror.bind(this));
	}
	
	ondata(data){
		if(this.adapter){
			return this.adapter.ondata(data);
		}
		let pack=JSON.parse(data.toString());
		if(pack.cmd==CMD.CS_REG_CONTROLLER){
			this.id=Date.now()*100+(++gid%100);
			let cmd=CMD.SC_REG_CONTROLLER;
			let resp=JSON.stringify({cmd,id:this.id});
			this.send(Buffer.from(resp));
			this.adapter=new Controller(this);
			g_masters[this.id]=this;
		}else if(pack.cmd==CMD.CS_REG_FILETRANSFER){
			let id=pack.id;
			let controller=g_masters[id];
			if(controller){
				let resp=JSON.stringify({cmd:CMD.SC_REG_FILETRANSFER});
				this.send(Buffer.from(resp));
				this.adapter=new FileTransfer(this,controller.adapter.cfg);
			}else{
				let resp=JSON.stringify({cmd:CMD.SC_REG_FILETRANSFER,err:"主控不在线"});
				this.send(Buffer.from(resp))
			}
		}
	}
	onclose(){
		if(this.adapter)
			this.adapter.onclose();
	}
	oncomplete(){
		this.socket.end();
	}
	send(data){
		this.socket.write(data);
	}
}
class Controller extends Component{
	constructor(owner){
		super();
		this.owner=owner;
		this.cfg=null;
	}
	ondata(data){
		let pack=JSON.parse(data.toString());
		if(pack.cmd==CMD.CS_CHECK_VERSION){
			let dir=pack.dir;
			if(dir_lock[dir]){
				let resp=JSON.stringify({cmd:CMD.SC_CHECK_VERSION,err:"此目录正在操作中"});
				this.send(Buffer.from(resp))
				return;
			}
			let ver=pack.ver;
			let cfgdir=dir+".xfg"
			if(!fs.existsSync(dir)){
				let resp=JSON.stringify({cmd:CMD.SC_CHECK_VERSION,err:"目标目录不存在"});
				this.send(Buffer.from(resp))
			}
			if(fs.existsSync(cfgdir)){
				this.cfg=JSON.parse(fs.readFileSync(cfgdir, "utf-8"));
				if(this.cfg.ver==ver && this.cfg.done){
					let cmd=CMD.SC_CHECK_VERSION;
					let err="此版本已经同步";
					let resp=JSON.stringify({cmd,err,over:1});
					this.send(Buffer.from(resp))
					return;
				}
			}else{
				this.cfg={dir,ver,done:false,time:Date.now()};
				fs.writeFileSync(cfgdir, JSON.stringify(this.cfg));
			}
			clearFolder(dir,".xfg");
			let cmd=CMD.SC_CHECK_VERSION;
			let resp=JSON.stringify({cmd});
			this.send(Buffer.from(resp));
			dir_lock[dir]=1;
		}else if(pack.cmd==CMD.CS_CHECK_FILE_EXIST){
			let filepath=this.cfg.dir+""+pack.path;
			let exist=fs.existsSync(filepath);
			let resp=JSON.stringify({cmd:CMD.SC_CHECK_FILE_EXIST,data:pack.data,exist});
			this.send(Buffer.from(resp))
		}else if(pack.cmd==CMD.CS_COMPLETE){
			this.cfg.ver=pack.ver;
			this.oncomplete();
		}
	}
	oncomplete(){
		this.cfg.done=true;
		let cfgdir=this.cfg.dir+".xfg"
		fs.writeFileSync(cfgdir, JSON.stringify(this.cfg));
		delete dir_lock[this.cfg.dir];
		let resp=JSON.stringify({cmd:CMD.SC_COMPLETE});
		this.send(Buffer.from(resp));
	}
	onclose(){
		if(this.cfg)
			delete dir_lock[this.cfg.dir];
		delete g_masters[this.owner.id];
	}
	send(data){
		this.owner.send(data);
	}
}
class FileTransfer extends Component{
	constructor(owner,cfg){
		super();
		this.owner=owner;
		this.cfg=cfg;
		this.step=0;
		this.steam=null;
		this.filesize=0;
		this.count=0;
		this.dest=null;
	}
	ondata(data){
		if(this.step==0){
			let pack=JSON.parse(data.toString());
			if(pack.cmd==CMD.CS_INIT_FILETRANSFER){
				this.filesize=pack.size;
				this.dest=this.cfg.dir+""+pack.path;
				createDir(path.dirname(this.dest));
				this.steam=fs.createWriteStream(this.dest+".tmp");
				this.step=1;
				let resp=JSON.stringify({cmd:CMD.SC_INIT_FILETRANSFER});
				this.send(Buffer.from(resp));
			}
		}else{
			this.steam.write(data);
			this.count+=data.length;
			if(this.count>=this.filesize){
				this.steam.end();
				fs.renameSync(this.dest+".tmp", this.dest);
				let resp=JSON.stringify({cmd:CMD.SC_FILETRANSFER_OVER});
				this.send(Buffer.from(resp));
			}
		}
	}
	send(data){
		this.owner.send(data);
	}
	oncomplete(){
		this.owner.oncomplete();
	}
	onclose(){
		
	}
}

module.exports=function(){
  const server = net.createServer(socket=>{
    let client=new Client(socket);
  });
  
  server.listen(23456,() => {
    console.log('打开服务器', server.address());
  });
}