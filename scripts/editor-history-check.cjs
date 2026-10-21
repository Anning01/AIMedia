"use strict";
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const stem = path.join(__dirname, "ui-test/.tmp-editor-history");
const out = path.resolve(".tmp-editor-history-check");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(stem + ".tsx", `
import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useArticleStudio} from '../../src/features/article-studio/useArticleStudio';
import {ArticleWorkspaceProvider} from '../../src/features/article-studio/workspace-context';
import {CreationWorkflow} from '../../src/features/article-studio/creation/CreationWorkflow';
import {Toaster} from '../../src/components/ui/sonner';
import '../../src/ui.css'; import '../../src/styles.css'; import '../../src/workspace.css';
(window as any).__calls=[];
(window as any).__image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jftkAAAAASUVORK5CYII=';
window.wangaohui=new Proxy({} as any,{get:(_,name:string)=>{
  if(name.startsWith('on'))return ()=>()=>{};
  return async(...args:any[])=>{
  (window as any).__calls.push({name,args});
  if(name==='selectImage')return {ok:true,dataUrl:(window as any).__newImage};
  return {ok:true,images:[],accounts:[],entries:[]};
};}});
window.fetch=async()=>new Response(JSON.stringify({code:0,data:[]}),{headers:{'Content-Type':'application/json'}});
(window as any).__seed={id:'test-document',title:'撤销验收文章',time:new Date().toISOString(),templateId:'t1',status:'待发布',blocks:[
  {id:'title',type:'title',text:'撤销验收文章'},
  {id:'paragraph',type:'p',text:'这是一段需要保留的正文。'},
  {id:'picture',type:'image',text:'原图说明',src:(window as any).__image},
  {id:'list',type:'list',items:['第一项','第二项']},
]};
function Harness(){
  const workspace=useArticleStudio();
  (window as any).__studio=workspace;
  useEffect(()=>workspace.loadArticle((window as any).__seed),[]);
  return <ArticleWorkspaceProvider value={workspace}><main className="app-content"><CreationWorkflow/></main><Toaster/></ArticleWorkspaceProvider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness/></React.StrictMode>);
`);
fs.writeFileSync(stem + ".html", '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/></head><body><div id="root"></div><script type="module" src="./.tmp-editor-history.tsx"></script></body></html>');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  let win, exitCode = 0;
  const errors = [];
  try {
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { partition: "editor-history-" + Date.now(), backgroundThrottling: false } });
    win.webContents.on('console-message', (_e, level, text) => { if (level >= 3) errors.push(text); });
    const js = script => win.webContents.executeJavaScript(script);
    const pointClick = async selector => {
      const point = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
      assert(point, selector);
      for (const type of ['mouseDown','mouseUp']) win.webContents.sendInputEvent({type, button:'left', clickCount:1, ...point});
      await pause(80);
    };
    const click = text => pointClick(`[data-editor-button="${text}"]`);
    const state = () => js(`({blocks:window.__studio.blocks,editingId:window.__studio.editingId,editValue:window.__studio.editValue,undo:window.__studio.canUndoEdit,redo:window.__studio.canRedoEdit})`);
    const action = async script => {await js(script);await pause(60);};
    const key = async (keyCode, modifiers = []) => {
      // Hidden Electron windows have no OS keyboard focus. Dispatch the same DOM
      // key and let Chromium's editing commands provide the native default action.
      const cancelled = await js(`(()=>{const e=new KeyboardEvent('keydown',{key:${JSON.stringify(keyCode)},ctrlKey:${modifiers.includes('control')},metaKey:${modifiers.includes('meta')},shiftKey:${modifiers.includes('shift')},bubbles:true,cancelable:true});return !document.activeElement.dispatchEvent(e);})()`);
      if (!cancelled) {
        const modified = modifiers.includes('control') || modifiers.includes('meta');
        if (modified && keyCode.toLowerCase()==='a') await js(`document.execCommand('selectAll')`);
        else if (modified && keyCode.toLowerCase()==='z') await js(`document.execCommand(${modifiers.includes('shift') ? "'redo'" : "'undo'"})`);
        else if (modified && keyCode.toLowerCase()==='y') await js(`document.execCommand('redo')`);
        else if (keyCode==='Backspace') await js(`document.execCommand('delete')`);
      }
      await pause(70);
    };
    const ctrl = process.platform === 'darwin' ? 'meta' : 'control';
    const reload = async () => action('window.__studio.loadArticle(window.__seed)');
    await win.loadURL('http://127.0.0.1:5173/scripts/ui-test/.tmp-editor-history.html');
    await pause(600);
    await js(`for(const e of document.querySelectorAll('button'))if(['继续编辑','撤销','重做'].includes(e.textContent.trim()))e.dataset.editorButton=e.textContent.trim();`);
    await click('继续编辑');
    assert.equal((await state()).undo,false);
    assert.equal((await state()).redo,false);
    assert(await js(`document.querySelector('[data-editor-button=撤销]').disabled`));

    // Actual native text deletion/undo stays in the focused input.
    await pointClick('.article-paper .ae-p');
    assert(await js(`document.activeElement.isContentEditable`));
    await key('a',[ctrl]); await key('Backspace');
    assert.equal((await state()).editValue,'');
    await key('z',[ctrl]);
    assert.equal((await state()).editValue,'这是一段需要保留的正文。');
    assert.equal((await state()).blocks.length,4);
    await key('a',[ctrl]); await key('Backspace');
    await click('撤销');
    assert.equal((await state()).blocks.find(b=>b.id==='paragraph').text,'这是一段需要保留的正文。');
    assert.equal((await state()).editingId,null);
    await click('重做');
    assert.equal((await state()).blocks.find(b=>b.id==='paragraph').text,'');
    await click('撤销');

    // Empty-block Backspace removes the block; keyboard undo restores its original text.
    await pointClick('.article-paper .ae-p');
    await key('a',[ctrl]); await key('Backspace'); await key('Backspace');
    assert(!(await state()).blocks.some(b=>b.id==='paragraph'));
    await key('z',[ctrl]);
    assert.equal((await state()).blocks.find(b=>b.id==='paragraph').text,'这是一段需要保留的正文。');
    await key('z',[ctrl,'shift']);
    assert(!(await state()).blocks.some(b=>b.id==='paragraph'));
    await click('撤销');

    // Image deletion/restoration retains original URI, caption and order.
    await action(`window.__studio.removeBlock('picture')`);
    await js(`document.activeElement?.blur()`);
    await key('z',['control']);
    assert.equal((await state()).blocks[2].src,await js('window.__image'));
    assert.equal((await state()).blocks[2].text,'原图说明');
    await key('y',['control']);
    assert(!(await state()).blocks.some(b=>b.id==='picture'));
    await click('撤销');

    const replacement='data:image/png;base64,cmVwbGFjZW1lbnQ=';
    await action(`window.__newImage=${JSON.stringify(replacement)};window.__studio.uploadImage('picture')`);
    assert.equal((await state()).blocks.find(b=>b.id==='picture').src,replacement);
    await click('撤销');
    assert.equal((await state()).blocks.find(b=>b.id==='picture').src,await js('window.__image'));
    await click('重做');
    assert.equal((await state()).blocks.find(b=>b.id==='picture').src,replacement);
    await click('撤销');
    await action(`window.__studio.removeBlock('list')`);
    assert.equal((await state()).redo,false,'a new change discards redo history');
    await click('撤销');
    assert.deepEqual((await state()).blocks.find(b=>b.id==='list').items,['第一项','第二项']);

    // Cancelling edits/no-op blur does not add history, and list fields support undo.
    await reload();
    await pointClick('.article-paper .ae-p');
    await js(`document.activeElement.blur()`); await pause(60);
    assert.equal((await state()).undo,false);
    await pointClick('.article-paper .ae-list');
    await key('a',[ctrl]); await key('Backspace');
    await click('撤销');
    assert.deepEqual((await state()).blocks.find(b=>b.id==='list').items,['第一项','第二项']);
    await pointClick('.article-paper .ae-p');
    await key('a',[ctrl]); await key('Backspace'); await key('Escape');
    assert.equal((await state()).blocks.find(b=>b.id==='paragraph').text,'这是一段需要保留的正文。');

    // New documents clear previous history; navigation preserves this document's history.
    await action(`window.__studio.removeBlock('picture')`);
    await js(`document.querySelector('.creation-step-button').click()`); await pause(60);
    assert.equal((await state()).undo,true);
    const unchanged=JSON.stringify((await state()).blocks);
    await key('z',[ctrl]);
    assert.equal(JSON.stringify((await state()).blocks),unchanged,'hidden editor ignores shortcuts');
    await js(`document.querySelectorAll('.creation-step-button')[1].click()`); await pause(60);
    await click('撤销');
    await action(`window.__studio.loadArticle({...window.__seed,id:'second',title:'第二篇',blocks:[{id:'new',type:'p',text:'第二篇正文'}]})`);
    assert.equal((await state()).undo,false);
    assert.equal((await state()).redo,false);
    await reload();

    // Sticker picture buttons use the same history, including cover/card flags.
    await action(`window.__studio.loadArticle({...window.__seed,kind:'sticker',blocks:window.__seed.blocks.map(b=>b.id==='picture'?{...b,cover:true}:b)})`);
    await pointClick('.article-paper button[aria-label="删除首图"]');
    assert(!(await state()).blocks.some(b=>b.id==='picture'));
    await click('撤销');
    assert.equal((await state()).blocks.find(b=>b.id==='picture').cover,true);
    await reload();
    for (const [width,height] of [[1024,768],[1280,800],[1440,900]]) {
      win.setSize(width,height); await pause(120);
      assert(await js(`(()=>{const e=document.querySelector('[role=group][aria-label=编辑历史]');const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()`));
      fs.writeFileSync(path.join(out,`editor-${width}.png`),(await win.capturePage()).toPNG());
    }
    assert.deepEqual(errors,[]);
    assert(!(await js(`window.__calls.some(c=>c.name==='platformPublish'||c.name==='llmChat'||c.name==='generateArticle')`)));
    console.log('PASS: native text undo, pending edits, text/image/list deletion, image replacement, undo/redo shortcuts, redo invalidation, document reset, navigation retention, sticker cover recovery and three desktop sizes. No live APIs.');
  } catch(error) {
    console.error(error,errors);
    if(win && !win.isDestroyed()) {
      console.log(await win.webContents.executeJavaScript(`({text:document.querySelector('.creation-article-editor')?.innerText,state:window.__studio&&{blocks:window.__studio.blocks,editValue:window.__studio.editValue,editingId:window.__studio.editingId,undo:window.__studio.canUndoEdit,redo:window.__studio.canRedoEdit}})`));
      fs.writeFileSync(path.join(out,'failure.png'),(await win.capturePage()).toPNG());
    }
    exitCode=1;
  } finally {
    for(const ext of ['tsx','html'])fs.rmSync(stem+'.'+ext,{force:true});
    if(win && !win.isDestroyed())win.destroy();
    app.exit(exitCode);
  }
});
