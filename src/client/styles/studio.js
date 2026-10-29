export const STUDIO_CSS = `
.jz-root { --jz-bg:#0e1014; --jz-bg-2:#14171c; --jz-card:#191d23; --jz-card-2:#222730; --jz-line:rgba(255,255,255,.075); --jz-line-2:rgba(255,255,255,.16); --jz-text:#f0f2f5; --jz-dim:#9099a6; --jz-accent:#bcb0ff; --jz-accent-2:#8bd4cc; display:flex; flex-direction:column; width:100%; height:100%; min-height:360px; min-width:0; color:var(--jz-text); background:var(--jz-bg); font:14px/1.5 Inter,"PingFang SC","Microsoft YaHei UI",system-ui,sans-serif; color-scheme:dark; }
.jz-root *, .jz-root *::before, .jz-root *::after { box-sizing:border-box; }
.jz-root button, .jz-root input, .jz-root select, .jz-root textarea { font-family:inherit; }
.jz-root button { -webkit-tap-highlight-color:transparent; }
.jz-root button, .jz-root a { touch-action:manipulation; }
.jz-root :focus-visible { outline:2px solid #a9cfcf; outline-offset:3px; }
.jz-icon { display:block; flex:none; }
.jz-head { height:64px; flex:none; display:flex; align-items:center; gap:14px; padding:0 28px; background:rgba(17,20,25,.95); border-bottom:1px solid var(--jz-line); }
.jz-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:650; letter-spacing:.15px; white-space:nowrap; }
.jz-logo { display:grid; place-items:center; width:30px; height:30px; border-radius:10px; color:#f8f5ff; background:linear-gradient(140deg,#9c83ed,#6b59a8); box-shadow:inset 0 1px 0 rgba(255,255,255,.22); }
.jz-brand-caption { color:#697482; font-size:10px; font-weight:500; letter-spacing:1.8px; margin-left:8px; padding-left:18px; border-left:1px solid var(--jz-line-2); }
.jz-spacer { flex:1; min-width:0; }
.jz-chip-status { display:inline-flex; align-items:center; gap:7px; font-size:11px; color:#a8b2be; white-space:nowrap; }
.jz-dot { width:5px; height:5px; border-radius:50%; background:#c3a46e; }
.jz-dot.ok { background:#7dbfa6; }
.jz-root .jz-icon-btn { display:inline-grid; place-items:center; width:34px; height:34px; flex:none; border:1px solid var(--jz-line); border-radius:10px; background:#1c2027; color:#c0c8d2; cursor:pointer; padding:0; }
.jz-root .jz-icon-btn:hover { color:#fff; background:#282e38; border-color:var(--jz-line-2); }
.jz-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:32px 40px 64px; background:radial-gradient(ellipse 70% 380px at 50% 0,rgba(43,91,104,.14),transparent 100%); scrollbar-width:thin; scrollbar-color:#353c47 transparent; }
.jz-wrap { display:flex; flex-direction:column; gap:24px; max-width:1320px; margin:0 auto; min-width:0; }
.jz-hero { text-align:center; padding:28px 0 10px; }
.jz-hero h1 { margin:0; font-size:34px; line-height:1.4; font-weight:570; letter-spacing:-.5px; }
.jz-hero p { margin:12px 0 0; color:var(--jz-dim); font-size:13px; }
.jz-hero.compact { padding:0; }
.jz-hero.compact h1 { font-size:26px; }
.jz-hero.compact p { display:none; }
.jz-composer { width:100%; max-width:980px; align-self:center; min-width:0; border:1px solid rgba(153,183,190,.17); border-radius:24px; background:linear-gradient(120deg,#1d262b,#1d232a 65%,#20262d); box-shadow:0 16px 48px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.025); }
.jz-composer:focus-within { border-color:rgba(151,199,203,.4); box-shadow:0 16px 48px rgba(0,0,0,.18),0 0 0 3px rgba(145,203,202,.025); }
.jz-composer-notice { padding:12px 20px; border-bottom:1px solid var(--jz-line); color:#a9c5c4; font-size:11px; line-height:1.7; }
.jz-unhandled-refs { display:flex; flex-direction:column; gap:8px; margin:12px 20px 0; color:#dfbf80; font-size:12px; overflow-wrap:anywhere; }
.jz-unhandled-refs > div { display:flex; align-items:center; gap:12px; justify-content:space-between; }
.jz-composer-main { display:flex; gap:16px; padding:22px 22px 8px; align-items:flex-start; min-width:0; }
.jz-slots { display:flex; flex-wrap:wrap; gap:8px; max-width:232px; flex:none; }
.jz-slots:empty { display:none; }
.jz-slot { position:relative; display:flex; align-items:center; justify-content:center; width:70px; height:78px; flex:none; border:1px dashed rgba(191,213,217,.22); border-radius:12px; color:#a7b6be; background:rgba(255,255,255,.025); cursor:pointer; overflow:hidden; }
.jz-slot:hover { background:rgba(255,255,255,.055); border-color:#93b9bd; color:#e7f3f2; }
.jz-slot.filled { border-style:solid; }
.jz-slot img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.jz-slot > .jz-icon { margin-bottom:10px; }
.jz-slot .cap { position:absolute; left:0; bottom:0; right:0; padding:4px 2px; color:#c4d1d8; font-size:10px; text-align:center; background:linear-gradient(transparent,rgba(17,23,29,.62)); }
.jz-slot.filled .cap { color:#fff; }
.jz-root .jz-slot .del { position:absolute; top:4px; right:4px; width:20px; height:20px; display:grid; place-items:center; border:0; padding:0; border-radius:50%; background:rgba(8,12,16,.78); color:#fff; cursor:pointer; }
.jz-prompt { display:block; flex:1; width:100%; min-width:0; min-height:84px; max-height:280px; margin:0; padding:1px 0 6px; resize:vertical; border:0; outline:none!important; background:transparent; color:var(--jz-text); font-size:15px; line-height:1.8; }
.jz-prompt::placeholder { color:#84919c; }
.jz-bar { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:7px; min-height:56px; padding:6px 76px 14px 20px; }
.jz-bar > .jz-spacer { display:none; }
.jz-menu { position:relative; max-width:100%; min-width:0; }
.jz-root .jz-chip { display:inline-flex; align-items:center; justify-content:center; gap:7px; max-width:100%; min-height:32px; height:32px; padding:0 10px; border:1px solid transparent; border-radius:9px; background:rgba(7,12,17,.22); color:#e0e5eb; font-size:12px; cursor:pointer; white-space:nowrap; }
.jz-root .jz-chip:hover, .jz-root .jz-chip.open { border-color:rgba(195,218,221,.17); background:rgba(255,255,255,.055); }
.jz-root .jz-chip-mode { color:#b6e4df; background:rgba(124,190,187,.09); }
.jz-chip-label { color:#95a2af; }
.jz-chip-value { min-width:0; max-width:230px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-caret { color:#768493; }
.jz-chip.open .jz-caret { transform:rotate(180deg); }
.jz-static { color:var(--jz-dim); font-size:12px; }
.jz-root .jz-send { position:absolute; right:19px; bottom:15px; display:grid; place-items:center; width:42px; height:42px; padding:0; flex:none; border:0; border-radius:999px; background:linear-gradient(135deg,#f1e8df,#d9efee 65%,#c7e3e5); color:#263d45; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.12); }
.jz-root .jz-send:not(:disabled):hover { filter:brightness(1.08); transform:translateY(-1px); }
.jz-root .jz-send:disabled { opacity:.32; box-shadow:none; cursor:default; }
.jz-send-spin { width:16px; height:16px; border:2px solid rgba(26,53,62,.2); border-top-color:#264d57; border-radius:50%; animation:jz-spin .9s linear infinite; }
.jz-composer-help { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-top:1px solid rgba(199,224,227,.06); color:#7e8b98; font-size:11px; }
.jz-key-hint { white-space:nowrap; font-size:10px; color:#6e7c89; }
.jz-key-hint kbd { font-family:inherit; }
.jz-note { flex-basis:100%; color:#dfbf80; font-size:12px; }
.jz-error, .jz-notice { display:flex; align-items:flex-start; gap:8px; padding:11px 13px; border:1px solid rgba(227,135,135,.18); border-radius:10px; color:#ecaaaa; background:rgba(202,88,88,.065); font-size:12px; line-height:1.65; overflow-wrap:anywhere; }
.jz-composer > .jz-error { margin:0 20px 12px; }
.jz-error > .jz-icon, .jz-notice > .jz-icon { margin-top:2px; }
.jz-notice.warning { background:rgba(205,161,83,.065); border-color:rgba(221,178,107,.18); color:#ddbd87; }
.jz-drop { z-index:110; display:flex; flex-direction:column; overflow:hidden; padding:0; border:1px solid #3a424e; border-radius:13px; background:#232831; box-shadow:0 18px 45px rgba(0,0,0,.48); }
.jz-drop-list { position:relative; min-height:0; overflow:auto; overscroll-behavior:contain; padding:6px; scrollbar-width:thin; }
.jz-drop-search { display:flex; align-items:center; gap:8px; flex:none; padding:10px 12px; border-bottom:1px solid var(--jz-line); color:#91a6ba; }
.jz-drop-search input { width:100%; min-width:0; height:24px; padding:0; border:0; outline:none; background:transparent; color:#dfe9f0; font-size:12px; }
.jz-drop-search input::placeholder { color:#8b9bac; }
.jz-drop-empty { padding:16px 10px; color:#96a5b7; font-size:12px; }
.jz-drop-head { padding:9px 10px 5px; color:#8f9caa; font-size:10px; letter-spacing:.4px; }
.jz-root .jz-drop-item { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:36px; padding:8px 10px; border:0; border-radius:8px; background:transparent; color:#dfe5ed; font-size:12px; text-align:left; cursor:pointer; }
.jz-root .jz-drop-item:hover, .jz-root .jz-drop-item:focus-visible { background:#303946; outline-offset:-2px; }
.jz-drop-item.on { color:#bce5df; }
.jz-option-label { display:flex; flex-direction:column; gap:2px; min-width:0; }
.jz-option-label > span, .jz-option-label small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-option-label small { color:#8794a3; font-size:10px; }
.jz-ideas { width:100%; max-width:980px; align-self:center; display:flex; gap:12px; align-items:flex-start; }
.jz-ideas-head { padding:7px 0; color:#778593; white-space:nowrap; font-size:11px; }
.jz-idea-row { display:flex; flex-wrap:wrap; gap:7px; min-width:0; }
.jz-root .jz-idea { max-width:280px; padding:7px 11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:1px solid var(--jz-line); border-radius:999px; background:#181c22; color:#9aa5b3; font-size:11px; cursor:pointer; }
.jz-root .jz-idea:hover { color:#dfe5ee; border-color:var(--jz-line-2); background:#20262d; }
.jz-cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; max-width:980px; width:100%; align-self:center; }
.jz-root .jz-card { display:flex; flex-direction:column; gap:6px; align-items:flex-start; text-align:left; padding:16px; border:1px solid var(--jz-line); border-radius:13px; background:#171c22; color:var(--jz-text); cursor:pointer; }
.jz-root .jz-card:hover { background:#20272f; border-color:rgba(180,209,208,.2); }
.jz-card-title { font-size:13px; font-weight:550; }
.jz-card-desc { font-size:11px; color:var(--jz-dim); line-height:1.65; }
.jz-gallery { display:flex; flex-direction:column; gap:18px; margin-top:10px; padding-top:26px; border-top:1px solid var(--jz-line); }
.jz-gallery-head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.jz-gallery-tools { display:flex; flex-wrap:wrap; align-items:center; gap:9px; min-width:0; }
.jz-work-search { display:flex; align-items:center; gap:9px; flex:1; min-width:min(100%,220px); padding:0 11px; height:36px; border:1px solid var(--jz-line); border-radius:10px; background:#181d24; color:#8090a3; }
.jz-work-search:focus-within { border-color:#749b9f; }
.jz-work-search input { width:100%; min-width:0; border:0; outline:none; color:#d8e2ec; background:transparent; font-size:12px; }
.jz-work-search input::placeholder { color:#768699; }
.jz-gallery-heading { min-width:0; }
.jz-gallery-title { margin:0; font-size:20px; font-weight:570; letter-spacing:-.2px; line-height:1.3; }
.jz-gallery-heading p { margin:6px 0 0; color:#7d8997; font-size:11px; }
.jz-count { align-self:flex-start; margin-top:1px; padding:2px 7px; border-radius:6px; background:#242a32; color:#aeb8c6; font-size:11px; }
.jz-grid { column-count:4; column-gap:16px; }
.jz-tile { display:inline-block; vertical-align:top; width:100%; break-inside:avoid; margin:0 0 16px; overflow:hidden; border:1px solid var(--jz-line); border-radius:15px; background:#181d24; box-shadow:0 3px 10px rgba(0,0,0,.08); }
.jz-tile:hover, .jz-tile:focus-within { border-color:rgba(174,196,211,.24); }
.jz-tile-media { position:relative; min-width:0; overflow:hidden; background:#11161c; }
.jz-tile-media.empty { aspect-ratio:4/3; min-height:190px; background:radial-gradient(ellipse at 50% 35%,#232d3a,#171e28 75%); }
.jz-tile-media img, .jz-tile-media video { display:block; width:100%; height:auto; }
.jz-tile-badges { position:absolute; inset:10px 10px auto; display:flex; align-items:center; justify-content:space-between; gap:8px; pointer-events:none; z-index:2; }
.jz-kind-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 7px; border:1px solid rgba(255,255,255,.1); border-radius:6px; color:#ecf2f6; background:rgba(12,18,24,.62); font-size:10px; backdrop-filter:blur(8px); }
.jz-status-badge { display:inline-flex; align-items:center; gap:5px; width:fit-content; padding:4px 8px; border-radius:6px; background:#29323e; color:#bdc9d8; font-size:10px; white-space:nowrap; line-height:1.45; }
.jz-status-badge i { display:block; width:4px; height:4px; border-radius:50%; background:currentColor; }
.jz-status-badge.success { background:rgba(24,47,41,.9); color:#a4cdb9; }
.jz-status-badge.warning { background:rgba(68,52,31,.92); color:#e5c58f; }
.jz-status-badge.error { background:rgba(70,35,40,.92); color:#eba6ac; }
.jz-status-badge.pending { background:rgba(37,48,65,.92); color:#b6cae6; }
.jz-status-badge.muted { background:#30343c; color:#b1b5be; }
.jz-tile-pending, .jz-tile-err { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; padding:44px 18px 24px; text-align:center; color:#9caec5; font-size:11px; }
.jz-tile-pending strong, .jz-tile-err strong { font-weight:550; font-size:13px; }
.jz-tile-err { background:#241c23; color:#d9a0a8; }
.jz-tile-err.warning { background:#242119; color:#d3b783; }
.jz-tile-err p { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin:0; font-size:11px; line-height:1.6; color:#a78e95; }
.jz-tile-err.warning p { color:#a6997e; }
.jz-spin { width:23px; height:23px; border:1.5px solid rgba(160,188,222,.15); border-top-color:#a7bfe0; border-radius:50%; animation:jz-spin 1s linear infinite; }
@keyframes jz-spin { to { transform:rotate(360deg); } }
.jz-progress-track { height:3px; width:64px; margin-top:2px; overflow:hidden; border-radius:3px; background:#303d51; }
.jz-progress-track > span { display:block; height:100%; border-radius:inherit; background:#abc4e5; }
.jz-tile-actions { position:absolute; inset:auto 0 0; display:flex; justify-content:flex-end; gap:6px; padding:26px 11px 11px; background:linear-gradient(transparent,rgba(5,9,14,.74)); opacity:0; transition:opacity .16s ease; z-index:3; }
.jz-tile:hover .jz-tile-actions, .jz-tile:focus-within .jz-tile-actions { opacity:1; }
.jz-root .jz-tile-actions button { display:grid; place-items:center; width:31px; height:31px; padding:0; border:1px solid rgba(255,255,255,.17); border-radius:8px; color:#f1f4f8; background:rgba(23,30,39,.8); backdrop-filter:blur(8px); cursor:pointer; }
.jz-root .jz-tile-actions button:hover { background:#3a4657; border-color:#7f94aa; }
.jz-root .jz-tile-actions button:disabled { opacity:.4; cursor:default; }
.jz-tile-foot { display:flex; align-items:center; gap:7px; padding:11px 12px; color:#9ba8b8; font-size:11.5px; }
.jz-tile-model { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-tile-cost { flex:none; color:#8a96a5; font-variant-numeric:tabular-nums; }
.jz-expiry { display:block; color:#c4ad7f; }
.jz-tile-followup { display:flex; flex-wrap:wrap; gap:8px 14px; border-top:1px solid var(--jz-line); padding:9px 12px; }
.jz-root .jz-link:disabled { opacity:.4; cursor:default; }
.jz-root .jz-link { display:inline-flex; align-items:center; gap:5px; padding:0; border:0; background:none; color:#b8cfcf; font-size:11px; cursor:pointer; }
.jz-root .jz-link:hover { color:#e0f1ef; }
.jz-empty { padding:44px 24px; border:1px dashed var(--jz-line-2); border-radius:18px; color:#7f8d9d; text-align:center; font-size:13px; }
.jz-empty strong { color:#bac5d1; font-weight:500; font-size:15px; }
.jz-empty p { margin:9px auto 0; max-width:400px; }
.jz-dim { color:var(--jz-dim); font-size:12px; line-height:1.65; }
.jz-root .jz-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:38px; padding:0 15px; border:1px solid var(--jz-line); border-radius:10px; color:#d6dee7; background:#242b35; font-size:12px; cursor:pointer; text-decoration:none; }
.jz-root .jz-btn:hover { border-color:var(--jz-line-2); background:#2d3743; }
.jz-root .jz-btn:disabled { opacity:.4; cursor:default; }
.jz-root .jz-btn.primary { background:#d6e9e5; color:#243b3c; border-color:transparent; font-weight:600; }
.jz-root .jz-btn.primary:hover { background:#e5f3ef; }
.jz-root .jz-btn.small { height:29px; padding:0 10px; font-size:11px; }
.jz-root .jz-btn.ghost { color:#8e9baa; background:transparent; }
.jz-overlay { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:28px; background:rgba(5,8,12,.8); backdrop-filter:blur(7px); }
.jz-lightbox { position:relative; display:flex; width:min(1240px,calc(100vw - 56px)); height:min(780px,calc(100dvh - 64px)); border:1px solid #353d48; border-radius:20px; overflow:hidden; background:#171c23; box-shadow:0 25px 100px rgba(0,0,0,.45); }
.jz-lightbox:focus { outline:none; }
.jz-root .jz-preview-close { position:absolute; right:14px; top:14px; z-index:3; border-radius:999px; background:rgba(22,29,37,.8); }
.jz-lightbox-media { display:flex; align-items:center; justify-content:center; flex:1; min-width:0; min-height:0; padding:20px; background:#090d12; }
.jz-lightbox-media img, .jz-lightbox-media video { display:block; max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; }
.jz-preview-placeholder { display:flex; flex-direction:column; align-items:center; gap:18px; color:#6f8199; }
.jz-preview-placeholder.warning { color:#c2a36d; }
.jz-lightbox-side { display:flex; flex-direction:column; gap:0; width:340px; flex:none; min-height:0; padding:0; overflow:hidden; border-left:1px solid var(--jz-line); scrollbar-width:thin; }
.jz-detail-body { display:flex; flex-direction:column; gap:20px; flex:1; min-height:0; padding:27px 24px 20px; overflow:auto; scrollbar-width:thin; }
.jz-detail-heading { padding-right:27px; }
.jz-detail-eyebrow { color:#778597; font-size:10px; letter-spacing:1px; }
.jz-detail-heading h2 { margin:4px 0 11px; color:#e9edf3; font-size:20px; font-weight:550; }
.jz-detail-section h3 { margin:0 0 10px; color:#8492a3; font-size:11px; font-weight:500; }
.jz-prompt-text { color:#d8e0ea; font-size:13px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
.jz-detail-model { display:flex; align-items:flex-start; gap:9px; min-width:0; color:#bfcfdf; }
.jz-detail-model > .jz-icon { margin-top:3px; color:#8aa8b7; }
.jz-detail-model strong { font-size:12px; font-weight:500; }
.jz-detail-model small { display:block; margin-top:3px; color:#768699; font-size:10px; overflow-wrap:anywhere; user-select:text; }
.jz-param-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:14px 0 0; }
.jz-param-grid > div { min-width:0; padding:8px 10px; border:1px solid var(--jz-line); border-radius:8px; background:#1c232c; }
.jz-param-grid dt { color:#78889c; font-size:10px; }
.jz-param-grid dd { margin:3px 0 0; color:#cbd7e4; font-size:12px; overflow-wrap:anywhere; }
.jz-task-details { font-size:11px; color:#7f8fa4; }
.jz-task-details summary { cursor:pointer; width:fit-content; }
.jz-task-details dl { margin:11px 0; }
.jz-task-details dl > div { margin:8px 0; }
.jz-task-details dt { font-size:10px; color:#63758c; }
.jz-task-details dd { margin:3px 0 0; font-family:ui-monospace,monospace; font-size:10px; overflow-wrap:anywhere; user-select:text; }
.jz-created { color:#66798e; font-size:10px; }
.jz-detail-actions { display:flex; flex-direction:column; gap:8px; flex:none; margin:0; padding:16px 24px 20px; border-top:1px solid var(--jz-line); background:#171c23; }
.jz-billing { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#8796aa; }
.jz-billing strong { color:#d0dce8; font-size:15px; font-weight:500; font-variant-numeric:tabular-nums; }
.jz-snapshot-note { margin:3px 0 8px; font-size:10px; line-height:1.7; color:#75859b; }
.jz-detail-utilities { display:flex; flex-wrap:wrap; gap:8px 12px; justify-content:center; padding-top:8px; }
.jz-root .jz-text-btn { display:inline-flex; align-items:center; gap:5px; padding:0; border:0; background:none; color:#7e91a7; font-size:10px; text-decoration:none; cursor:pointer; }
.jz-root .jz-text-btn:hover { color:#c0d5e8; }
.jz-modal { width:600px; max-width:calc(100vw - 48px); max-height:calc(100dvh - 56px); overflow:auto; display:flex; flex-direction:column; gap:16px; padding:23px; border:1px solid #353d48; border-radius:20px; background:#191e25; box-shadow:0 25px 100px rgba(0,0,0,.4); scrollbar-width:thin; }
.jz-modal-head { display:flex; align-items:center; }
.jz-modal-title { font-size:17px; font-weight:550; }
.jz-modal-foot { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding-top:4px; }
.jz-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
.jz-field-head { display:flex; align-items:center; gap:8px; font-size:12px; color:#91a1b5; }
.jz-grid2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px; }
.jz-input { width:100%; min-width:0; height:36px; padding:0 11px; border:1px solid #323b48; border-radius:9px; background:#141a21; color:#d6e0ec; font-size:12px; }
.jz-input:focus { outline:1px solid #93bcbc; border-color:#93bcbc; }
.jz-row { display:flex; align-items:center; gap:7px; }
.jz-row .jz-input { flex:1; min-width:0; }
.jz-channel { display:flex; flex-direction:column; gap:9px; padding:13px; border:1px solid var(--jz-line); border-radius:12px; background:#1d242e; }
.jz-channel-foot { display:flex; align-items:center; gap:8px; }
.jz-toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:130; max-width:min(620px,calc(100vw - 32px)); padding:12px 17px; border:1px solid #3b4859; border-radius:12px; color:#d6e2f0; background:#242e3c; box-shadow:0 12px 40px rgba(0,0,0,.4); font-size:12px; overflow-wrap:anywhere; }
.jz-root[data-layout="medium"] .jz-grid { column-count:3; }
.jz-root[data-layout="narrow"] .jz-grid { column-count:2; }
.jz-root[data-layout="compact"] .jz-grid { column-count:1; }
.jz-root[data-layout="medium"] .jz-scroll { padding-left:26px; padding-right:26px; }
.jz-root[data-layout="narrow"] .jz-scroll, .jz-root[data-layout="compact"] .jz-scroll { padding:20px 16px 40px; }
.jz-root[data-layout="narrow"] .jz-head, .jz-root[data-layout="compact"] .jz-head { padding:0 18px; height:58px; }
.jz-root[data-layout="narrow"] .jz-brand-caption, .jz-root[data-layout="compact"] .jz-brand-caption { display:none; }
.jz-root[data-layout="narrow"] .jz-hero h1, .jz-root[data-layout="compact"] .jz-hero h1 { font-size:24px; letter-spacing:0; }
.jz-root[data-layout="compact"] .jz-hero p { font-size:12px; }
.jz-root[data-layout="compact"] .jz-hero { padding-top:5px; }
.jz-root[data-layout="narrow"] .jz-composer-main, .jz-root[data-layout="compact"] .jz-composer-main { padding:17px 17px 5px; gap:12px; flex-direction:column; }
.jz-root[data-layout="narrow"] .jz-slots, .jz-root[data-layout="compact"] .jz-slots { max-width:100%; }
.jz-root[data-layout="narrow"] .jz-prompt, .jz-root[data-layout="compact"] .jz-prompt { flex:none; min-height:95px; font-size:14px; }
.jz-root[data-layout="compact"] .jz-composer { border-radius:18px; }
.jz-root[data-layout="compact"] .jz-bar { padding:6px 67px 14px 13px; gap:6px; }
.jz-root[data-layout="compact"] .jz-chip { padding:0 8px; font-size:11px; }
.jz-root[data-layout="compact"] .jz-chip-value { max-width:175px; }
.jz-root[data-layout="compact"] .jz-send { right:14px; bottom:14px; width:38px; height:38px; }
.jz-root[data-layout="compact"] .jz-composer-help { padding:9px 13px; font-size:10px; }
.jz-root[data-layout="compact"] .jz-key-hint { display:none; }
.jz-root[data-layout="compact"] .jz-ideas { flex-direction:column; gap:5px; }
.jz-root[data-layout="compact"] .jz-ideas-head { padding:0; }
.jz-root[data-layout="compact"] .jz-idea { max-width:245px; }
.jz-root[data-layout="narrow"] .jz-cards, .jz-root[data-layout="compact"] .jz-cards { grid-template-columns:repeat(2,minmax(0,1fr)); }
.jz-root[data-layout="compact"] .jz-gallery { padding-top:20px; gap:14px; }
.jz-root[data-layout="compact"] .jz-gallery-heading p { display:none; }
.jz-root[data-layout="compact"] .jz-gallery-title { font-size:18px; }
.jz-root[data-layout="compact"] .jz-work-search { flex-basis:100%; }
@media (hover:none) { .jz-tile-actions { opacity:1; } .jz-root .jz-tile-actions button { width:38px; height:38px; } }
@media (max-width:720px) {
  .jz-overlay { padding:12px; align-items:center; }
  .jz-lightbox { flex-direction:column; width:100%; height:calc(100dvh - 24px); max-height:calc(100dvh - 24px); border-radius:16px; }
  .jz-lightbox-media { flex:none; height:38dvh; padding:10px; }
  .jz-lightbox-side { flex:1; width:100%; padding:0; border-left:0; border-top:1px solid var(--jz-line); gap:0; }
  .jz-detail-body { padding:18px 20px; gap:16px; }
  .jz-detail-actions { padding:12px 20px 16px; }
  .jz-detail-heading { padding-right:0; }
  .jz-detail-heading h2 { font-size:18px; }
  .jz-root .jz-preview-close { background:rgba(17,25,34,.8); right:11px; top:11px; }
  .jz-modal { max-width:100%; width:100%; max-height:calc(100dvh - 24px); padding:17px; border-radius:16px; }
}
@media (max-width:440px) { .jz-grid2 { grid-template-columns:minmax(0,1fr); } .jz-brand { font-size:14px; } }
@media (prefers-reduced-motion:reduce) { .jz-root *, .jz-root *::before, .jz-root *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; } }
`;
