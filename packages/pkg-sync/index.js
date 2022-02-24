#! /usr/bin/env node

const server = require('./src/server')
const client = require("./src/client")
let arguments = process.argv.splice(2);
if(arguments[0]==="client"){
  client()
}else if(arguments[0]==="server"){
  server()
}else{
  console.log("param must be [client/server]")
}