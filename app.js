/* Восстановленный app.js: справочник, эквиваленты, постоянные, тест A–D.
   Режим «Собери формулу» полностью независим и подключается через game.js. */
   (() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const arr = a => [...a];
    const formulaList = typeof FORMULAS !== 'undefined' ? FORMULAS : [];
    const equivalents = typeof EQUIVALENTS !== 'undefined' ? EQUIVALENTS : [];
    const constants = typeof CONSTANTS !== 'undefined' ? CONSTANTS : [];
    let pool = [], index = 0, correctCount = 0, mode = 'one', chosen = [], answered = false;
    const shuffle = list => {
      let a = [...list];
      for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
      return a;
    };
    function renderMath(node, latex, block=false){
      try { katex.render(latex || '',node,{throwOnError:false,displayMode:block,strict:'ignore'}); }
      catch(error){node.textContent=latex||'';}
    }
    function show(screen){
      document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active', el.id==='screen-'+screen));
      window.scrollTo({top:0,behavior:'instant'});
    }
    function text(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value;return el;}
    function formulaCell(formula,boxed=false){
      let el=document.createElement('span');if(boxed)el.className='formula-box';renderMath(el,formula);return el;
    }
    function notationHTML(s){
      const box=document.createElement('span');
      (s||'').split('; ').forEach((chunk,i)=>{
        if(i)box.append(document.createTextNode('; '));
        const hit=chunk.match(/^(.+?) — (.*)$/);
        if(hit){ const sym=document.createElement('span');renderMath(sym,hit[1]);box.append(sym,document.createTextNode(' — '+hit[2])); }
        else box.append(document.createTextNode(chunk));
      });
      return box;
    }
    function listScreen(target,items,type){
      const root=$(target);root.replaceChildren();
      const sections=[...new Set(items.map(x=>x.section||'Постоянные'))];
      for(const section of sections){
        const block=document.createElement('section');block.className='section-block';
        block.append(text('h2','section-title',section));
        const subset=items.filter(x=>(x.section||'Постоянные')===section);
        // Адаптивная таблица на ПК.
        const desktop=document.createElement('div');desktop.className='table-scroll desktop-only';
        const table=document.createElement('table');table.className='formula-table';
        const thead=document.createElement('thead'),tr=document.createElement('tr');
        ['№','Название','Формула','Обозначения'].forEach(h=>tr.append(text('th','',h)));
        thead.append(tr);table.append(thead);
        const tb=document.createElement('tbody');
        subset.forEach((f,i)=>{
          const row=document.createElement('tr');
          row.append(text('td','col-num',String(f.id||i+1)),text('td','col-name',f.name));
          const fm=document.createElement('td');fm.className='col-formula';fm.append(formulaCell(f.formula||f.value, f.boxed));row.append(fm);
          const notation=document.createElement('td');notation.className='col-notation';notation.append(notationHTML(f.notation||''));row.append(notation);
          tb.append(row);
        });table.append(tb);desktop.append(table);block.append(desktop);
        // Карточки на телефоне.
        const mobile=document.createElement('div');mobile.className='formula-cards mobile-only';
        subset.forEach((f,i)=>{
          const card=document.createElement('article');card.className='formula-card';
          const head=document.createElement('div');head.className='card-top';
          head.append(text('span','card-num',String(f.id||i+1)),text('h3','card-name',f.name));card.append(head);
          const fm=document.createElement('div');fm.className='card-formula';fm.append(formulaCell(f.formula||f.value,f.boxed));card.append(fm);
          if(f.base){const base=text('div','card-base','Из: ');base.append(formulaCell(f.base));card.append(base);}
          if(f.notation){const nt=document.createElement('p');nt.className='card-notation';nt.append(notationHTML(f.notation));card.append(nt);}
          mobile.append(card);
        });block.append(mobile);root.append(block);
      }
    }
    function selectMode(value){
      mode=value;
      if(value==='all'){begin(formulaList);return;}
      const topics=[...new Set(formulaList.map(f=>f.section))];
      $('topics-title').textContent=value==='one'?'Выбор темы':'Выбор нескольких тем';
      $('topics-hint').textContent=value==='one'?'Нажми на нужную тему.':'Отметь нужные темы и нажми «Начать тест».';
      const list=$('topics-list');list.replaceChildren();chosen=[];
      topics.forEach(sec=>{
        const count=formulaList.filter(f=>f.section===sec).length;
        if(value==='one') {
          const btn=document.createElement('button');btn.type='button';btn.className='topic-item';
          btn.append(text('span','topic-name',sec),text('span','topic-count',String(count)));
          btn.addEventListener('click',()=>begin(formulaList.filter(f=>f.section===sec)));
          list.append(btn);
        } else {
          const label=document.createElement('label');label.className='topic-item topic-check';
          const box=document.createElement('input');box.type='checkbox';box.value=sec;
          box.addEventListener('change',()=>{
            chosen=arr(list.querySelectorAll('input:checked')).map(e=>e.value);
            $('btn-topics-go').disabled=!chosen.length;
          });
          label.append(box,text('span','topic-name',sec),text('span','topic-count',String(count)));list.append(label);
        }
      });
      $('btn-topics-go').hidden=value!=='multi';$('btn-topics-go').disabled=true;
      show('topics');
    }
    function begin(formulas){
      pool=shuffle(formulas);index=0;correctCount=0;
      show('quiz');next();
    }
    function next(){
      if(index>=pool.length)return finish();
      answered=false;
      $('quiz-footer').hidden=true;$('quiz-feedback').hidden=true;
      const cur=pool[index];
      $('quiz-progress').textContent=`${index+1} / ${pool.length}`;
      $('quiz-section').textContent=cur.section;
      $('quiz-question').textContent=cur.name;
      const distractors=shuffle(formulaList.filter(f=>f.id!==cur.id && f.formula!==cur.formula)).slice(0,3);
      const options=shuffle([cur,...distractors]);
      const list=$('quiz-answers');list.replaceChildren();
      options.forEach((o,i)=>{
        const btn=document.createElement('button');btn.type='button';btn.className='answer';
        btn.append(text('span','answer-letter','ABCD'[i]));
        const body=document.createElement('span');body.className='answer-body';renderMath(body,o.formula);btn.append(body);
        btn.addEventListener('click',()=>{
          if(answered)return;
          answered=true;
          const ok=cur.id===o.id;
          if(ok)correctCount++;
          arr(list.children).forEach((b,j)=>{
            b.disabled=true;
            if(options[j].id===cur.id)b.classList.add('correct');
            else if(j===i)b.classList.add('wrong');
          });
          const fb=$('quiz-feedback');fb.hidden=false;
          fb.className='quiz-feedback '+(ok?'ok':'bad');
          fb.textContent=ok?'Верно!':'Неверно. Правильный ответ выделен зелёным.';
          $('quiz-footer').hidden=false;
          $('btn-next').textContent=index+1===pool.length?'Результаты':'Далее';
        });
        list.append(btn);
      });
    }
    function finish(){
      $('result-score').textContent=`${correctCount} / ${pool.length}`;
      $('result-text').textContent=`Правильных ответов: ${Math.round(correctCount/pool.length*100)||0}%.`;
      show('result');
    }
    function init(){
      $('menu-count').textContent=`${formulaList.length} формул · ${equivalents.length} эквивалентов`;
      $('btn-start').addEventListener('click',()=>show('mode'));
      $('btn-list').addEventListener('click',()=>{listScreen('formulas-list',formulaList);show('list');});
      $('btn-equiv').addEventListener('click',()=>{listScreen('equiv-list',equivalents);show('equiv');});
      $('btn-const').addEventListener('click',()=>{listScreen('const-list',constants);show('const');});
      $('btn-mode-one').addEventListener('click',()=>selectMode('one'));
      $('btn-mode-all').addEventListener('click',()=>selectMode('all'));
      $('btn-mode-multi').addEventListener('click',()=>selectMode('multi'));
      $('btn-topics-go').addEventListener('click',()=>begin(formulaList.filter(f=>chosen.includes(f.section))));
      $('btn-next').addEventListener('click',()=>{index++;next();});
      $('btn-retry').addEventListener('click',()=>begin(pool));
      document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>show(btn.dataset.go)));
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  })();
  