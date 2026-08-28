const view = document.querySelector('#view');
const title = document.querySelector('#pageTitle');
const breadcrumb = document.querySelector('#breadcrumb');
const dialog = document.querySelector('#taskDialog');
const toast = document.querySelector('#toast');
let snapshot = { metrics: {}, state: { tasks: [], approvals: [], activity: [] } };
let currentView = 'dashboard';

// 같은 localhost 포트를 사용했던 다른 앱의 오래된 서비스워커가 API를 가로채지 않게 한다.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations =>
    Promise.all(registrations.map(registration => registration.unregister()))
  );
}

const views = {
  dashboard: ['전사 통합 대시보드', 'QA+ / 전사 대시보드'], workroom: ['콘텐츠 워크룸', 'QA+ / 콘텐츠 운영'],
  pipeline: ['OSMU 파이프라인', 'QA+ / 콘텐츠 운영'], library: ['지식 라이브러리', 'QA+ / 지식 관리'],
  agents: ['AI 임원진', 'QA+ / AI 조직'], automation: ['자동화 센터', 'QA+ / AI 조직'],
  approval: ['대표 승인함', 'QA+ / 품질 관리'], settings: ['설정·보안', 'QA+ / 시스템']
};
const agents = [
  ['CSO 김이사','전략·우선순위·복합 안건 라우팅'],['CCO','유튜브·블로그·SNS OSMU'],['CPO','HACCP·FSSC22000 서식과 SOP'],
  ['CTO','자동화·앱·API·보안'],['CMO','검색 유입·구독자 성장·전환'],['CXO','오픈채팅·고객경험·온보딩'],
  ['COO','제작 루틴·일정·병목'],['CDO','채널 KPI·데이터 품질'],['CFO','B2B 자문 수익성·리소스']
];
const modules = [
  ['콘텐츠 워크룸','주제부터 최종 검수까지 제작 업무를 관리','workroom'],['블로그 제작팀','공식 조사→집필→이미지→HTML 조립','pipeline'],
  ['쇼츠 자동화','주제 큐·음성·B-roll·세로 영상 생성','automation'],['품질 지식창고','HACCP·FSSC22000 출처와 SOP 축적','library'],
  ['AI 하네스','Pydantic 검증형 업무 파이프라인','automation'],['대표 승인함','외부 공개 전 최종 승인과 이력 관리','approval']
];

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}
function formatTime(value){try{return new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return value;}}

async function load(){
  const response=await fetch('/api/status',{cache:'no-store'}); if(!response.ok) throw new Error('상태를 불러오지 못했습니다.');
  snapshot=await response.json(); document.querySelector('#approvalBadge').textContent=snapshot.state.approvals.length; render();
}
async function save(){
  const response=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot.state)});
  if(!response.ok) throw new Error('저장에 실패했습니다.');
}

