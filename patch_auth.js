const fs=require('fs');
let c=fs.readFileSync('index.html','utf8');

// 1. Patch apiFetch to send x-user-id header from current session
const oldApiFetch="async function apiFetch(u,o){try{const r=await fetch(u,o);return r.ok?await r.json():null}catch{return null}}";
const newApiFetch=`async function apiFetch(u,o){
  try{
    if(!o)o={};
    if(!o.headers)o.headers={};
    // Send auth identity
    if(window.WV&&window.WV.user){
      o.headers['x-user-id']=window.WV.user.id;
      try{const s=await window.WV.supabase?.auth?.getSession();if(s?.data?.session?.access_token)o.headers['Authorization']='Bearer '+s.data.session.access_token;}catch{}
    }
    const r=await fetch(u,o);return r.ok?await r.json():null;
  }catch{return null}
}`;

if(c.includes(oldApiFetch)){
  c=c.replace(oldApiFetch,newApiFetch);
  console.log('✅ apiFetch patched with auth headers');
}else{
  console.log('⚠️ apiFetch not found exactly, trying partial match');
  c=c.replace(
    /async function apiFetch\(u,o\)\{try\{const r=await fetch\(u,o\);return r\.ok\?await r\.json\(\):null\}catch\{return null\}\}/,
    newApiFetch
  );
}

// 2. Patch the profile render to use the real user ID when logged in
const oldProfileFetch="var d=await apiFetch('/api/profile/demo_user');";
const newProfileFetch="var uid=(window.WV&&window.WV.user)?window.WV.user.id:'demo_user';var d=await apiFetch('/api/profile/'+uid);";
if(c.includes(oldProfileFetch)){
  c=c.replace(oldProfileFetch,newProfileFetch);
  console.log('✅ Profile fetch patched to use real user ID');
}

// 3. Add auto-create profile on first auth 
const oldOnAuth="// Sync data from cloud\n    syncFromCloud();";
const newOnAuth=`// Auto-create/update profile in Supabase
    apiFetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json','x-user-id':user.id},body:JSON.stringify({display_name:name,bio:'',role:'investor',social_links:{}})});
    // Sync data from cloud
    syncFromCloud();`;
if(c.includes(oldOnAuth)){
  c=c.replace(oldOnAuth,newOnAuth);
  console.log('✅ Auto-create profile on first login');
}else{
  // Try with \r\n
  const oldOnAuth2="// Sync data from cloud\r\n    syncFromCloud();";
  const newOnAuth2="// Auto-create/update profile in Supabase\r\n    apiFetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json','x-user-id':user.id},body:JSON.stringify({display_name:name,bio:'',role:'investor',social_links:{}})});\r\n    // Sync data from cloud\r\n    syncFromCloud();";
  if(c.includes(oldOnAuth2)){
    c=c.replace(oldOnAuth2,newOnAuth2);
    console.log('✅ Auto-create profile on first login (CRLF)');
  }
}

// 4. Update profile tab header to show real name
const oldProfileName="$('#profileName').textContent=d.display_name||'Guest';";
const newProfileName="$('#profileName').textContent=d.display_name||(window.WV&&window.WV.user?window.WV.user.user_metadata?.full_name:'Guest')||'Guest';";
if(c.includes(oldProfileName)){
  c=c.replace(oldProfileName,newProfileName);
  console.log('✅ Profile name uses auth metadata');
}

fs.writeFileSync('index.html',c,'utf8');
console.log('Done. File size:',c.length);
