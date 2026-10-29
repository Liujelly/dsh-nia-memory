window.__ModuleLoader__.load({ id: 'dsh-nia-memory', factory: require=>{
 const React=require('react');
  const CSS = `
  [data-nia-panel]{--n-bg:var(--dsw-alias-bg-layer-1,#fafaf9);--n-line:var(--dsw-alias-border-l2,#8885);--n-muted:var(--dsw-alias-label-tertiary,#888);--n-accent:var(--dsw-alias-state-business-primary,#168575);font:inherit;font-size:13px;line-height:1.65;color:inherit;max-width:920px;padding:8px 4px 28px;box-sizing:border-box}
  [data-nia-panel] *{box-sizing:border-box}[data-nia-panel] h2{font-size:21px;margin:0;font-weight:650}[data-nia-panel] h3{font-size:14px;margin:0 0 12px}[data-nia-panel] p{margin:6px 0}
  [data-nia-panel] .nia-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}[data-nia-panel] .nia-muted{color:var(--n-muted);font-size:12px}[data-nia-panel] .nia-card{border:1px solid var(--n-line);border-radius:10px;background:var(--n-bg);padding:16px;margin:12px 0}
  [data-nia-panel] button,[data-nia-panel] input,[data-nia-panel] textarea{font:inherit;color:inherit;border:1px solid var(--n-line);border-radius:6px;background:var(--n-bg);padding:7px 10px;min-height:34px;max-width:100%}[data-nia-panel] button{cursor:pointer}[data-nia-panel] button:hover{background:color-mix(in srgb,var(--n-accent) 8%,var(--n-bg))}[data-nia-panel] :focus-visible{outline:2px solid var(--n-accent);outline-offset:2px}[data-nia-panel] button:disabled{opacity:.5;cursor:default}
  [data-nia-panel] input:not([type=checkbox]),[data-nia-panel] textarea{width:100%}[data-nia-panel] input[type=checkbox]{min-height:auto;accent-color:var(--n-accent);margin:0 8px 0 0}[data-nia-panel] .nia-field{display:grid;grid-template-columns:minmax(140px, .8fr) minmax(200px,1.5fr);gap:18px;align-items:start;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--n-line) 45%,transparent)}
  [data-nia-panel] .nia-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}[data-nia-panel] .nia-stack{display:grid;gap:8px}[data-nia-panel] .nia-tabs{display:flex;gap:4px;border-bottom:1px solid var(--n-line);padding-bottom:8px;flex-wrap:wrap}[data-nia-panel] .nia-tabs button{border-color:transparent;background:transparent}[data-nia-panel] .nia-tabs button[aria-selected=true]{background:color-mix(in srgb,var(--n-accent) 10%,transparent);color:inherit;font-weight:600;border-color:var(--n-line)}
  [data-nia-panel] .nia-save{position:sticky;bottom:0;border:1px solid var(--n-line);border-radius:8px;background:var(--n-bg);padding:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;z-index:3;box-shadow:0 -3px 12px #00000008}[data-nia-panel] .nia-primary{background:var(--n-accent);color:white;border-color:var(--n-accent)}[data-nia-panel] .nia-primary:hover{filter:brightness(.95)}
  [data-nia-panel] .nia-message{padding:9px 12px;border-left:3px solid var(--n-accent);background:color-mix(in srgb,var(--n-accent) 6%,transparent);white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0}[data-nia-panel] [role=alert]{border-color:#c45b4e;color:#bb5147}[data-nia-panel] .nia-empty{padding:18px 0;color:var(--n-muted)}
  [data-nia-panel] .nia-picker{min-width:0}[data-nia-panel] .nia-picker>button{width:100%;text-align:left;display:flex;justify-content:space-between;gap:8px}[data-nia-panel] .nia-picker-list{border:1px solid var(--n-line);padding:8px;margin-top:5px;border-radius:8px;max-height:260px;overflow:auto;background:var(--n-bg)}[data-nia-panel] [role=option]{width:100%;display:block;text-align:left;border:0;white-space:normal;overflow-wrap:anywhere;margin-top:3px}[data-nia-panel] [role=option][aria-selected=true]{background:color-mix(in srgb,var(--n-accent) 12%,transparent)}
  [data-nia-panel] .nia-chip{font-size:11px;border:1px solid var(--n-line);padding:2px 7px;border-radius:5px;white-space:nowrap}[data-nia-panel] .nia-record{padding:12px 0;border-bottom:1px solid var(--n-line)}[data-nia-panel] pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:color-mix(in srgb,var(--n-line) 12%,transparent);padding:10px;border-radius:6px;max-height:320px;overflow:auto}[data-nia-panel] summary{cursor:pointer;padding:5px 0}[data-nia-panel] .nia-number{font-size:34px;font-weight:600;line-height:1.2}[data-nia-panel] .nia-metrics{display:flex;gap:24px;flex-wrap:wrap;margin:12px 0}
  @media(max-width:620px){[data-nia-panel] .nia-field{grid-template-columns:1fr;gap:6px}[data-nia-panel] .nia-card{padding:12px}}`;
  const h = React.createElement;
  const card = (title, ...children) => h('section', {className:'nia-card'}, h('h3',null,title), ...children);
  const note = text => h('p',{className:'nia-muted'},text);
  const empty = text => h('div',{className:'nia-empty'},text);
  const fmt = at => at ? new Date(at).toLocaleString() : '未记录';
  const details = (title,value) => h('details',null,h('summary',null,title),h('pre',null,JSON.stringify(value,null,2)));
  function Picker({label, value, options, onChange, placeholder='请选择', emptyText='暂无可选项，请刷新后重试', disabled=false}) {
    const [open,setOpen] = React.useState(false), [query,setQuery] = React.useState('');
    const selected = options.find(o=>o.value===value);
    return h('div',{className:'nia-picker',onKeyDown:e=>{if(e.key==='Escape')setOpen(false);}},
      h('button',{type:'button','aria-label':label,'aria-expanded':open,'aria-haspopup':'listbox',disabled,onClick:()=>setOpen(!open)},h('span',null,selected?.label || value || placeholder),h('span',{'aria-hidden':true},open?'▴':'▾')),
      open?h('div',{className:'nia-picker-list'},h('input',{'aria-label':'搜索'+label,placeholder:'搜索…',value:query,onChange:e=>setQuery(e.target.value)}),
        h('div',{role:'listbox','aria-label':label},...options.filter(o=>(o.label+' '+o.value).toLowerCase().includes(query.toLowerCase())).map(o=>h('button',{type:'button',role:'option',key:o.value,'aria-selected':o.value===value,onClick:()=>{onChange(o.value);setOpen(false);setQuery('');}},o.label))),
        !options.length?empty(emptyText):null):null);
  }
  const field=(label,control,hint)=>h('div',{className:'nia-field'},h('div',null,h('strong',null,label),hint?note(hint):null),control);
  const tabs=(items,current,set)=>h('div',{className:'nia-tabs',role:'tablist'},...items.map(([id,label])=>h('button',{key:id,role:'tab','aria-selected':current===id,onClick:()=>set(id)},label)));
  const message=(text,error=false)=>text?h('div',{className:'nia-message',role:error?'alert':'status'},text):null;
  const root=(name,...children)=>h('div',{'data-nia-panel':name},h('style',null,CSS),...children);
  const header=(title,subtitle,action)=>h('div',{className:'nia-head'},h('div',null,h('h2',null,title),note(subtitle)),action);
  async function request(base,path,body) {
    const response=await fetch(base+'/'+path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json',['x-nia-'+base.split('-').at(-1)]:'1'},body:JSON.stringify(body)});
    let data; try {data=await response.json();} catch {throw Error('服务未返回有效数据（HTTP '+response.status+'），请检查插件是否启用。');}
    if(!response.ok || data.ok===false)throw Error(data.error || '请求失败（HTTP '+response.status+'）'); return data;
  }
  const api=(p,b)=>request('/dsh-nia-memory',p,b);
  const kinds={fact:'事实',preference:'偏好',event:'经历',plan:'计划',project:'项目',relationship:'关系'};
  const statuses={reported:'对方自述',observed:'实际观察',inferred:'推测',planned:'计划中',attempted:'已尝试',completed:'已完成',failed:'失败',cancelled:'已取消',fictional:'虚构情节'};
  const taskNames={expand:'补充检索词',refine:'提炼摘要',dates:'补明确日期',keys:'补属性键',stable:'长期属性',generate:'生成档案',import:'档案候选','import-apply':'导入记忆',manual:'新增记忆',edit:'编辑记忆',duplicates:'查重合并'};
  const scopes={shared:'可转述',internal:'内部知情',private:'仅限原聊天'};
  function Panel(){
    const [data,setData]=React.useState(null),[tab,setTab]=React.useState('memories'),[query,setQuery]=React.useState(''),[filter,setFilter]=React.useState('active');
    const [sid,setSid]=React.useState(''),[actor,setActor]=React.useState('local:owner'),[preview,setPreview]=React.useState(true);
    const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
    const [manageSid,setManageSid]=React.useState(''),[selected,setSelected]=React.useState([]),[plan,setPlan]=React.useState(null),[chosen,setChosen]=React.useState([]);
    const [input,setInput]=React.useState(''),[scanPath,setScanPath]=React.useState(''),[sourceSid,setSourceSid]=React.useState(''),[task,setTask]=React.useState('expand');
    const [manual,setManual]=React.useState({id:'',text:'',subjects:['self'],kind:'event',visibility:'private',importance:0.5,attribute:'',occurredAt:''});
    const [jobs,setJobs]=React.useState({jobs:[],batches:[]}),[policy,setPolicy]=React.useState(null),[trace,setTrace]=React.useState(null),[recallQuery,setRecallQuery]=React.useState('');
    React.useEffect(()=>{let active=true,timer;const poll=async()=>{try{const r=await api('tasks');if(active)setJobs(r);}catch{}finally{if(active)timer=setTimeout(poll,2000);}};poll();return()=>{active=false;clearTimeout(timer);};},[]);
    const showPlan=p=>{setPlan(p);setChosen((p.candidates||p.changes||[]).map(c=>c.id));};
    const download=(filename,text)=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const refresh=async()=>{try{setData(await api('state'));setError('');}catch(e){setError(e.message);}};
    React.useEffect(()=>{void refresh();},[]);
    const act=async(fn,text)=>{setBusy(true);setError('');setNotice('');try{await fn();setData(await api('state'));setNotice(text);}catch(e){setError(e.message);}finally{setBusy(false);}};
    if(!data)return root('memory',header('角色记忆','0.4.1'),message(error,true),empty('读取记忆中…'),h('button',{onClick:refresh},'重新读取'));
    const name=id=>id==='self'?'角色自身':data.people.find(p=>p.id===id)?.alias||data.people.find(p=>p.id===id)?.name||id;
    const records=data.memories.filter(m=>(filter==='trash'?!!m.deletedAt:filter==='all'?true:!m.deletedAt&&!m.supersededBy)&&[m.text,...m.subjects.map(name)].join(' ').includes(query)).slice().reverse();
    const memories=h('div',null,card('记忆库',h('div',{className:'nia-row'},h('input',{'aria-label':'搜索记忆',placeholder:'搜索内容或人物…',value:query,onChange:e=>setQuery(e.target.value),style:{flex:'1 1 230px'}}),
      h(Picker,{label:'记忆范围',value:filter,options:[{value:'active',label:'当前有效'},{value:'trash',label:'回收站'},{value:'all',label:'全部（含旧版本）'}],onChange:setFilter})),note('找到 '+records.length+' 条；当前显示最近 100 条。'),
      ...records.slice(0,100).map(m=>h('article',{key:m.id,className:'nia-record'},h('div',{className:'nia-row'},h('span',{className:'nia-chip'},m.preview?'预演':'正式'),h('span',{className:'nia-chip'},kinds[m.kind]||m.kind),h('span',{className:'nia-chip'},statuses[m.status]||m.status),h('span',{className:'nia-chip'},scopes[m.visibility]||m.visibility)),
        h('label',null,h('input',{type:'checkbox','aria-label':'选择记忆 '+m.id,checked:selected.includes(m.id),disabled:busy||!!m.deletedAt||!!m.supersededBy,onChange:e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(id=>id!==m.id))}),'选择整理'),h('p',null,m.text),note(m.subjects.map(name).join('、')+' · '+fmt(m.occurredAt||m.recordedAt)+(m.supersededBy?' · 已被新版本替代':'')),
        h('div',{className:'nia-row'},h('button',{disabled:busy||!!m.deletedAt||!!m.supersededBy,onClick:()=>{const b=data.bindings.find(b=>b.personaId===m.personaId&&b.chatId===m.chatId&&b.preview===m.preview);setManageSid(b?.sessionId||'');setManual({...m,occurredAt:m.occurredAt??''});setTab('tools');}},'编辑内容'),h('button',{disabled:busy,onClick:()=>act(()=>api('edit',{id:m.id,action:m.deletedAt?'restore':'delete'}),m.deletedAt?'已恢复这条记忆':'已移入回收站，原始事件仍保留')},m.deletedAt?'恢复记忆':'移入回收站'),
          h('button',{disabled:busy||m.visibility==='private',onClick:()=>act(()=>api('edit',{id:m.id,action:'private'}),'已限制这条记忆及同源记录的范围')},'仅限原聊天')),
        details('查看来源与标识',{id:m.id,subjects:m.subjects,chat:m.chatId,evidenceIds:m.evidenceIds,recordedAt:m.recordedAt}))),!records.length?empty('这里还没有记忆。角色会在实际交流中选择值得保留的内容。'):null));
    const binding=h('div',null,card('QQ 自动接入',h('p',null,'在“角色 · QQ”设置中开启联动后，群聊与私聊会自动加入，不需要在这里重复绑定。'),
      ...data.bindings.map(b=>h('div',{key:b.sessionId,className:'nia-record'},h('div',{className:'nia-row'},h('strong',null,b.transport==='qq'?'QQ '+(b.type==='group'?'群聊':'私聊'):'桌面会话'),h('span',{className:'nia-chip'},b.preview?'预演':'正式')),note(b.chatId),note('参与者：'+b.actorIds.map(name).join('、')))),!data.bindings.length?empty('尚未接入聊天。'):null),
      card('添加一个桌面会话',field('已打开的会话',h(Picker,{label:'桌面会话',value:sid,options:data.sessions.filter(s=>!s.id.startsWith('nia-qq-')).map(s=>({value:s.id,label:s.title||s.id})),onChange:setSid,disabled:busy,emptyText:'没有已打开的桌面会话。先打开角色会话，再点击刷新。'})),
        field('与你聊天的人物标识',h('input',{'aria-label':'人物标识',value:actor,disabled:busy,onChange:e=>setActor(e.target.value)}),'如需与 QQ 识别为同一个你，填写 qq:机器人QQ号:你的QQ号。默认 local:owner 只代表桌面用户。'),
        field('会话用途',h('label',null,h('input',{type:'checkbox',checked:preview,disabled:busy,onChange:e=>setPreview(e.target.checked)}),'预演会话'),'正式与预演请使用不同会话，避免混入测试历史。'),
        h('button',{className:'nia-primary',disabled:busy||!sid,onClick:()=>act(()=>api('bind',{sessionId:sid,actorId:actor,preview}),'会话绑定已保存')},'保存会话绑定')));
    const people=card('人物档案',...data.people.map(p=>h('div',{key:p.personaId+'/'+p.id,className:'nia-record'},h('strong',null,p.alias||p.name||'未命名'),note(p.name&&p.alias?'平台名字：'+p.name:''),note(p.id))),!data.people.length?empty('尚未识别人物。收到消息后会按账号记录。'):null);
    const currentSid=manageSid||data.bindings[0]?.sessionId||'';
    const currentBinding=data.bindings.find(b=>b.sessionId===currentSid);
    const scopePicker=field('管理会话',h(Picker,{label:'管理会话',value:currentSid,options:data.bindings.map(b=>({value:b.sessionId,label:(data.sessions.find(s=>s.id===b.sessionId)?.title||b.chatId)+(b.preview?' · 预演':' · 正式')})),onChange:v=>{setManageSid(v);setSelected([]);setPlan(null);},emptyText:'先在会话接入中绑定一个会话'}),'导入和整理沿用此会话的人格、人物范围与预演状态；模型任务需要此会话已打开。');
    const inputField=(label,value,onChange,multiline=false)=>field(label,h(multiline?'textarea':'input',{'aria-label':label,value:value??'',rows:multiline?5:undefined,disabled:busy,onChange:e=>onChange(e.target.value)}));
    const setManualField=(k,v)=>setManual(m=>({...m,[k]:v}));
    const peoplePick=field('记忆涉及谁',h('div',null,...[{id:'self',name:'角色自身'},...data.people.filter(p=>p.personaId===currentBinding?.personaId)].map(p=>h('label',{key:p.id,style:{display:'block'}},h('input',{type:'checkbox',checked:manual.subjects.includes(p.id),onChange:e=>setManualField('subjects',e.target.checked?[...manual.subjects,p.id]:manual.subjects.filter(x=>x!==p.id))}),p.alias||p.name||p.id))), '导入按这里明确选择的人物归属；多人档案请分批选择，不能按同名猜测。');
    const toolsPage=h('div',null,card('整理范围',scopePicker,note('已选择 '+selected.length+' 条记忆（到记忆库勾选）；模型只处理你选择的资料。'),
      h('button',{disabled:busy,onClick:()=>setSelected(data.memories.filter(m=>!m.deletedAt&&!m.supersededBy&&m.personaId===currentBinding?.personaId&&m.preview===currentBinding?.preview&&(m.visibility!=='private'||m.chatId===currentBinding?.chatId)).slice(0,100).map(m=>m.id))},'选择当前范围前 100 条'),h('button',{disabled:busy,onClick:()=>setSelected([])},'清空选择')),
      card(manual.id?'编辑记忆':'手动记录与导入归属',peoplePick,field('信息范围',h(Picker,{label:'信息范围',value:manual.visibility,options:Object.entries(scopes).map(([value,label])=>({value,label})),onChange:v=>setManualField('visibility',v)})),
        inputField('记忆正文',manual.text,v=>setManualField('text',v),true),field('记忆类型',h(Picker,{label:'记忆类型',value:manual.kind,options:Object.entries(kinds).map(([value,label])=>({value,label})),onChange:v=>setManualField('kind',v)})),
        inputField('重要度（0–1）',manual.importance,v=>setManualField('importance',v)),inputField('记忆情绪强度（0–1）',manual.emotion??0,v=>setManualField('emotion',v)),inputField('属性键（可留空）',manual.attribute,v=>setManualField('attribute',v)),
        field('事件日期',h('input',{type:'date','aria-label':'事件日期',value:manual.occurredAt?new Date(Number(manual.occurredAt)).toISOString().slice(0,10):'',onChange:e=>setManualField('occurredAt',e.target.value?Date.parse(e.target.value):'')})),
        note('人工输入作为人工记录，状态为“自述”，不会伪装成已执行或已观察的工具证据。'),
        h('button',{disabled:busy||!currentSid,onClick:()=>act(async()=>showPlan((await api('manual',{...manual,importance:Number(manual.importance),emotion:Number(manual.emotion||0),sessionId:currentSid})).plan),'已生成修改预览')},'预览保存'),
        manual.id?h('button',{onClick:()=>setManual({id:'',text:'',subjects:['self'],kind:'event',visibility:'private',importance:0.5,attribute:'',occurredAt:''})},'改为新增'):null),
      card('从旧档案导入',inputField('文档或文件夹路径',scanPath,setScanPath),h('button',{disabled:busy||!currentSid||!scanPath,onClick:()=>act(async()=>showPlan((await api('scan',{sessionId:currentSid,path:scanPath})).plan),'已扫描，勾选后导入')},'扫描档案'),
        inputField('或粘贴档案文本',input,setInput,true),h('button',{disabled:busy||!currentSid||!input,onClick:()=>act(async()=>showPlan((await api('scan',{sessionId:currentSid,text:input})).plan),'已生成导入候选')},'预览文本候选'),note('支持 md / txt / log / rst / org；扫描最多 50 个文件、下探两层。导入原文后，可选“提炼摘要”继续整理。')),
      card('批量整理',field('整理任务',h(Picker,{label:'整理任务',value:task,options:[['expand','补充检索词（模型）'],['refine','提炼摘要（模型）'],['dates','补明确日期（本地）'],['keys','补属性键（模型）'],['stable','重判长期稳定属性（模型）']].map(([value,label])=>({value,label})),onChange:setTask})),
        h('button',{disabled:busy||!selected.length||!currentSid,onClick:()=>act(async()=>{await api('task',{sessionId:currentSid,ids:selected,task});setJobs(await api('tasks'));},'整理任务已启动，完成后查看预览')},'开始整理'),
        h('button',{disabled:busy||selected.length<2||!currentSid,onClick:()=>act(async()=>showPlan((await api('duplicates',{sessionId:currentSid,ids:selected})).plan),'查重完成；请检查是否确实为同一件事')},'查重并预览合并')),
      card('从历史会话生成档案',field('来源会话',h(Picker,{label:'档案来源会话',value:sourceSid,options:data.sessions.map(s=>({value:s.id,label:s.title||s.id})),onChange:setSourceSid})),note('只读取所选会话中的用户与助手文字，过滤系统注入和推理；按批调用管理会话的模型。生成后可下载或送入导入预览。'),
        h('button',{disabled:busy||!currentSid||!sourceSid,onClick:()=>act(async()=>{await api('task',{sessionId:currentSid,sourceSessionId:sourceSid,task:'generate'});setJobs(await api('tasks'));},'档案生成任务已启动')},'生成档案')),
      card('整理进度',...(jobs.jobs||[]).slice().reverse().map(j=>h('div',{key:j.id,className:'nia-record'},h('strong',null,(taskNames[j.task]||j.task)+' · '+({running:'进行中',ready:'待预览',failed:'失败',cancelled:'已取消'}[j.status]||j.status)),note(j.done+' / '+j.total),message(j.error,true),
        j.status==='running'?h('button',{onClick:()=>act(()=>api('cancel-task',{id:j.id}),'已请求取消')},'取消任务'):null,
        ['failed','cancelled'].includes(j.status)&&j.done<j.total?h('button',{onClick:()=>act(async()=>{await api('retry-task',{id:j.id});setJobs(await api('tasks'));},'已重试未完成部分；已完成部分的预览仍保留')},'重试未完成部分'):null,
        j.planId?h('button',{onClick:()=>act(async()=>showPlan((await api('plan',{id:j.planId})).plan),'已打开候选；未应用前不修改记忆')},'查看结果预览'):null)),message(jobs.autoExpandError,true)),
      plan?card('结果预览 · '+(taskNames[plan.type]||plan.type),plan.partial?note('这是已完成部分的结果；其余部分未完成。'):null,
        ...(plan.skipped||[]).map((x,i)=>note(x)),
        plan.document?h('div',null,h('pre',{style:{whiteSpace:'pre-wrap',maxHeight:300,overflow:'auto'}},plan.document),h('button',{onClick:()=>download('角色-会话档案.md',plan.document)},'下载档案'),h('button',{onClick:()=>{setInput(plan.document);setPlan(null);}},'填入档案导入框')):null,
        ...(plan.candidates||plan.changes||[]).map(c=>h('div',{key:c.id,className:'nia-record'},h('label',null,h('input',{type:'checkbox',checked:chosen.includes(c.id),disabled:busy||plan.atomicSelection,onChange:e=>setChosen(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}),c.source||c.after?.text?.slice(0,40)||c.id),c.after?note('涉及：'+c.after.subjects.map(name).join('、')+' · '+scopes[c.after.visibility]+' · '+statuses[c.after.status]):null,c.before?h('p',null,'原内容：'+c.before.text):null,h('p',null,c.text||c.after?.text),c.after?details('修改字段',{keywords:c.after.keywords,attribute:c.after.attribute,stable:c.after.stable,occurredAt:c.after.occurredAt,importance:c.after.importance,supersededBy:c.after.supersededBy}):null,c.note?note(c.note):null)),
        plan.type==='import'?h('button',{disabled:busy||!chosen.length,onClick:()=>act(async()=>showPlan((await api('import-plan',{planId:plan.id,selected:chosen,subjects:manual.subjects,visibility:manual.visibility})).plan),'已生成带人物归属的导入预览，请确认应用')},'确认候选与人物归属'):
        plan.changes?.length?h('button',{className:'nia-primary',disabled:busy||!chosen.length,onClick:()=>act(async()=>{await api('apply-plan',{planId:plan.id,selected:chosen});setPlan(null);setJobs(await api('tasks'));},'修改已应用，可在管理与备份中撤销本批次')},'应用选中的修改'):note('没有需要修改的记忆')):null);
    const recallPage=card('召回诊断',scopePicker,inputField('测试召回的说法',recallQuery,setRecallQuery),h('button',{disabled:busy||!currentSid,onClick:()=>act(async()=>setTrace((await api('recall',{sessionId:currentSid,query:recallQuery})).trace),'已完成本地检索，不调用模型')},'测试召回'),
      note('只展示所选会话可见的记忆，不列出被身份或私密范围过滤的记录。最近自动召回会在刷新后出现。'),
      ...[trace,...(data.traces||[]).filter(x=>x.sessionId===currentSid).slice(-1)].filter(t=>t&&t.sessionId===currentSid).filter((t,i,all)=>all.findIndex(x=>x.at===t.at&&x.query===t.query)===i).map((t,i)=>h('div',{key:i},note(fmt(t.at)+' · '+t.query),note('分词：'+(t.terms||[]).join(' / ')),...(t.rows||[]).map(r=>h('div',{key:r.id,className:'nia-record'},h('strong',null,r.reason),h('p',null,r.text),note('分数 '+r.score.toFixed(3)+' · 命中 '+r.matched.join('、')+' · 鲜活度 '+r.freshness.toFixed(3)))))));
    const policyNames={halfLifeDays:'普通记忆半衰期（天）',emotionHalfLifeDays:'记忆情绪权重半衰期（天）',threshold:'相关证据门槛（0–1）',maxItems:'自动召回条数上限',maxChars:'召回正文总字数上限',dailyQuota:'自主记忆每日配额（0 为不限）',factsMax:'长期事实最多占用条数',baselineWeight:'人物相关权重',activationWeight:'鲜活度权重',importanceWeight:'重要度权重',emotionWeight:'情绪强度权重'};
    const settings=card('召回与记录参数',...Object.entries(policyNames).map(([k,label])=>inputField(label,(policy||data.policy||{})[k]??'',v=>setPolicy(p=>({...data.policy,...p,[k]:v})))),
      field('自动补充检索词',h('label',null,h('input',{type:'checkbox',checked:(policy||data.policy||{}).autoExpand??true,onChange:e=>setPolicy(p=>({...data.policy,...p,autoExpand:e.target.checked}))}),'新记忆写入后调用一次模型；可关闭')),
      h('button',{disabled:busy||!policy,onClick:()=>act(async()=>{const p={...policy};for(const k of Object.keys(policyNames))p[k]=Number(p[k]);await api('config',{policy:p});setPolicy(null);},'召回参数已保存')},'保存召回参数'));
    const maintenance=h('div',null,settings,card('运行与备份',h('div',{className:'nia-row'},h('span',{className:'nia-chip'},data.enabled?'记忆服务运行中':'记忆服务已暂停'),h('button',{disabled:busy,onClick:()=>act(()=>api('config',{enabled:!data.enabled}),data.enabled?'已暂停记忆与联动':'记忆已恢复')},data.enabled?'暂停记忆与联动':'恢复记忆')),
      note('自动保留最近 14 个备份日及上一版 .bak；也可手动导出。开关和记录操作点击后立即保存。暂停也会阻止 QQ 联动继续投递，不会删除已有记录。'),
      h('button',{disabled:busy,onClick:()=>act(async()=>{const v=await api('export');const url=URL.createObjectURL(new Blob([JSON.stringify(v.data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nia-memory-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'已生成备份下载')},'导出备份')),
      card('批次撤销',note('只撤销所选整理批次；已有后续修改时会拒绝覆盖。导入撤销隐藏摘要，原始来源保留。'),...(jobs.batches||data.maintenance?.batches||[]).slice().reverse().map(b=>h('div',{key:b.id,className:'nia-record'},h('span',null,(taskNames[b.type]||b.type)+' · '+b.count+' 条 · '+fmt(b.at)),h('button',{disabled:busy||b.undone,onClick:()=>act(async()=>{await api('undo',{batchId:b.id});setJobs(await api('tasks'));},'已撤销该批次')},b.undone?'已撤销':'撤销此批次')))),
      card('诊断数据',note('平时不需要查看。情绪状态可直接在“角色情绪”页查看。'),details('最近来源事件',data.events),details('最近发送结果',data.actions),details('情绪原始数据',data.moods)));
    return root('memory',header('角色记忆',`0.4.1 · ${data.memories.filter(m=>!m.deletedAt&&!m.supersededBy).length} 条有效记忆 · ${data.people.length} 位已识别人物`,h('button',{disabled:busy,onClick:refresh},'刷新')),
      tabs([['memories','记忆库'],['tools','导入与整理'],['recall','召回诊断'],['people','人物'],['bindings','会话接入'],['maintenance','管理与备份']],tab,setTab),message(error,true),message(notice),busy?message('正在保存…'):null,
      tab==='memories'?memories:tab==='tools'?toolsPage:tab==='recall'?recallPage:tab==='people'?people:tab==='bindings'?binding:maintenance);
  }

 return {inject:['slots'],apply(ctx){const slots=ctx.get?.('slots')||ctx.slots;slots.inject('settings.section',()=>slots.register({name:'settings.section',id:'nia-memory',order:43,label:'角色记忆'},()=>h(Panel)));}};
}});
