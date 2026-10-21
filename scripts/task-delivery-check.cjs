"use strict";
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const stem = path.join(__dirname, 'ui-test/.tmp-task-delivery');
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useTaskCenter} from '../../src/features/task-center/useTaskCenter';
import * as store from '../../src/data/localStore';
(window as any).__calls=[];
window.fetch=async()=>new Response(JSON.stringify({code:0,data:[]}),{headers:{'Content-Type':'application/json'}});
window.wangaohui=new Proxy({} as any,{get:(_,name:string)=>async(payload:any)=>{
  (window as any).__calls.push({name,payload});
  if(name==='generateArticle')return {ok:true,chinese:'模拟标题\\n模拟正文'};
  if(name==='platformPublish')return {ok:true,token:'token-'+payload.wechatUsername,cookies:'slave_user='+payload.wechatUsername+'; slave_sid=test',currentUsername:payload.wechatUsername};
  return {ok:true};
}});
store.saveAccount({id:'parent',platform:'公众号',name:'微信登录',authed:true,cookie:'slave_user=account-a; slave_sid=test',token:'token-account-a',currentUsername:'account-a',wechatAccounts:[{username:'account-a',nickname:'公众号A',kind:'mp'},{username:'account-b',nickname:'公众号B',kind:'mp'},{username:'disabled',nickname:'停用账号',kind:'mp',enabled:false}],createdAt:new Date().toISOString()});
store.saveMaterialGroups([{id:'materials',name:'模拟素材',source:'txt',materials:['a','b','c','d'].map(id=>({id,title:'素材'+id,content:'素材正文'+id,status:'pending',createdAt:new Date().toISOString()})),createdAt:new Date().toISOString()}]);
store.saveHostTasks(['account-a','account-b','disabled',''].map((wechatUsername,i)=>({id:'task-'+i,name:'任务'+i,accountId:'parent',platform:'公众号',wechatUsername,contentType:'article',sourceType:'material',sourceKey:'materials',templateId:'t1',imageSource:'library',imageCount:1,perRunCount:1,frequency:'once',startTime:'09:00',intervalMinutes:0,publishMode:'draft',retry:false,enabled:true,status:'运行中',nextRunAt:new Date(0).toISOString(),log:[],createdAt:new Date().toISOString()})));
const timeout=window.setTimeout.bind(window);
window.setTimeout=((fn:any,ms:any,...args:any[])=>timeout(fn,ms===15000?50:ms,...args)) as any;
function Harness(){useTaskCenter({});return null;}
createRoot(document.getElementById('root')!).render(<Harness/>);
`;
fs.writeFileSync(stem+'.tsx', fixture);
fs.writeFileSync(stem+'.html', '<html><body><div id="root"></div><script type="module" src="./.tmp-task-delivery.tsx"></script></body></html>');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
app.whenReady().then(async () => {
  let win, state;
  let exitCode=0;
  const errors=[];
  try {
    win = new BrowserWindow({show:false,webPreferences:{partition:'task-delivery-'+Date.now(),backgroundThrottling:false}});
    win.webContents.on('console-message',(_e,level,text)=>{if(level>=3)errors.push(text);});
    const js = code => win.webContents.executeJavaScript(code);
    await win.loadURL('http://127.0.0.1:5173/scripts/ui-test/.tmp-task-delivery.html');
    for(let i=0;i<100;i++){
      await pause(100);
      state=await js("(async()=>{const s=await import('/src/data/localStore.ts');return {calls:window.__calls||[],tasks:s.listHostTasks(),accounts:s.listAccounts(),queue:s.listQueue()};})()");
      if(state.tasks.length===4 && state.tasks.every(t=>t.log.some(l=>l.includes('本次执行完成')||l.includes('目标完成'))))break;
    }
    assert.equal(state.tasks.length,4);
    const published=state.calls.filter(c=>c.name==='platformPublish').map(c=>c.payload);
    assert.deepEqual(published.map(p=>p.wechatUsername),['account-a','account-b']);
    assert(published.every(p=>p.saveDraftOnly===true));
    assert(published.every(p=>p.wechatAccounts.length===3));
    assert.equal(published[1].token,'token-account-a');
    assert.equal(state.accounts[0].currentUsername,'account-b');
    assert.equal(state.accounts[0].cookie,'slave_user=account-b; slave_sid=test');
    assert.equal(state.accounts[0].wechatAccounts.find(a=>a.username==='account-a').cookies,'slave_user=account-a; slave_sid=test');
    assert.equal(state.accounts[0].wechatAccounts.find(a=>a.username==='account-b').cookies,'slave_user=account-b; slave_sid=test');
    assert.deepEqual(state.tasks.map(t=>t.doneCount),[1,1,0,0]);
    assert(state.tasks.slice(2).every(t=>t.log.some(l=>l.includes('目标公众号不存在或已停用'))));
    assert.deepEqual(state.queue.map(q=>q.account).sort(),['公众号A','公众号B']);
    assert.deepEqual(errors,[]);
    console.log('PASS: real task hook sends distinct WeChat targets and account metadata, persists returned credentials per target, rejects missing/disabled targets, and records separate draft destinations. All APIs mocked.');
  } catch(error) {console.error(error, errors, state);exitCode=1;}
  finally {
    for(const ext of ['tsx','html'])fs.rmSync(stem+'.'+ext,{force:true});
    if(win && !win.isDestroyed())win.destroy();
    app.exit(exitCode);
  }
});
