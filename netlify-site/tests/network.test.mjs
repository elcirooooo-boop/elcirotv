import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {pinnedLookup} from '../lib/network.mjs';
test('Node automatic family selection can connect using the pinned lookup',async()=>{
  const server=net.createServer(socket=>socket.end());
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await new Promise((resolve,reject)=>{
      const socket=net.connect({host:'test.example.com',port:server.address().port,autoSelectFamily:true,lookup:pinnedLookup('127.0.0.1')});
      socket.on('connect',()=>{socket.destroy();resolve();});socket.on('error',reject);
    });
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('single-address lookup remains compatible with automatic selection disabled',async()=>{
  const server=net.createServer(socket=>socket.end());
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await new Promise((resolve,reject)=>{
      const socket=net.connect({host:'test.example.com',port:server.address().port,autoSelectFamily:false,lookup:pinnedLookup('127.0.0.1')});
      socket.on('connect',()=>{socket.destroy();resolve();});socket.on('error',reject);
    });
  }finally{await new Promise(resolve=>server.close(resolve));}
});