function dashboard(){
  const m=snapshot.metrics,s=snapshot.state;
  return `<div class="hero"><div class="hero-main"><span class="eyebrow">TODAY'S CONTROL TOWER</span><h2>대표님, QA+ 운영 상태를 한 화면에 모았습니다.</h2><p>현재는 로컬 안전 모드입니다. 콘텐츠 생성과 검수 흐름을 먼저 안정화하고, 외부 발행은 승인 단계 이후에 연결합니다.</p></div><div class="hero-side"><h3>오늘의 운영 원칙</h3><ul><li>공식 출처 없는 수치 <strong>차단</strong></li><li>대표 승인 없는 발행 <strong>차단</strong></li><li>진행 중 업무 <strong>${s.tasks.length}건</strong></li></ul></div></div>
  <div class="metrics">${[['주제 큐',m.topics],['완성 블로그',m.blogs],['완성 영상',m.videos],['자동화 스크립트',m.scripts],['AI 에이전트',m.agents],['검증 하네스',m.harnesses]].map((x,i)=>`<div class="metric"><small>${x[0]}</small><strong>${x[1]??0}</strong><i style="width:${40+i*8}%"></i></div>`).join('')}</div>
  <div class="grid-2"><div class="section"><div class="section-head"><div><h2>업무 진행 현황</h2><p>생성→검수→승인 흐름</p></div><button class="text-btn" onclick="openTask()">업무 추가</button></div>${taskRows(s.tasks.slice(0,6))}</div><div class="section"><div class="section-head"><div><h2>최근 활동</h2><p>로컬 저장 이력</p></div></div>${s.activity.slice().reverse().slice(0,6).map(a=>`<div class="activity">${escapeHtml(a.message)}<small>${formatTime(a.at)}</small></div>`).join('')||'<div class="empty-note">아직 활동 기록이 없습니다.</div>'}</div></div>`;
}
function taskRows(tasks){return tasks.length?tasks.map(t=>`<div class="task-row"><div><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.team)} · ${escapeHtml(t.owner)}</small></div><span class="pill ${escapeHtml(t.stage)}">${escapeHtml(t.stage)}</span><small>${escapeHtml(t.priority)}</small><button class="text-btn" onclick="advanceTask('${escapeHtml(t.id)}')">다음 단계</button></div>`).join(''):'<div class="empty-note">등록된 업무가 없습니다.</div>';}
function workroom(){return `<div class="section"><div class="section-head"><div><h2>전체 콘텐츠 업무</h2><p>각 업무의 현재 단계와 담당 AI를 관리합니다.</p></div><button class="primary" onclick="openTask()">새 업무</button></div>${taskRows(snapshot.state.tasks)}</div>`;}
function pipeline(){const stages=['주제 선정','공식자료 조사','대본·본문 작성','이미지·영상 제작','품질 검수','대표 승인'];return `<div class="section"><div class="section-head"><div><h2>QA+ OSMU 표준 흐름</h2><p>하나의 주제를 유튜브·블로그·SNS로 확장합니다.</p></div></div><div class="module-grid">${stages.map((x,i)=>`<div class="module"><em>${i+1}/6</em><span class="module-icon">0${i+1}</span><h3>${x}</h3><p>${['주제 큐와 현장 질문에서 우선순위 선정','식약처·인증원·공식 기준 확인','QA+ 문체로 채널별 원고 작성','공장 현실에 맞는 시각자료 제작','출처·수치·형식·링크 전수 검사','대표 확인 후에만 외부 발행'][i]}</p></div>`).join('')}</div></div>`;}
function library(){const m=snapshot.metrics;return `<div class="hero"><div class="hero-main"><span class="eyebrow">LOCAL KNOWLEDGE VAULT</span><h2>모델보다 중요한 QA+ 고유 데이터를 축적합니다.</h2><p>주제 큐, 승인된 블로그, 업무 SOP와 검증 하네스가 이 프로젝트 안에 보존됩니다.</p></div><div class="hero-side"><h3>현재 자산</h3><ul><li>QA 주제 <strong>${m.topics||0}개</strong></li><li>완성 블로그 <strong>${m.blogs||0}개</strong></li><li>하네스 <strong>${m.harnesses||0}개</strong></li></ul></div></div><div class="section"><h2>지식 저장 원칙</h2><p style="color:var(--muted);line-height:1.8">원천자료와 공식 출처를 먼저 저장하고, 승인된 결과물과 실패 기록을 함께 남깁니다. 비밀키·OAuth 토큰·개인정보는 지식창고에 기록하지 않습니다.</p></div>`;}
function agentView(){return `<div class="agent-grid">${agents.map(a=>`<div class="agent"><div class="agent-top"><h3>${a[0]}</h3><span><i class="dot"></i> 준비됨</span></div><p>${a[1]}</p><button class="text-btn" onclick="showToast('${a[0]} 호출은 다음 연결 단계에서 활성화됩니다.')">역할 보기</button></div>`).join('')}</div>`;}
function automation(){return `<div class="section"><div class="section-head"><div><h2>자동화 모듈</h2><p>현재 프로젝트에서 발견된 실행 자산</p></div><span class="safe">안전 모드</span></div><div class="module-grid">${[['일일 QA 콘텐츠','주제 큐 기반 쇼츠 제작'],['블로그 생성','조사와 원고 생성'],['영상 하네스','유튜브 자막→검증형 코드'],['한국어 음성','TTS 내레이션 자산'],['업로드 도구','YouTube·Meta 연결 준비'],['Telegram','원격 명령과 결과 알림']].map(x=>`<div class="module"><span class="module-icon">⌁</span><h3>${x[0]}</h3><p>${x[1]}</p><em>발행 차단</em></div>`).join('')}</div></div>`;}
function approval(){return `<div class="section"><div class="section-head"><div><h2>대표 승인 대기</h2><p>외부 발행은 이 승인 이후에만 허용됩니다.</p></div></div>${snapshot.state.approvals.length?taskRows(snapshot.state.approvals):'<div class="empty-note">현재 승인 대기 항목이 없습니다.</div>'}</div>`;}
function settings(){return `<div class="section"><h2>보안과 데이터 경계</h2><div class="activity">서버 접근 범위 <small>127.0.0.1 로컬 PC에서만 접속</small></div><div class="activity">외부 게시 <small>비활성 — 대표님의 명시적 요청 전까지 차단</small></div><div class="activity">업무 데이터 <small>company-os/data/os_state.json에 로컬 저장</small></div><div class="activity">비밀정보 <small>화면과 상태 파일에 저장하지 않음</small></div></div>`;}
function modulesView(){return `<div class="module-grid">${modules.map(m=>`<div class="module" onclick="navigate('${m[2]}')"><span class="module-icon">□</span><h3>${m[0]}</h3><p>${m[1]}</p></div>`).join('')}</div>`;}
function render(){title.textContent=views[currentView][0];breadcrumb.textContent=views[currentView][1];view.innerHTML=({dashboard:dashboard(),workroom:workroom(),pipeline:pipeline(),library:library(),agents:agentView(),automation:automation(),approval:approval(),settings:settings()}[currentView]||modulesView());}
function navigate(name){currentView=name;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));render();}
function openTask(){dialog.showModal();}
window.openTask=openTask;window.navigate=navigate;window.showToast=showToast;
window.advanceTask=async id=>{const stages=['대기','조사','작성','검수','승인대기','완료'];const task=snapshot.state.tasks.find(t=>t.id===id);if(!task)return;const next=stages[Math.min(stages.indexOf(task.stage)+1,stages.length-1)];task.stage=next;task.updatedAt=new Date().toISOString();snapshot.state.activity.push({message:`${task.title}: ${next} 단계로 이동`,at:new Date().toISOString()});if(next==='승인대기'&&!snapshot.state.approvals.some(a=>a.id===id))snapshot.state.approvals.push(task);if(next==='완료')snapshot.state.approvals=snapshot.state.approvals.filter(a=>a.id!==id);await save();document.querySelector('#approvalBadge').textContent=snapshot.state.approvals.length;render();showToast(`${next} 단계로 이동했습니다.`);};
document.querySelector('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)navigate(b.dataset.view);});
document.querySelector('#newTaskBtn').addEventListener('click',openTask);document.querySelector('#closeDialog').addEventListener('click',()=>dialog.close());document.querySelector('#cancelDialog').addEventListener('click',()=>dialog.close());
document.querySelector('#refreshBtn').addEventListener('click',()=>load().then(()=>showToast('프로젝트 현황을 새로 읽었습니다.')).catch(e=>showToast(e.message)));
document.querySelector('#taskForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const task={id:crypto.randomUUID(),...data,updatedAt:new Date().toISOString()};snapshot.state.tasks.unshift(task);snapshot.state.activity.push({message:`새 업무 등록: ${task.title}`,at:task.updatedAt});await save();e.currentTarget.reset();dialog.close();render();showToast('업무를 저장했습니다.');});
load().catch(e=>{view.innerHTML=`<div class="empty-note">${escapeHtml(e.message)}<br>server.py로 실행했는지 확인하세요.</div>`;});
