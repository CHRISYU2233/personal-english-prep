export async function askAI({key,model,messages,endpoint='https://openrouter.ai/api/v1/chat/completions',fetcher=fetch}) {
  if(typeof key!=='string'||!key.trim()||typeof model!=='string'||!model.trim()) throw Error('请填写 OpenRouter 密钥与模型 ID。');
  let address;try{address=new URL(endpoint)}catch{throw Error('请输入有效的 AI 服务地址。')}if(address.protocol!=='https:'||address.username||address.password||address.hash||address.search)throw Error('AI 服务地址须为不含凭据或参数的 HTTPS 地址。');
  const response=await fetcher(address.href,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key.trim()},body:JSON.stringify({model:model.trim(),messages}),signal:AbortSignal.timeout(60000)});
  if(!response.ok){let message='';try{const body=await response.json();message=String(body?.error?.message||'')}catch{}if(response.status===403&&/region|country|geographic|location/i.test(message))throw Error('AI 服务拒绝了当前地区的模型请求（HTTP 403）。请查看服务商的地区支持，或使用可在当地合法使用的服务。');if(response.status===401)throw Error('AI 密钥无效或已失效（HTTP 401）。');if(response.status===402)throw Error('AI 服务余额或额度不足（HTTP 402）。');if(response.status===429)throw Error('AI 请求过于频繁，请稍后重试（HTTP 429）。');throw Error('AI 请求未完成（HTTP '+response.status+'），请检查模型和服务商状态。')}
  const data=await response.json(),text=data.choices?.[0]?.message?.content;
  if(typeof text!=='string'||!text.trim())throw Error('AI 没有返回可读取的内容。');
  return text;
}
