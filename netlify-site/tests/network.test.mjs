import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {pinnedLookup,playbackHeaders} from '../lib/network.mjs';
test('media requests carry the same Origin and browser identity as bot one',()=>{
  const headers=playbackHeaders('https://tvf90.com/5.php?stream=espn3');
  assert.equal(headers.Origin,'https://tvf90.com');assert.equal(headers.Referer,'https://tvf90.com/5.php?stream=espn3');assert.ok(headers['User-Agent'].includes('Chrome/122'));
  assert.equal(playbackHeaders('bad\r\nInjected: yes').Referer,undefined);
});
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
