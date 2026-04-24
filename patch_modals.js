const fs = require('fs');
const file = 'index.html';
let content = fs.readFileSync(file, 'utf8');

// ── 1. Add Modal HTML after </nav> ──
const modalHTML = `
<!-- PROJECT SUBMISSION MODAL -->
<div class="mob-modal-overlay" id="projectModalOverlay" style="display:none">
  <div class="mob-modal">
    <div class="mob-modal-header">
      <h3>📦 Submit a Project</h3>
      <button class="mob-modal-close" onclick="closeModal('projectModalOverlay')">&times;</button>
    </div>
    <form id="projectForm" class="mob-modal-form">
      <input type="text" id="pf-name" placeholder="Project Name *" required>
      <select id="pf-category" required>
        <option value="">Select Category *</option>
        <option value="nft_art">🎨 NFT Art</option>
        <option value="defi">💰 DeFi</option>
        <option value="dev_tool">🛠️ Dev Tool</option>
        <option value="dao">🏛️ DAO</option>
        <option value="gamefi">🎮 GameFi</option>
        <option value="infrastructure">⚙️ Infrastructure</option>
      </select>
      <textarea id="pf-desc" placeholder="Description *" rows="3" required></textarea>
      <input type="text" id="pf-chain" placeholder="Chain (e.g. Ethereum, Solana)">
      <input type="url" id="pf-website" placeholder="Website URL">
      <input type="url" id="pf-github" placeholder="GitHub URL">
      <button type="submit" class="mob-modal-submit" style="background:linear-gradient(135deg,#c084fc,#06b6d4)">Submit Project 🚀</button>
    </form>
  </div>
</div>

<!-- STRATEGY SHARING MODAL -->
<div class="mob-modal-overlay" id="strategyModalOverlay" style="display:none">
  <div class="mob-modal">
    <div class="mob-modal-header">
      <h3>📊 Share a Strategy</h3>
      <button class="mob-modal-close" onclick="closeModal('strategyModalOverlay')">&times;</button>
    </div>
    <form id="strategyForm" class="mob-modal-form">
      <input type="text" id="sf-name" placeholder="Strategy Name *" required>
      <select id="sf-category" required>
        <option value="">Select Category *</option>
        <option value="swing">📈 Swing</option>
        <option value="scalp">⚡ Scalp</option>
        <option value="dca">🔄 DCA</option>
        <option value="yield_farming">🌾 Yield Farming</option>
        <option value="nft_flipping">🖼️ NFT Flip</option>
        <option value="arbitrage">🔀 Arbitrage</option>
      </select>
      <textarea id="sf-thesis" placeholder="Your thesis — why does this work? *" rows="3" required></textarea>
      <input type="text" id="sf-assets" placeholder="Assets (comma-separated, e.g. BTC, ETH, SOL)">
      <input type="text" id="sf-timeframe" placeholder="Timeframe (e.g. 4H-Daily, Weekly)">
      <select id="sf-risk">
        <option value="medium">⚠️ Medium Risk</option>
        <option value="low">🟢 Low Risk</option>
        <option value="high">🔴 High Risk</option>
      </select>
      <button type="submit" class="mob-modal-submit" style="background:linear-gradient(135deg,#fb923c,#ff6b9d)">Share Strategy 📈</button>
    </form>
  </div>
</div>

<!-- PROFILE EDIT MODAL -->
<div class="mob-modal-overlay" id="profileModalOverlay" style="display:none">
  <div class="mob-modal">
    <div class="mob-modal-header">
      <h3>✏️ Edit Profile</h3>
      <button class="mob-modal-close" onclick="closeModal('profileModalOverlay')">&times;</button>
    </div>
    <form id="profileForm" class="mob-modal-form">
      <input type="text" id="ef-name" placeholder="Display Name">
      <select id="ef-role">
        <option value="investor">💰 Investor</option>
        <option value="developer">💻 Developer</option>
        <option value="artist">🎨 Artist</option>
        <option value="analyst">📊 Analyst</option>
        <option value="trader">📈 Trader</option>
      </select>
      <textarea id="ef-bio" placeholder="Bio — tell the community about yourself" rows="3"></textarea>
      <input type="url" id="ef-twitter" placeholder="Twitter/X URL">
      <input type="url" id="ef-discord" placeholder="Discord invite URL">
      <input type="url" id="ef-github" placeholder="GitHub URL">
      <button type="submit" class="mob-modal-submit">Save Profile ✨</button>
    </form>
  </div>
</div>
`;

// Insert after </nav>
content = content.replace('</nav>\r\n\r\n<!-- DRAWER -->', modalHTML + '\n<!-- DRAWER -->');
if (!content.includes('mob-modal-overlay')) {
  // Try without \r\n
  content = content.replace('</nav>\n\n<!-- DRAWER -->', modalHTML + '\n<!-- DRAWER -->');
}

