const fs=require('fs');
let c=fs.readFileSync('server.js','utf8');

// Replace lines 310-516 (in-memory store + CRUD) with Supabase-backed versions
const OLD_START='// Community Data — In-Memory Store';
const OLD_END="app.get('*', (req, res) => res.sendFile";
const si=c.indexOf(OLD_START);
const ei=c.indexOf(OLD_END);
if(si===-1||ei===-1){console.log('Markers not found',si,ei);process.exit(1);}

const NEW_CODE=`// Community Data — Supabase + In-Memory Fallback
let nextId=1;const uid=()=>'id_'+(nextId++);const now=()=>new Date().toISOString();
const store={posts:[],projects:[],strategies:[],comments:[],reactions:[],follows:[],upvotes:[],profiles:new Map()};
const db=supabaseAdmin; // shorthand

function seedData(){
  const users=['demo_user','whale_hunter','nft_sniper','defi_degen','solana_chad','1min_king','arb_bot'];
  users.forEach(u=>store.profiles.set(u,{id:u,display_name:u.replace(/_/g,' '),bio:'Active community member',role:'investor',badges:['early_adopter'],reputation:Math.floor(Math.random()*200)+20,social_links:{},wallet_addresses:[],followers_count:Math.floor(Math.random()*100),following_count:Math.floor(Math.random()*50)}));
  store.profiles.get('demo_user').display_name='Mobidic Explorer';
  store.profiles.get('demo_user').badges=['whale','investor','early_adopter'];
  [
    {user_id:'whale_hunter',content:'BTC accumulation pattern on weekly. Institutions loading up 🐋💎',tags:['BTC','WhaleAlert']},
    {user_id:'nft_sniper',content:'New Art Blocks drop this Friday. Ocean-depth visuals 🎨🌊',tags:['NFT','ArtBlocks']},
    {user_id:'defi_degen',content:'Moved 80% ETH from Lido to EigenLayer restaking 👇',tags:['DeFi','Yield','ETH']},
    {user_id:'solana_chad',content:'SOL broke $185 resistance. Swing from $172 printing 📈',tags:['SOL','Trading']},
    {user_id:'1min_king',content:'Scalping: 5/5 wins, +4.2%. US open AVAX volatility ⚡',tags:['Scalping','AVAX']},
  ].forEach(p=>{store.posts.push({id:uid(),...p,reactions:{fire:Math.floor(Math.random()*200),whale:Math.floor(Math.random()*80),diamond:Math.floor(Math.random()*150),rocket:Math.floor(Math.random()*100)},comments_count:Math.floor(Math.random()*50),created_at:now()});});
  [
    {user_id:'nft_sniper',name:'Bored Apes Yacht Club',category:'nft_art',description:'10K unique collectibles on Ethereum.',chain:'Ethereum',website:'https://boredapeyachtclub.com',github:'',upvotes:842,featured:true},
    {user_id:'defi_degen',name:'Uniswap V4',category:'defi',description:'Leading DEX with hooks for pool logic.',chain:'Ethereum',website:'https://uniswap.org',github:'https://github.com/Uniswap',upvotes:1247,featured:true},
    {user_id:'arb_bot',name:'Hardhat Framework',category:'dev_tool',description:'Ethereum dev environment for pros.',chain:'Multi-chain',website:'https://hardhat.org',github:'https://github.com/NomicFoundation/hardhat',upvotes:934,featured:false},
    {user_id:'whale_hunter',name:'MakerDAO',category:'dao',description:'Decentralized governance for DAI.',chain:'Ethereum',website:'https://makerdao.com',github:'https://github.com/makerdao',upvotes:712,featured:false},
    {user_id:'solana_chad',name:'Jupiter Exchange',category:'defi',description:'Leading Solana DEX aggregator.',chain:'Solana',website:'https://jup.ag',github:'https://github.com/jup-ag',upvotes:673,featured:false},
    {user_id:'arb_bot',name:'Foundry',category:'dev_tool',description:'Blazing fast Ethereum toolkit in Rust.',chain:'Multi-chain',website:'https://getfoundry.sh',github:'https://github.com/foundry-rs',upvotes:889,featured:false},
  ].forEach(p=>{store.projects.push({id:uid(),...p,image_url:'',created_at:now()});});
  [
    {user_id:'whale_hunter',name:'BTC Accumulation DCA',category:'dca',thesis:'DCA into BTC weekly.',assets:['BTC'],timeframe:'Weekly',risk_level:'low',pnl_30d:12.4,pnl_90d:28.7,followers_count:342},
    {user_id:'solana_chad',name:'SOL Momentum Swing',category:'swing',thesis:'Ride SOL/USDT on 4H chart.',assets:['SOL','JUP'],timeframe:'4H-Daily',risk_level:'medium',pnl_30d:18.6,pnl_90d:42.1,followers_count:217},
    {user_id:'defi_degen',name:'ETH Yield Maximizer',category:'yield_farming',thesis:'Rotate between Aave, Lido, EigenLayer.',assets:['ETH','stETH'],timeframe:'Weekly',risk_level:'medium',pnl_30d:4.8,pnl_90d:14.2,followers_count:189},
    {user_id:'1min_king',name:'Altcoin Scalper',category:'scalp',thesis:'Quick 1-3% scalps during US hours.',assets:['SOL','AVAX','LINK'],timeframe:'1m-5m',risk_level:'high',pnl_30d:22.1,pnl_90d:51.8,followers_count:423},
    {user_id:'arb_bot',name:'Cross-DEX Arbitrage',category:'arbitrage',thesis:'Automated arb between DEXs.',assets:['Multi'],timeframe:'Continuous',risk_level:'low',pnl_30d:3.2,pnl_90d:9.8,followers_count:98},
  ].forEach(s=>{store.strategies.push({id:uid(),...s,is_public:true,created_at:now()});});
}
seedData();

// Seed Supabase on first boot if tables are empty
async function seedSupabase(){
  if(!db)return;
  try{
    const{data}=await db.from('community_posts').select('id').limit(1);
    if(data&&data.length>0)return; // already seeded
    // Seed profiles
    for(const[uid,p]of store.profiles){
      await db.from('profiles').upsert({user_id:uid,display_name:p.display_name,bio:p.bio,role:p.role,badges:p.badges,reputation:p.reputation,social_links:p.social_links||{},wallet_addresses:p.wallet_addresses||[],followers_count:p.followers_count,following_count:p.following_count},{onConflict:'user_id'});
    }
    // Seed posts
    for(const p of store.posts){await db.from('community_posts').insert({user_id:p.user_id,content:p.content,tags:p.tags,reactions:p.reactions,comments_count:p.comments_count});}
    // Seed projects
    for(const p of store.projects){await db.from('projects').insert({user_id:p.user_id,name:p.name,category:p.category,description:p.description,chain:p.chain,website:p.website,github:p.github,upvotes:p.upvotes,featured:p.featured});}
    // Seed strategies
    for(const s of store.strategies){await db.from('strategies').insert({user_id:s.user_id,name:s.name,category:s.category,thesis:s.thesis,assets:s.assets,timeframe:s.timeframe,risk_level:s.risk_level,pnl_30d:s.pnl_30d,pnl_90d:s.pnl_90d,followers_count:s.followers_count});}
    console.log('  📦 Supabase seeded with demo data');
  }catch(e){console.warn('  ⚠️  Seed failed:',e.message);}
}
seedSupabase();

function getSessionUser(req){return req.headers['x-user-id']||req.query.uid||'demo_user';}

// Helper: get profile (DB first, fallback to memory)
async function getProfile(uid){
  if(db){
    const{data}=await db.from('profiles').select('*').eq('user_id',uid).single();
    if(data)return data;
  }
  return store.profiles.get(uid)||{display_name:uid,badges:[]};
}

// ── Posts ──
app.get('/api/posts', async(req,res)=>{
  try{
    if(db){
      const{data,error}=await db.from('community_posts').select('*').order('created_at',{ascending:false}).limit(50);
      if(error)throw error;
      const posts=[];
      for(const p of data){posts.push({...p,author:await getProfile(p.user_id)});}
      return res.json(posts);
    }
    const posts=store.posts.map(p=>({...p,author:store.profiles.get(p.user_id)||{display_name:p.user_id}}));
    posts.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    res.json(posts);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/posts', async(req,res)=>{
  const{content,tags}=req.body;
  if(!content||!content.trim())return res.status(400).json({error:'Content required'});
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data,error}=await db.from('community_posts').insert({user_id,content:content.trim(),tags:tags||[],reactions:{fire:0,whale:0,diamond:0,rocket:0},comments_count:0}).select().single();
      if(error)throw error;
      broadcast({type:'new_post',data:{...data,author:await getProfile(user_id)}});
      return res.status(201).json(data);
    }
    const post={id:uid(),user_id,content:content.trim(),tags:tags||[],reactions:{fire:0,whale:0,diamond:0,rocket:0},comments_count:0,created_at:now()};
    store.posts.unshift(post);
    broadcast({type:'new_post',data:{...post,author:store.profiles.get(user_id)}});
    res.status(201).json(post);
  }catch(e){res.status(500).json({error:e.message});}
});

app.delete('/api/posts/:id', async(req,res)=>{
  try{
    if(db){const{error}=await db.from('community_posts').delete().eq('id',req.params.id);if(error)throw error;return res.json({ok:true});}
    const idx=store.posts.findIndex(p=>p.id===req.params.id);if(idx===-1)return res.status(404).json({error:'Not found'});
    store.posts.splice(idx,1);res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/posts/:id/react', async(req,res)=>{
  const{type}=req.body;
  if(!['fire','whale','diamond','rocket'].includes(type))return res.status(400).json({error:'Invalid reaction'});
  try{
    if(db){
      const{data:post}=await db.from('community_posts').select('reactions').eq('id',req.params.id).single();
      if(!post)return res.status(404).json({error:'Not found'});
      const r=post.reactions||{fire:0,whale:0,diamond:0,rocket:0};r[type]=(r[type]||0)+1;
      await db.from('community_posts').update({reactions:r}).eq('id',req.params.id);
      return res.json({reactions:r});
    }
    const post=store.posts.find(p=>p.id===req.params.id);if(!post)return res.status(404).json({error:'Not found'});
    post.reactions[type]=(post.reactions[type]||0)+1;res.json({reactions:post.reactions});
  }catch(e){res.status(500).json({error:e.message});}
});

// ── Projects ──
app.get('/api/projects', async(req,res)=>{
  try{
    if(db){
      let q=db.from('projects').select('*');
      if(req.query.category&&req.query.category!=='all')q=q.eq('category',req.query.category);
      const sort=req.query.sort||'upvotes';
      if(sort==='upvotes')q=q.order('upvotes',{ascending:false});
      else q=q.order('created_at',{ascending:false});
      const{data,error}=await q.limit(50);if(error)throw error;
      const list=[];for(const p of data){list.push({...p,author:await getProfile(p.user_id)});}
      return res.json(list);
    }
    let list=[...store.projects];
    if(req.query.category&&req.query.category!=='all')list=list.filter(p=>p.category===req.query.category);
    if((req.query.sort||'upvotes')==='upvotes')list.sort((a,b)=>b.upvotes-a.upvotes);
    else list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    list=list.map(p=>({...p,author:store.profiles.get(p.user_id)||{display_name:p.user_id}}));
    res.json(list);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/projects', async(req,res)=>{
  const{name,category,description,website,github,chain}=req.body;
  if(!name||!category||!description)return res.status(400).json({error:'Name, category, description required'});
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data,error}=await db.from('projects').insert({user_id,name,category,description,website:website||'',github:github||'',chain:chain||'',upvotes:0,featured:false}).select().single();
      if(error)throw error;return res.status(201).json(data);
    }
    const project={id:uid(),user_id,name,category,description,website:website||'',github:github||'',chain:chain||'',image_url:'',upvotes:0,featured:false,created_at:now()};
    store.projects.unshift(project);res.status(201).json(project);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/projects/:id/upvote', async(req,res)=>{
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data:existing}=await db.from('upvotes').select('id').eq('user_id',user_id).eq('project_id',req.params.id).single();
      if(existing){
        await db.from('upvotes').delete().eq('id',existing.id);
        await db.from('projects').update({upvotes:db.rpc?0:0}).eq('id',req.params.id); // decrement handled below
        const{data:proj}=await db.from('projects').select('upvotes').eq('id',req.params.id).single();
        if(proj){await db.from('projects').update({upvotes:Math.max(0,proj.upvotes-1)}).eq('id',req.params.id);}
        return res.json({upvotes:(proj?.upvotes||1)-1,voted:false});
      }else{
        await db.from('upvotes').insert({user_id,project_id:req.params.id});
        const{data:proj}=await db.from('projects').select('upvotes').eq('id',req.params.id).single();
        if(proj){await db.from('projects').update({upvotes:proj.upvotes+1}).eq('id',req.params.id);}
        return res.json({upvotes:(proj?.upvotes||0)+1,voted:true});
      }
    }
    const project=store.projects.find(p=>p.id===req.params.id);if(!project)return res.status(404).json({error:'Not found'});
    const ex=store.upvotes.find(u=>u.user_id===user_id&&u.project_id===req.params.id);
    if(ex){store.upvotes=store.upvotes.filter(u=>u!==ex);project.upvotes=Math.max(0,project.upvotes-1);}
    else{store.upvotes.push({user_id,project_id:req.params.id});project.upvotes++;}
    res.json({upvotes:project.upvotes,voted:!ex});
  }catch(e){res.status(500).json({error:e.message});}
});

// ── Strategies ──
app.get('/api/strategies', async(req,res)=>{
  try{
    if(db){
      let q=db.from('strategies').select('*');
      if(req.query.category&&req.query.category!=='all')q=q.eq('category',req.query.category);
      const sort=req.query.sort||'pnl';
      if(sort==='pnl')q=q.order('pnl_90d',{ascending:false});
      else if(sort==='followers')q=q.order('followers_count',{ascending:false});
      else q=q.order('created_at',{ascending:false});
      const{data,error}=await q.limit(50);if(error)throw error;
      const list=[];for(const s of data){list.push({...s,author:await getProfile(s.user_id)});}
      return res.json(list);
    }
    let list=[...store.strategies];
    if(req.query.category&&req.query.category!=='all')list=list.filter(s=>s.category===req.query.category);
    const sort=req.query.sort||'pnl';
    if(sort==='pnl')list.sort((a,b)=>b.pnl_90d-a.pnl_90d);
    else if(sort==='followers')list.sort((a,b)=>b.followers_count-a.followers_count);
    list=list.map(s=>({...s,author:store.profiles.get(s.user_id)||{display_name:s.user_id}}));
    res.json(list);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/strategies', async(req,res)=>{
  const{name,category,thesis,assets,timeframe,risk_level}=req.body;
  if(!name||!category||!thesis)return res.status(400).json({error:'Name, category, thesis required'});
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data,error}=await db.from('strategies').insert({user_id,name,category,thesis,assets:assets||[],timeframe:timeframe||'',risk_level:risk_level||'medium',pnl_30d:0,pnl_90d:0,followers_count:0}).select().single();
      if(error)throw error;return res.status(201).json(data);
    }
    const s={id:uid(),user_id,name,category,thesis,assets:assets||[],timeframe:timeframe||'',risk_level:risk_level||'medium',pnl_30d:0,pnl_90d:0,followers_count:0,is_public:true,created_at:now()};
    store.strategies.unshift(s);res.status(201).json(s);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/strategies/:id/follow', async(req,res)=>{
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data:existing}=await db.from('follows').select('id').eq('follower_id',user_id).eq('following_id',req.params.id).eq('follow_type','strategy').single();
      if(existing){
        await db.from('follows').delete().eq('id',existing.id);
        const{data:s}=await db.from('strategies').select('followers_count').eq('id',req.params.id).single();
        if(s){await db.from('strategies').update({followers_count:Math.max(0,s.followers_count-1)}).eq('id',req.params.id);}
        return res.json({followers_count:(s?.followers_count||1)-1,following:false});
      }else{
        await db.from('follows').insert({follower_id:user_id,following_id:req.params.id,follow_type:'strategy'});
        const{data:s}=await db.from('strategies').select('followers_count').eq('id',req.params.id).single();
        if(s){await db.from('strategies').update({followers_count:s.followers_count+1}).eq('id',req.params.id);}
        return res.json({followers_count:(s?.followers_count||0)+1,following:true});
      }
    }
    const strategy=store.strategies.find(s=>s.id===req.params.id);if(!strategy)return res.status(404).json({error:'Not found'});
    const ex=store.follows.find(f=>f.follower_id===user_id&&f.following_id===req.params.id);
    if(ex){store.follows=store.follows.filter(f=>f!==ex);strategy.followers_count=Math.max(0,strategy.followers_count-1);}
    else{store.follows.push({follower_id:user_id,following_id:req.params.id,created_at:now()});strategy.followers_count++;}
    res.json({followers_count:strategy.followers_count,following:!ex});
  }catch(e){res.status(500).json({error:e.message});}
});

// ── Profile ──
app.get('/api/profile/:id', async(req,res)=>{
  try{
    const profile=await getProfile(req.params.id);
    if(!profile||(!profile.id&&!profile.user_id))return res.status(404).json({error:'Not found'});
    if(db){
      const{count:pc}=await db.from('community_posts').select('*',{count:'exact',head:true}).eq('user_id',req.params.id);
      const{count:prc}=await db.from('projects').select('*',{count:'exact',head:true}).eq('user_id',req.params.id);
      const{count:sc}=await db.from('strategies').select('*',{count:'exact',head:true}).eq('user_id',req.params.id);
      return res.json({...profile,posts_count:pc||0,projects_count:prc||0,strategies_count:sc||0});
    }
    res.json({...profile,posts_count:store.posts.filter(p=>p.user_id===req.params.id).length,projects_count:store.projects.filter(p=>p.user_id===req.params.id).length,strategies_count:store.strategies.filter(s=>s.user_id===req.params.id).length});
  }catch(e){res.status(500).json({error:e.message});}
});

app.put('/api/profile', async(req,res)=>{
  const user_id=getSessionUser(req);
  const{display_name,bio,role,social_links,wallet_addresses}=req.body;
  try{
    if(db){
      const updates={};
      if(display_name)updates.display_name=display_name;
      if(bio!==undefined)updates.bio=bio;
      if(role)updates.role=role;
      if(social_links)updates.social_links=social_links;
      if(wallet_addresses)updates.wallet_addresses=wallet_addresses;
      updates.updated_at=now();
      const{data,error}=await db.from('profiles').upsert({user_id,...updates},{onConflict:'user_id'}).select().single();
      if(error)throw error;return res.json(data);
    }
    const existing=store.profiles.get(user_id)||{id:user_id,badges:['early_adopter'],reputation:0,followers_count:0,following_count:0};
    const updated={...existing,...(display_name&&{display_name}),...(bio!==undefined&&{bio}),...(role&&{role}),...(social_links&&{social_links}),...(wallet_addresses&&{wallet_addresses})};
    store.profiles.set(user_id,updated);res.json(updated);
  }catch(e){res.status(500).json({error:e.message});}
});

// ── Comments ──
app.get('/api/comments/:parentType/:parentId', async(req,res)=>{
  const{parentType,parentId}=req.params;
  try{
    if(db){
      const{data,error}=await db.from('comments').select('*').eq('parent_type',parentType).eq('parent_id',parentId).order('created_at',{ascending:false});
      if(error)throw error;
      const list=[];for(const c of data){list.push({...c,author:await getProfile(c.user_id)});}
      return res.json(list);
    }
    const comments=store.comments.filter(c=>c.parent_type===parentType&&c.parent_id===parentId).map(c=>({...c,author:store.profiles.get(c.user_id)||{display_name:c.user_id}}));
    res.json(comments);
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/comments', async(req,res)=>{
  const{parent_type,parent_id,content}=req.body;
  if(!parent_type||!parent_id||!content?.trim())return res.status(400).json({error:'parent_type, parent_id, content required'});
  const user_id=getSessionUser(req);
  try{
    if(db){
      const{data,error}=await db.from('comments').insert({user_id,parent_type,parent_id,content:content.trim()}).select().single();
      if(error)throw error;
      if(parent_type==='post'){
        const{data:post}=await db.from('community_posts').select('comments_count').eq('id',parent_id).single();
        if(post)await db.from('community_posts').update({comments_count:(post.comments_count||0)+1}).eq('id',parent_id);
      }
      return res.status(201).json({...data,author:await getProfile(user_id)});
    }
    const comment={id:uid(),user_id,parent_type,parent_id,content:content.trim(),created_at:now()};
    store.comments.push(comment);
    if(parent_type==='post'){const p=store.posts.find(x=>x.id===parent_id);if(p)p.comments_count++;}
    res.status(201).json({...comment,author:store.profiles.get(user_id)});
  }catch(e){res.status(500).json({error:e.message});}
});

// ── SPA fallback ──
`;

// Find and replace
const before=c.substring(0,si);
const after=c.substring(ei);
c=before+NEW_CODE+after;
fs.writeFileSync('server.js',c,'utf8');
console.log('✅ Server patched with Supabase CRUD. Size:',c.length);
