// Script to replace lines 3090-3302 in index.html with API-driven code
const fs = require('fs');
const file = 'index.html';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// New API-driven community code
const newCode = `/* ============ COMMUNITY — API-DRIVEN ============ */
const communityState = { projCat:'all', stratCat:'all', stratSort:'pnl' };
const catLabels = {nft_art:'NFT Art',defi:'DeFi',dev_tool:'Dev Tool',dao:'DAO',gamefi:'GameFi'};
const catIcons = {nft_art:'🎨',defi:'💰',dev_tool:'🛠️',dao:'🏛️',gamefi:'🎮'};
const stratCatLabels = {swing:'Swing',scalp:'Scalp',dca:'DCA',yield_farming:'Yield Farming',nft_flipping:'NFT Flipping',arbitrage:'Arbitrage'};
async function apiFetch(u,o){try{const r=await fetch(u,o);return r.ok?await r.json():null}catch{return null}}
function timeAgo(d){const s=Math.floor((Date.now()-new Date(d))/1000);if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d'}

async function renderProjects(){
  const el=$('#projectsList');if(!el)return;
  el.innerHTML='<div class="muted" style="text-align:center;padding:20px">Loading...</div>';
  const data=await apiFetch('/api/projects?category='+communityState.projCat+'&sort=upvotes');
  if(!data||!data.length){el.innerHTML='<div class="empty"><div class="em-ico">📦</div>No projects yet.</div>';return;}
  el.innerHTML=data.map(function(p){return'<div class="project-card '+(p.featured?'featured':'')+'"><div class="pc-top"><div class="pc-icon '+p.category+'">'+(catIcons[p.category]||'📦')+'</div><div style="flex:1"><div class="pc-name">'+p.name+'</div><div class="pc-cat">'+(catLabels[p.category]||p.category)+' · by '+(p.author?.display_name||p.user_id)+'</div></div></div><div class="pc-desc">'+p.description+'</div><span class="pc-chain">⛓️ '+(p.chain||'')+'</span><div class="pc-footer"><div class="pc-vote" onclick="event.stopPropagation();upvoteProject(\\''+p.id+'\\')">▲ '+p.upvotes+'</div><div class="pc-links">'+(p.website?'<a href="'+p.website+'" target="_blank" onclick="event.stopPropagation()">🌐 Site</a>':'')+(p.github?'<a href="'+p.github+'" target="_blank" onclick="event.stopPropagation()">💻 GitHub</a>':'')+'</div></div></div>'}).join('');
}
async function upvoteProject(id){await apiFetch('/api/projects/'+id+'/upvote',{method:'POST',headers:{'Content-Type':'application/json'}});toast('Voted!','ok');renderProjects();}
window.upvoteProject=upvoteProject;

async function renderStrategies(){
  const el=$('#strategiesList');if(!el)return;
  el.innerHTML='<div class="muted" style="text-align:center;padding:20px">Loading...</div>';
  const data=await apiFetch('/api/strategies?category='+communityState.stratCat+'&sort='+communityState.stratSort);
  if(!data||!data.length){el.innerHTML='<div class="empty"><div class="em-ico">📊</div>No strategies yet.</div>';return;}
  el.innerHTML=data.map(function(s){return'<div class="strat-card"><div class="sc-top"><div class="sc-avatar">'+(s.author?.display_name||s.user_id).slice(0,2).toUpperCase()+'</div><div style="flex:1"><div class="sc-name">'+s.name+'</div><div class="sc-user">by @'+(s.author?.display_name||s.user_id)+' · '+s.timeframe+'</div></div></div><div class="sc-thesis">"'+s.thesis+'"</div><div class="sc-meta"><span class="sc-tag '+s.category+'">'+(stratCatLabels[s.category]||s.category)+'</span><span class="sc-risk '+s.risk_level+'">'+(s.risk_level||'medium').toUpperCase()+' RISK</span>'+(s.assets||[]).map(function(a){return'<span class="sc-tag">'+a+'</span>'}).join('')+'</div><div class="sc-perf"><div class="sp"><div class="l">30d P&L</div><div class="v '+(s.pnl_30d>=0?'up':'dn')+'">'+(s.pnl_30d>=0?'+':'')+s.pnl_30d+'%</div></div><div class="sp"><div class="l">90d P&L</div><div class="v '+(s.pnl_90d>=0?'up':'dn')+'">'+(s.pnl_90d>=0?'+':'')+s.pnl_90d+'%</div></div><div class="sp"><div class="l">Followers</div><div class="v">'+s.followers_count+'</div></div></div><div class="sc-footer"><button class="sc-follow" onclick="event.stopPropagation();followStrategy(\\''+s.id+'\\')">Follow</button><span class="sc-followers">'+s.followers_count+' following</span></div></div>'}).join('');
}
async function followStrategy(id){await apiFetch('/api/strategies/'+id+'/follow',{method:'POST',headers:{'Content-Type':'application/json'}});toast('Updated!','ok');renderStrategies();}
window.followStrategy=followStrategy;

async function renderCommunityFeed(){
  const sf=$('#socialFeed');if(!sf)return;
  var comp='<div class="composer"><div class="c-av">🐋</div><div style="flex:1"><textarea class="c-input" id="postInput" placeholder="Share your alpha..."></textarea><div class="c-actions"><button class="c-post" id="postBtn">Post</button></div></div></div>';
  sf.innerHTML=comp+'<div class="muted" style="text-align:center;padding:12px">Loading feed...</div>';
  const data=await apiFetch('/api/posts');
  var html=(data||[]).map(function(p){return'<div class="post" style="margin-bottom:12px"><div class="pav">'+(p.author?.display_name||p.user_id).slice(0,2).toUpperCase()+'</div><div class="content"><div class="hd"><span class="u">@'+(p.author?.display_name||p.user_id)+'</span><span class="su">· '+timeAgo(p.created_at)+'</span></div><div class="bd">'+p.content+'</div><div class="tags" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+(p.tags||[]).map(function(t){return'<span style="font-size:11px;color:#c084fc">#'+t+'</span>'}).join('')+'</div><div class="reactions"><button onclick="reactPost(\\''+p.id+'\\',\\'fire\\')">🔥 '+(p.reactions?.fire||0)+'</button><button onclick="reactPost(\\''+p.id+'\\',\\'whale\\')">🐋 '+(p.reactions?.whale||0)+'</button><button onclick="reactPost(\\''+p.id+'\\',\\'diamond\\')">💎 '+(p.reactions?.diamond||0)+'</button><button onclick="reactPost(\\''+p.id+'\\',\\'rocket\\')">🚀 '+(p.reactions?.rocket||0)+'</button><button style="margin-left:auto">💬 '+(p.comments_count||0)+'</button></div></div></div>'}).join('');
  sf.innerHTML=comp+html;
  setTimeout(function(){$('#postBtn')?.addEventListener('click',async function(){var inp=$('#postInput'),txt=inp?.value?.trim();if(!txt){toast('Write something!','err');return;}var r=await apiFetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:txt,tags:[]})});if(r){inp.value='';toast('Posted! 🐋','ok');renderCommunityFeed();}});},50);
}
async function reactPost(id,type){await apiFetch('/api/posts/'+id+'/react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type})});renderCommunityFeed();}
window.reactPost=reactPost;

async function renderProfile(){
  var d=await apiFetch('/api/profile/demo_user');
  if(d){
    if($('#profileName'))$('#profileName').textContent=d.display_name||'Guest';
    if($('#profileRole'))$('#profileRole').textContent=d.role||'Explorer';
    if($('#profileBio'))$('#profileBio').textContent=d.bio||'';
    if($('#profFollowers'))$('#profFollowers').textContent=d.followers_count||0;
    if($('#profFollowing'))$('#profFollowing').textContent=d.following_count||0;
    if($('#profReputation'))$('#profReputation').textContent=d.reputation||0;
    if($('#profProjects'))$('#profProjects').textContent=d.projects_count||0;
    var bMap={whale:'🐋 Whale',investor:'💰 Investor',developer:'💻 Dev',early_adopter:'⚡ Early Adopter'};
    if($('#profileBadges'))$('#profileBadges').innerHTML=(d.badges||[]).map(function(b){return'<span class="badge '+b+'">'+(bMap[b]||b)+'</span>'}).join('');
  }
  var strats=await apiFetch('/api/strategies?sort=pnl');
  if($('#profileStrategies'))$('#profileStrategies').innerHTML=(strats||[]).slice(0,3).map(function(s){return'<div class="strat-card" style="margin-bottom:8px"><div class="sc-top"><div class="sc-avatar">'+(s.author?.display_name||'').slice(0,2).toUpperCase()+'</div><div style="flex:1"><div class="sc-name">'+s.name+'</div><div class="sc-user">'+s.category+' · '+(s.pnl_90d>=0?'+':'')+s.pnl_90d+'%</div></div></div></div>'}).join('')||'<div class="empty"><div class="em-ico">📊</div>No strategies.</div>';
  var projs=await apiFetch('/api/projects?sort=upvotes');
  if($('#profileProjects'))$('#profileProjects').innerHTML=(projs||[]).slice(0,3).map(function(p){return'<div class="project-card" style="margin-bottom:8px"><div class="pc-top"><div class="pc-icon '+p.category+'">'+(catIcons[p.category]||'📦')+'</div><div style="flex:1"><div class="pc-name">'+p.name+'</div><div class="pc-cat">'+(catLabels[p.category]||p.category)+'</div></div></div></div>'}).join('')||'<div class="empty"><div class="em-ico">🎨</div>No projects.</div>';
  var wl=ASSETS.filter(function(a){return state.watchlist.has(a.sym)});
  if($('#profileWatchlist'))$('#profileWatchlist').innerHTML=wl.length?wl.map(assetRowHtml).join(''):'<div class="empty"><div class="em-ico">⭐</div>No watchlist.</div>';
  wireAssetRows('#profileWatchlist');
}`;

// Lines are 0-indexed: replace lines 3089-3301 (which is 3090-3302 in 1-indexed)
const before = lines.slice(0, 3089);
const after = lines.slice(3302);
const result = [...before, newCode, ...after].join('\n');
fs.writeFileSync(file, result, 'utf8');
console.log('Done! Lines before:', lines.length, 'Lines after:', result.split('\n').length);