// ── 2. Add Modal CSS ──
const modalCSS = `
/* ── Community Modals ── */
.mob-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
.mob-modal{background:#1a1a2e;border:1px solid rgba(255,255,255,.08);border-radius:16px;width:90%;max-width:420px;max-height:85vh;overflow-y:auto;padding:0}
.mob-modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
.mob-modal-header h3{margin:0;font-size:17px;color:#fff;font-weight:600}
.mob-modal-close{background:none;border:none;color:#999;font-size:24px;cursor:pointer;padding:0 4px}
.mob-modal-close:hover{color:#fff}
.mob-modal-form{padding:16px 20px 20px;display:flex;flex-direction:column;gap:12px}
.mob-modal-form input,.mob-modal-form select,.mob-modal-form textarea{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 14px;color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border .2s}
.mob-modal-form input:focus,.mob-modal-form select:focus,.mob-modal-form textarea:focus{border-color:#c084fc}
.mob-modal-form select{appearance:none;cursor:pointer}
.mob-modal-form textarea{resize:vertical;min-height:60px}
.mob-modal-form input::placeholder,.mob-modal-form textarea::placeholder{color:rgba(255,255,255,.3)}
.mob-modal-submit{background:linear-gradient(135deg,#c084fc,#06b6d4);border:none;border-radius:10px;padding:14px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;transition:transform .15s,opacity .15s}
.mob-modal-submit:hover{transform:scale(1.02)}
.mob-modal-submit:active{transform:scale(.98);opacity:.9}
`;

// Insert CSS before the closing </style> of the main styles
const lastStyleClose = content.lastIndexOf('</style>');
if (lastStyleClose > -1) {
  content = content.slice(0, lastStyleClose) + modalCSS + '\n' + content.slice(lastStyleClose);
}

// ── 3. Replace toast handlers with modal openers + add modal JS ──
const oldToasts = "  $('#submitProjectBtn')?.addEventListener('click',()=>{ toast('Project submission \\u2014 coming soon! \\ud83d\\ude80','ok'); });\r\n  $('#shareStrategyBtn')?.addEventListener('click',()=>{ toast('Strategy sharing \\u2014 coming soon! \\ud83d\\udcc8','ok'); });\r\n  $('#editProfileBtn')?.addEventListener('click',()=>{ toast('Profile editor \\u2014 coming soon! \\u270f\\ufe0f','ok'); });";

const newHandlers = `  $('#submitProjectBtn')?.addEventListener('click',()=>{ document.getElementById('projectModalOverlay').style.display='flex'; });
  $('#shareStrategyBtn')?.addEventListener('click',()=>{ document.getElementById('strategyModalOverlay').style.display='flex'; });
  $('#editProfileBtn')?.addEventListener('click',()=>{ loadProfileIntoEditor(); document.getElementById('profileModalOverlay').style.display='flex'; });`;

content = content.replace(oldToasts, newHandlers);

// ── 4. Add modal form submission JS before closing </script> ──
const modalJS = `

  /* ── Modal Helpers ── */
  window.closeModal = function(id){ document.getElementById(id).style.display='none'; };
  document.querySelectorAll('.mob-modal-overlay').forEach(o=>{
    o.addEventListener('click',function(e){if(e.target===o)o.style.display='none';});
  });

  /* ── Project Submission ── */
  document.getElementById('projectForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const name = document.getElementById('pf-name').value.trim();
    const category = document.getElementById('pf-category').value;
    const description = document.getElementById('pf-desc').value.trim();
    const chain = document.getElementById('pf-chain').value.trim();
    const website = document.getElementById('pf-website').value.trim();
    const github = document.getElementById('pf-github').value.trim();
    if(!name||!category||!description){toast('Fill all required fields','err');return;}
    const r = await apiFetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category,description,chain,website,github})});
    if(r){toast('Project submitted! 🚀','ok');closeModal('projectModalOverlay');this.reset();renderProjects();}
    else toast('Failed to submit','err');
  });

  /* ── Strategy Submission ── */
  document.getElementById('strategyForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const name = document.getElementById('sf-name').value.trim();
    const category = document.getElementById('sf-category').value;
    const thesis = document.getElementById('sf-thesis').value.trim();
    const assets = document.getElementById('sf-assets').value.split(',').map(a=>a.trim()).filter(Boolean);
    const timeframe = document.getElementById('sf-timeframe').value.trim();
    const risk_level = document.getElementById('sf-risk').value;
    if(!name||!category||!thesis){toast('Fill all required fields','err');return;}
    const r = await apiFetch('/api/strategies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category,thesis,assets,timeframe,risk_level})});
    if(r){toast('Strategy shared! 📈','ok');closeModal('strategyModalOverlay');this.reset();renderStrategies();}
    else toast('Failed to share','err');
  });

  /* ── Profile Edit ── */
  window.loadProfileIntoEditor = async function(){
    const d = await apiFetch('/api/profile/demo_user');
    if(d){
      document.getElementById('ef-name').value=d.display_name||'';
      document.getElementById('ef-role').value=d.role||'investor';
      document.getElementById('ef-bio').value=d.bio||'';
      document.getElementById('ef-twitter').value=d.social_links?.twitter||'';
      document.getElementById('ef-discord').value=d.social_links?.discord||'';
      document.getElementById('ef-github').value=d.social_links?.github||'';
    }
  };
  document.getElementById('profileForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const display_name = document.getElementById('ef-name').value.trim();
    const role = document.getElementById('ef-role').value;
    const bio = document.getElementById('ef-bio').value.trim();
    const social_links = {
      twitter: document.getElementById('ef-twitter').value.trim(),
      discord: document.getElementById('ef-discord').value.trim(),
      github: document.getElementById('ef-github').value.trim()
    };
    const r = await apiFetch('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({display_name,role,bio,social_links})});
    if(r){toast('Profile updated! ✨','ok');closeModal('profileModalOverlay');renderProfile();}
    else toast('Failed to update','err');
  });
`;

// Insert before last </script>
const lastScriptClose = content.lastIndexOf('</script>');
if (lastScriptClose > -1) {
  content = content.slice(0, lastScriptClose) + modalJS + '\n' + content.slice(lastScriptClose);
}

fs.writeFileSync(file, content, 'utf8');
console.log('✅ Modals + forms + handlers added. File size:', content.length);
