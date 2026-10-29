/* Отдельный режим «Собери формулу»: только темы 8–12 (№103–127). */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const screens = ['screen-builder-topics', 'screen-builder', 'screen-builder-result'];
    const GAME_FIRST_ID = 103;
    const GAME_LAST_ID = 127;
    const GAME_SECTIONS = new Set([8, 9, 10, 11, 12]);
    let questions = [], current = 0, score = 0, completed = false, revealed = false;
    let placements = [], tokenPool = [], dragged = null, selected = null, checked = false;
    let template = null, sourceList = [], topics = [];
  
    const shuffle = arr => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
  
    function math(target, tex, displayMode = false, allowHTML = false) {
      try {
        katex.render(tex, target, { throwOnError: false, displayMode, trust: allowHTML ? ({command}) => command === '\\htmlClass' : false,
          strict: 'ignore', output: 'htmlAndMathml' });
      } catch (e) { target.textContent = tex; }
    }
  
    function show(id) {
      document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === id));
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const readCommand = (str, i) => {
      const hit = /^\\(?:[a-zA-Z]+|.)/.exec(str.slice(i));
      return hit ? hit[0] : '\\';
    };
    function braced(str, i) {
      if (str[i] !== '{') return null;
      let depth = 0;
      for (let j = i; j < str.length; j++) {
        if (str[j] === '\\') { j += readCommand(str, j).length - 1; continue; }
        if (str[j] === '{') depth++;
        if (str[j] === '}' && --depth === 0) return { text: str.slice(i+1,j), end:j+1 };
      }
      return null;
    }
    function argument(str, i) {
      while (str[i] === ' ') i++;
      if (str[i] === '{') return braced(str, i);
      if (str[i] === '\\') { const cmd = readCommand(str,i); return {text: cmd, end:i+cmd.length, bare:true}; }
      return i < str.length ? {text:str[i],end:i+1,bare:true} : null;
    }
    function attachScripts(str, i) {
      let suffix='';
      while (str[i] === '_' || str[i] === '^') {
        const sign = str[i++], arg = argument(str, i);
        if (!arg) break;
        suffix += sign + (arg.bare ? arg.text : '{'+arg.text+'}');
        i = arg.end;
      }
      return {suffix, end:i};
    }
    function tokenizable(str, offset, slots) {
      let out = '', i = 0, prevAtom = false;
      const addToken = raw => {
        const idx = slots.length;
        slots.push(raw);
        if (prevAtom && slots[idx-1] !== 'd' && !/^(?:\\Delta|\\delta)/.test(raw) && !/\\(?:Delta|delta)$/.test(slots[idx-1]||'')) out += '\\cdot ';
        out += `@@SLOT_${idx}@@`;
        prevAtom = true;
      };
      while (i < str.length) {
        const c = str[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '\\') {
          const cmd = readCommand(str,i); i += cmd.length;
          if (['\\dfrac','\\frac','\\tfrac','\\binom','\\dbinom'].includes(cmd)) {
            const a = argument(str,i); if (!a) {out+=cmd; continue;}
            const b = argument(str,a.end); if (!b) {out+=cmd; continue;}
            if (prevAtom) out += '\\cdot ';
            const aa = tokenizable(a.text,offset,slots), bb = tokenizable(b.text,offset,slots);
            out += `${cmd}{${aa}}{${bb}}`;
            prevAtom = false; i = b.end; continue;
          }
          if (cmd === '\\sqrt') {
            // Optional sqrt index \sqrt[n]{...} stays structural.
            let prefix = '';
            if (str[i] === '[') {const end=str.indexOf(']',i);if(end>=0){prefix=str.slice(i,end+1);i=end+1;}}
            const a = argument(str,i); if (!a) {out+=cmd;continue;}
            if (prevAtom) out += '\\cdot ';
            out += `\\sqrt${prefix}{${tokenizable(a.text,offset,slots)}}`;
            i=a.end; prevAtom=false; continue;
          }
          if (['\\vec','\\overline','\\bar','\\dot','\\ddot','\\hat','\\tilde','\\widehat'].includes(cmd)) {
            const arg = argument(str,i); if (!arg) {out+=cmd; continue;}
            const scr = attachScripts(str,arg.end);
            addToken(cmd+'{'+arg.text+'}'+scr.suffix); i = scr.end; continue;
          }
          if (['\\mathrm','\\text','\\operatorname','\\mathit','\\mathbf','\\textbf'].includes(cmd)) {
            const arg=argument(str,i); if (!arg){out+=cmd;continue;}
            const scr=attachScripts(str,arg.end);
            // Treat text/const as one movable token; units are omitted from the game pool by section.
            addToken(cmd+'{'+arg.text+'}'+scr.suffix);
            i=scr.end; continue;
          }
          if (['\\sum','\\prod','\\int','\\iint','\\lim'].includes(cmd)) {
            const scr=attachScripts(str,i);
            out+=cmd+scr.suffix; i=scr.end; prevAtom=false; continue;
          }
          if (['\\left','\\right','\\big','\\Big','\\bigl','\\bigr', '\\biggl','\\biggr', '\\middle'].includes(cmd)) {
            out+=cmd; prevAtom=false; continue;
          }
          if (['\\cos','\\sin','\\tan','\\ln','\\log','\\exp'].includes(cmd)) {
            out+=cmd; prevAtom=false; continue;
          }
          // TeX command \\  creates a space; it is not a draggable symbol.
          if (cmd === '\\ ') { out += '\\ '; prevAtom = false; continue; }
          if (['\\cdot','\\times','\\pm','\\mp','\\le','\\ge','\\neq','\\approx','\\to','\\Rightarrow','\\in','\\,','\\;','\\!','\\quad','\\qquad'].includes(cmd)) {
            out+=cmd; prevAtom=false; continue;
          }
          const scr = attachScripts(str,i);
          addToken(cmd + scr.suffix); i=scr.end; continue;
        }
        if (/[a-zA-Z\u0400-\u04FF]/.test(c)) {
          const scr=attachScripts(str,i+1);
          addToken(c+scr.suffix); i=scr.end; continue;
        }
        if (/\d/.test(c)) {
          let j=i+1;
          while (/\d/.test(str[j]||'')) j++;
          // KaTeX decimal separator {,}.
          if (str.slice(j,j+3)==='{,}') {
            j+=3; while (/\d/.test(str[j]||'')) j++;
          }
          const scr=attachScripts(str,j);
          addToken(str.slice(i,j)+scr.suffix); i=scr.end; continue;
        }
        // Non-symbol punctuation and structural braces remain visible.
        out+=c;
        prevAtom=false;
        i++;
      }
      return out;
    }
    // В показательных формулах оставляем экспоненту как часть шаблона,
    // а отдельные M, g, h, R, T и другие символы вставляем в показатель.
    const SPECIAL_TEMPLATES = {
      110: {
        rhs: '@@SLOT_0@@\\cdot e^{-\\dfrac{@@SLOT_1@@\\cdot @@SLOT_2@@\\cdot @@SLOT_3@@}{@@SLOT_4@@\\cdot @@SLOT_5@@}}',
        symbols: ['p_0', 'M', 'g', 'h', 'R', 'T']
      },
      111: {
        rhs: '@@SLOT_0@@\\cdot e^{-\\dfrac{@@SLOT_1@@}{@@SLOT_2@@\\cdot @@SLOT_3@@}}',
        symbols: ['n_0', 'E_p', 'k_B', 'T']
      },
      112: {
        rhs: '@@SLOT_0@@\\cdot @@SLOT_1@@\\left(\\dfrac{@@SLOT_2@@}{@@SLOT_3@@\\cdot @@SLOT_4@@\\cdot @@SLOT_5@@\\cdot @@SLOT_6@@}\\right)^{@@SLOT_7@@/@@SLOT_8@@}@@SLOT_9@@\\cdot e^{-\\dfrac{@@SLOT_10@@\\cdot @@SLOT_11@@}{@@SLOT_12@@\\cdot @@SLOT_13@@\\cdot @@SLOT_14@@}}',
        symbols: ['4', '\\pi', 'm_0', '2', '\\pi', 'k_B', 'T', '3', '2', 'v^2', 'm_0', 'v^2', '2', 'k_B', 'T']
      }
    };
    function makeTemplate(item) {
      const raw = item.formula || '';
      if (!raw || !raw.includes('=')) return null;
      const eq = raw.indexOf('=');
      const left = raw.slice(0,eq+1), right = raw.slice(eq+1).trim();
      if (SPECIAL_TEMPLATES[item.id]) {
        return { id:item.id, item, left, ...SPECIAL_TEMPLATES[item.id] };
      }
      let slots=[];
      const rhs = tokenizable(right,0,slots);
      if (!slots.length || slots.length > 18) return null;
      return { id:item.id, item, left, rhs, symbols:slots };
    }
    function latexView() {
      let s=template.rhs;
      for(let i=0;i<template.symbols.length;i++) {
        const tokenId=placements[i];
        const content = tokenId == null ? '\\phantom{\\rule{1.15em}{0.95em}}' : template.symbols[tokenId];
        s=s.replace(`@@SLOT_${i}@@`, `\\htmlClass{fg-slot fg-slot-${i}}{\\boxed{${content}}}`);
      }
      return '\\displaystyle '+template.left+' '+s;
    }
    function questionsFrom(selectedSections) {
      return shuffle(sourceList.filter(f=>selectedSections.includes(f.item.section)));
    }
    function buildSections() {
      const list = $('builder-topic-list'); list.innerHTML='';
      topics = [...new Set(sourceList.map(t=>t.item.section))];
      for(const section of topics) {
        const count = sourceList.filter(x=>x.item.section===section).length;
        const l=document.createElement('label'); l.className='builder-topic';
        const cb=document.createElement('input'); cb.type='checkbox'; cb.value=section; cb.checked=true;
        cb.addEventListener('change',updateSectionCount);
        const title=document.createElement('span'); title.textContent=section; title.className='builder-topic-name';
        const small=document.createElement('small'); small.textContent=count+' формул';
        l.append(cb,title,small); list.append(l);
      }
      updateSectionCount();
    }
    function updateSectionCount() {
      const selected=[...document.querySelectorAll('#builder-topic-list input:checked')].map(x=>x.value);
      const count=sourceList.filter(f=>selected.includes(f.item.section)).length;
      $('builder-available').textContent=`Выбрано: ${count} формул`;
      $('builder-play').disabled=count===0;
    }
    function start() {
      const selected=[...document.querySelectorAll('#builder-topic-list input:checked')].map(x=>x.value);
      questions=questionsFrom(selected);current=0;score=0;
      if (!questions.length) return;
      show('screen-builder');nextQuestion();
    }
    function nextQuestion() {
      if (current>=questions.length) return finish();
      template=questions[current];
      placements=Array(template.symbols.length).fill(null);
      tokenPool=shuffle(template.symbols.map((latex,id)=>({latex,id})));
      checked=false;revealed=false;completed=false;selected=null;
      $('builder-section').textContent=template.item.section;
      $('builder-name').textContent=template.item.name;
      $('builder-progress').textContent=`${current+1} / ${questions.length}`;
      $('builder-score').textContent=`Верно: ${score}`;
      $('builder-feedback').hidden=true;
      $('builder-answer').hidden=true;
      $('builder-check').disabled=false;
      $('builder-check').textContent='Проверить';
      $('builder-clear').disabled=false;
      $('builder-reveal').disabled=false;
      $('builder-next').hidden=true;
      $('builder-skip').hidden=false;
      paint();
    }
    function paint() {
      math($('builder-formula'),latexView(),true,true);
      const host=$('builder-formula');
      host.querySelectorAll('.katex-html .fg-slot').forEach(el=>{
        const m=el.className.match(/fg-slot-(\d+)/), index=m?+m[1]:-1;
        if(index<0)return;
        el.dataset.slot=index;
        el.setAttribute('role','button');el.setAttribute('tabindex','0');
        el.setAttribute('aria-label', `Место ${index+1}: ${placements[index]==null?'пусто':'заполнено'}`);
        if(checked) el.classList.add(template.symbols[index]===template.symbols[placements[index]]?'fg-correct':'fg-wrong');
      });
      const bank=$('builder-tokens'); bank.replaceChildren();
      tokenPool.forEach(token=>{
        if (placements.includes(token.id)) return;
        const b=document.createElement('button');b.className='builder-token';b.type='button';
        b.dataset.token=token.id;b.setAttribute('aria-label','Символ '+token.latex);
        const inner=document.createElement('span'); b.append(inner);
        math(inner,token.latex);
        bank.append(b);
      });
    }
    function setSlot(index,tokenId) {
      if (completed || checked || index<0 || index>=placements.length) return;
      const prev=placements.indexOf(tokenId);
      if (prev>=0) placements[prev]=null;
      placements[index]=tokenId;
      selected=null;
      paint();
    }
    function pick(tokenId, slotIndex = -1) {
      if(completed || checked)return;
      if(slotIndex<0) slotIndex=placements.indexOf(null);
      if(slotIndex>=0)setSlot(slotIndex,tokenId);
    }
    function onSlot(index) {
      if(completed || checked)return;
      if(selected!==null) {setSlot(index,selected);return;}
      if(placements[index]!==null) {placements[index]=null;paint();return;}
      // When no token selected, wait for selecting the chip.
    }
    function verify() {
      if(checked || completed)return;
      if (placements.some(p=>p===null)){
        feedback('Сначала заполни все пустые места.',false);return;
      }
      checked=true;
      const correct=placements.every((tokenId,i)=>template.symbols[tokenId]===template.symbols[i]);
      if(correct){score++;completed=true;feedback('Верно! Формула собрана правильно.',true);endQuestion();}
      else {
        feedback('Есть ошибки. Исправь выделенные места и попробуй ещё.',false);
        paint();
        $('builder-check').textContent='Попробовать ещё';
      }
    }
    function feedback(message,success) {
      const node=$('builder-feedback');node.hidden=false;node.className='builder-feedback '+(success?'success':'error');node.textContent=message;
    }
    function endQuestion() {
      completed=true;
      $('builder-check').disabled=true;
      $('builder-clear').disabled=true;
      $('builder-reveal').disabled=true;
      $('builder-skip').hidden=true;
      $('builder-next').hidden=false;
      $('builder-score').textContent=`Верно: ${score}`;
      $('builder-next').textContent=(current+1===questions.length)?'К результатам':'Следующая';
      paint();
    }
    function reveal() {
      if(completed)return;
      revealed=true;
      let el=$('builder-answer');el.hidden=false;
      math(el, template.item.formula,true);
      feedback('Формула показана. За это задание балл не начисляется.',false);
      endQuestion();
    }
    function finish() {
      $('builder-final-score').textContent=`${score} / ${questions.length}`;
      const pct=Math.round(score/questions.length*100);
      $('builder-final-text').textContent=`Правильно собрано ${pct}% формул. Можно повторить те же темы или выбрать другие.`;
      show('screen-builder-result');
    }
    function initializeDrag() {
      const host=$('builder-tokens'), form=$('builder-formula');
      let pointer=null,ghost=null;
      function removeGhost(){if(ghost){ghost.remove();ghost=null;}}
      host.addEventListener('pointerdown',e=>{
        const chip=e.target.closest('.builder-token');
        if(!chip || completed || checked)return;
        e.preventDefault();
        pointer={id:Number(chip.dataset.token),x:e.clientX,y:e.clientY,dragging:false};
        try{host.setPointerCapture(e.pointerId);}catch(_){/* capture unsupported */}
      });
      host.addEventListener('pointermove',e=>{
        if(!pointer)return;
        const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
        if(!pointer.dragging && Math.hypot(dx,dy)>8){
          pointer.dragging=true;
          ghost=document.createElement('div');ghost.className='builder-ghost';
          math(ghost,template.symbols[pointer.id]);document.body.append(ghost);
        }
        if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}
        document.querySelectorAll('#builder-formula .fg-slot').forEach(n=>n.classList.remove('fg-over'));
        if(pointer.dragging){
          const below=document.elementFromPoint(e.clientX,e.clientY)?.closest('.fg-slot');
          if(below&&form.contains(below))below.classList.add('fg-over');
        }
      });
      host.addEventListener('pointerup',e=>{
        if(!pointer)return;
        const p=pointer;pointer=null;
        if(p.dragging){
          const below=document.elementFromPoint(e.clientX,e.clientY)?.closest('.fg-slot');
          if(below && form.contains(below))setSlot(Number(below.dataset.slot),p.id);
        } else pick(p.id);
        removeGhost();
        document.querySelectorAll('#builder-formula .fg-slot').forEach(n=>n.classList.remove('fg-over'));
      });
      host.addEventListener('pointercancel',()=>{pointer=null;removeGhost();});
      form.addEventListener('click',e=>{
        const slot=e.target.closest('.fg-slot');
        if(slot && form.contains(slot))onSlot(Number(slot.dataset.slot));
      });
      form.addEventListener('keydown',e=>{
        const slot=e.target.closest('.fg-slot');
        if(slot&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSlot(Number(slot.dataset.slot));}
      });
    }
    function initialize() {
      if(!window.katex || !Array.isArray(window.FORMULAS) && typeof FORMULAS === 'undefined'){
        console.warn('Собери формулу: необходимы KaTeX и formulas.js');return;
      }
      // Остальные темы остаются в обычном тесте/справочнике, но не попадают в эту игру.
      sourceList=FORMULAS
        .filter(f => f.id >= GAME_FIRST_ID && f.id <= GAME_LAST_ID &&
          GAME_SECTIONS.has(Number((f.section || '').split('.')[0])))
        .map(makeTemplate)
        .filter(Boolean);
      $('btn-builder').addEventListener('click',()=>{buildSections();show('screen-builder-topics');});
      document.querySelectorAll('[data-builder-back]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.builderBack)));
      $('builder-select-all').addEventListener('click',()=>{document.querySelectorAll('#builder-topic-list input').forEach(c=>c.checked=true);updateSectionCount();});
      $('builder-select-none').addEventListener('click',()=>{document.querySelectorAll('#builder-topic-list input').forEach(c=>c.checked=false);updateSectionCount();});
      $('builder-play').addEventListener('click',start);
      $('builder-check').addEventListener('click',()=>{
        if(checked && !completed){checked=false;$('builder-check').textContent='Проверить';$('builder-feedback').hidden=true;paint();}
        else verify();
      });
      $('builder-clear').addEventListener('click',()=>{if(checked){checked=false;$('builder-check').textContent='Проверить';}placements.fill(null);$('builder-feedback').hidden=true;paint();});
      $('builder-reveal').addEventListener('click',reveal);
      $('builder-skip').addEventListener('click',()=>{current++;if(current>=questions.length)finish();else nextQuestion();});
      $('builder-next').addEventListener('click',()=>{current++;nextQuestion();});
      $('builder-again').addEventListener('click',()=>{current=0;score=0;questions=shuffle(questions);show('screen-builder');nextQuestion();});
      initializeDrag();
    }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize);
    else initialize();
  })();
  