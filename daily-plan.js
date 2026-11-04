export function makeDailyPlan(material, minutes=90) {
  const total=Math.max(5,Math.min(480,Number.isFinite(+minutes)?Math.floor(+minutes):90));
  const tasks=[];
  if(material.vocabulary?.length)tasks.push({id:'vocab',label:`词汇：复习并学习，最多 ${Math.min(20,material.vocabulary.length)} 个新词`,weight:3});
  if(material.listening?.question||material.listening?.questions?.length||material.listening?.transcript)tasks.push({id:'listening',label:'听力：先听作答，再核对原文与讲解',weight:3});
  if(material.reading?.passage||material.reading?.question||material.reading?.questions?.length)tasks.push({id:'reading',label:'阅读：完成题目并订正',weight:3});
  if(material.writing||material.translation)tasks.push({id:'output',label:'表达：写作或翻译，并修改问题',weight:2});
  if(!tasks.length)return [];
  const weights=tasks.reduce((n,t)=>n+t.weight,0);let allocated=0;
  return tasks.map((t,i)=>{const time=i===tasks.length-1?total-allocated:Math.floor(total*t.weight/weights);allocated+=time;return {...t,minutes:time}});
}
export function renderDailyPlan(root, material, exam, minutes, storage=localStorage, date=new Date()) {
  root.replaceChildren();const plan=makeDailyPlan(material,minutes);if(!plan.length)return;
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const key='english-prep-training-v1:'+exam+':daily';let data={};try{data=JSON.parse(storage.getItem(key)||'{}')}catch{}
  if(!data||typeof data!=='object'||Array.isArray(data))data={};data[day] ||= {};
  const h=document.createElement('h3');h.textContent='今日安排';const info=document.createElement('p');info.textContent='按现有材料分配时间；做不完明天重新安排，不累计任务。完成后可手动标记。';root.append(h,info);
  for(const item of plan){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=!!data[day][item.id];box.onchange=()=>{data[day][item.id]=box.checked;storage.setItem(key,JSON.stringify(data))};label.append(box,document.createTextNode(` ${item.label} · ${item.minutes} 分钟`));root.append(label)}
}
