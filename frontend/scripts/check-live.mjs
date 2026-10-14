import fs from 'node:fs';
const env=fs.readFileSync('../.env','utf8');
const get=name=>env.match(new RegExp(`^${name}\\s*=\\s*(.*)$`,'m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const base='https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api';
async function check(path,expected,options){const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(30000)});console.log(path,'status',response.status,'expected',expected);if(response.status!==expected)throw new Error('Live API check failed');return response;}
console.log('health',await(await check('/health',200)).json());
console.log('voice status',await(await check('/api/v1/voice/status',200)).json());
await check('/api/v1/me',401);
await check('/api/v1/admin/analytics',401);
await check('/api/v1/dashboard/complaints',401);
await check('/api/v1/auth/login',401,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'invalid-test-password'})});
const token=get('ADMIN_API_TOKEN');if(!token)throw new Error('Existing staff configuration unavailable');
await check('/api/v1/auth/login',200,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:token})});
await check('/api/v1/admin/analytics',200,{headers:{Authorization:`Bearer ${token}`}});
await check('/api/v1/dashboard/complaints',200,{headers:{Authorization:`Bearer ${token}`}});
console.log('Staff authentication and access controls passed. No private record bodies logged.');
