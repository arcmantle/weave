const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/angular-html-CU67Zn6k.js","assets/html-GMplVEZG.js","assets/javascript-wDzz0qaB.js","assets/css-DPfMkruS.js","assets/angular-ts-BwZT4LLn.js","assets/scss-OYdSNvt2.js","assets/apl-dKokRX4l.js","assets/xml-sdJ4AIDG.js","assets/java-CylS5w8V.js","assets/json-Cp-IABpG.js","assets/astro-CbQHKStN.js","assets/typescript-BPQ3VLAy.js","assets/postcss-CXtECtnM.js","assets/tsx-COt5Ahok.js","assets/blade-D4QpJJKB.js","assets/html-derivative-BFtXZ54Q.js","assets/sql-BLtJtn59.js","assets/bsl-BO_Y6i37.js","assets/sdbl-DVxCFoDh.js","assets/cairo-KRGpt6FW.js","assets/python-B6aJPvgy.js","assets/cobol-nwyudZeR.js","assets/coffee-Ch7k5sss.js","assets/cpp-CofmeUqb.js","assets/regexp-CDVJQ6XC.js","assets/glsl-DplSGwfg.js","assets/c-BIGW1oBm.js","assets/crystal-tKQVLTB8.js","assets/shellscript-Yzrsuije.js","assets/edge-BkV0erSs.js","assets/elixir-CDX3lj18.js","assets/elm-DbKCFpqz.js","assets/erb-CgJxNhIT.js","assets/ruby-Cw6WdidG.js","assets/haml-B8DHNrY2.js","assets/graphql-ChdNCCLP.js","assets/jsx-g9-lgVsj.js","assets/lua-BaeVxFsk.js","assets/yaml-Buea-lGh.js","assets/erlang-DsQrWhSR.js","assets/markdown-Cvjx9yec.js","assets/fortran-fixed-form-CkoXwp7k.js","assets/fortran-free-form-BxgE0vQu.js","assets/fsharp-CXgrBDvD.js","assets/gdresource-BOOCDP_w.js","assets/gdshader-DkwncUOv.js","assets/gdscript-C5YyOfLZ.js","assets/git-commit-F4YmCXRG.js","assets/diff-D97Zzqfu.js","assets/git-rebase-r7XF79zn.js","assets/glimmer-js-Rg0-pVw9.js","assets/glimmer-ts-U6CK756n.js","assets/hack-CaT9iCJl.js","assets/handlebars-BL8al0AC.js","assets/http-jrhK8wxY.js","assets/hurl-irOxFIW8.js","assets/csv-fuZLfV_i.js","assets/hxml-Bvhsp5Yf.js","assets/haxe-CzTSHFRz.js","assets/jinja-4LBKfQ-Z.js","assets/jison-wvAkD_A8.js","assets/julia-CxzCAyBv.js","assets/r-Dspwwk_N.js","assets/latex-DGMBWnxU.js","assets/tex-CvyZ59Mk.js","assets/liquid-DYVedYrR.js","assets/marko-DZsq8hO1.js","assets/less-B1dDrJ26.js","assets/mdc-DUICxH0z.js","assets/nginx-BpAMiNFr.js","assets/nim-CVrawwO9.js","assets/perl-C0TMdlhV.js","assets/php-Dhbhpdrm.js","assets/pug-CGlum2m_.js","assets/qml-3beO22l8.js","assets/razor-Uh8Bk_45.js","assets/csharp-COcwbKMJ.js","assets/rst-D5oM4XIm.js","assets/cmake-D1j8_8rp.js","assets/sas-cz2c8ADy.js","assets/shaderlab-Dg9Lc6iA.js","assets/hlsl-D3lLCCz7.js","assets/shellsession-BADoaaVG.js","assets/soy-Brmx7dQM.js","assets/sparql-rVzFXLq3.js","assets/turtle-BsS91CYL.js","assets/stata-BH5u7GGu.js","assets/surrealql-Bq5Q-fJD.js","assets/svelte-zxCyuUbr.js","assets/templ-P3uqSqPl.js","assets/go-CxLEBnE3.js","assets/ts-tags-zn1MmPIZ.js","assets/twig-ChbOoGGc.js","assets/vue-DN_0RTcg.js","assets/vue-html-AaS7Mt5G.js","assets/vue-vine-CQOfvN7w.js","assets/stylus-BEDo0Tqx.js","assets/xsl-CtQFsRM5.js"])))=>i.map(i=>d[i]);
import{i as de,r as P,a as pe,b as j,n as L,c as b,t as he,A as Tt,E as Kn,_ as c,d as Ur}from"./login-page-f3G4gu49.js";import{router as B,defineRoute as ve}from"./index-CDqOEMXw.js";class Qn{constructor(){this.config=null}async getConfig(){if(!this.config){const e=await fetch("/api/config");if(!e.ok)throw new Error(`Failed to fetch registry config: ${e.statusText}`);this.config=await e.json()}return this.config}async isPublic(){return(await this.getConfig()).accessMode==="public"}}const dt=new Qn;var Xn=Object.defineProperty,Yn=Object.getOwnPropertyDescriptor,Ht=(t,e,r,n)=>{for(var i=n>1?void 0:n?Yn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&Xn(e,r,i),i};let De=class extends pe{constructor(){super(...arguments),this.currentUser=null,this.accessMode="private"}connectedCallback(){super.connectedCallback(),this.initialize(),B.onAfterNavigateStart(()=>{this.requestUpdate()})}async initialize(){const t=await dt.getConfig();this.accessMode=t.accessMode,this.currentUser=await j.getCurrentUser()}handleLogoClick(){B.navigate("/")}async handleLogout(){await j.logout(),await B.navigate("/login")}render(){return b`
		<header>
			<div class="header-left">
				<span class="logo" @click=${this.handleLogoClick}>
					Pivot Registry
				</span>

				<nav>
					<a ?data-active=${B.isActive("/")}        href="/">Dashboard</a>
					<a ?data-active=${B.isActive("/browse")}  href="/browse">Browse</a>
					<a ?data-active=${B.isActive("/explore")} href="/explore">Explorer</a>
					${L(this.currentUser,()=>b`
					<a ?data-active=${B.isActive("/admin")} href="/admin">Admin</a>
					`)}
				</nav>
			</div>

			<div class="header-right">
				${L(this.currentUser,()=>b`
				<span class="user-info">${this.currentUser}</span>
				<button class="logout-btn" @click=${this.handleLogout}>
					Logout
				</button>
				`,()=>b`
				<a class="login-btn" href="/login">Login</a>
				`)}
			</div>
		</header>

		<main>
			<router-outlet></router-outlet>
		</main>
		`}};De.styles=de`
		:host {
			--color-header-bg: #1a1a2e;
			--color-header-text: #fff;
			--color-header-text-muted: rgba(255, 255, 255, 0.7);
			--color-header-text-dim: rgba(255, 255, 255, 0.8);
			--color-header-border: rgba(255, 255, 255, 0.3);
			--color-header-border-hover: rgba(255, 255, 255, 0.6);
			--color-header-hover-bg: rgba(255, 255, 255, 0.1);
			--color-header-active-bg: rgba(255, 255, 255, 0.15);
			--color-shadow: rgba(0, 0, 0, 0.15);
			--font-size-sm: 13px;
			--font-size-base: 14px;
			--font-size-lg: 18px;
			--spacing-xs: 4px;
			--spacing-sm: 6px;
			--spacing-md: 8px;
			--spacing-lg: 14px;
			--spacing-xl: 16px;
			--spacing-2xl: 24px;
			--radius-md: 6px;
			--transition-speed: 0.15s;
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 var(--spacing-2xl);
			height: 56px;
			background: var(--color-header-bg);
			color: var(--color-header-text);
			box-shadow: 0 2px 4px var(--color-shadow);
			z-index: 10;
		}
		.header-left {
			display: flex;
			align-items: center;
			gap: var(--spacing-2xl);
		}
		.logo {
			font-size: var(--font-size-lg);
			font-weight: 700;
			letter-spacing: 0.5px;
			cursor: pointer;
			user-select: none;
		}
		nav {
			display: flex;
			gap: var(--spacing-xs);
			& a {
				color: var(--color-header-text-muted);
				text-decoration: none;
				padding: var(--spacing-md) var(--spacing-lg);
				border-radius: var(--radius-md);
				font-size: var(--font-size-base);
				font-weight: 500;
				transition: color var(--transition-speed), background var(--transition-speed);
				cursor: pointer;
				&:hover {
					color: var(--color-header-text);
					background: var(--color-header-hover-bg);
				}
				&[data-active] {
					color: var(--color-header-text);
					background: var(--color-header-active-bg);
				}
			}
		}
		.header-right {
			display: flex;
			align-items: center;
			gap: var(--spacing-xl);
		}
		.user-info {
			font-size: var(--font-size-sm);
			color: var(--color-header-text-muted);
		}
		.logout-btn {
			background: none;
			border: 1px solid var(--color-header-border);
			color: var(--color-header-text-dim);
			padding: var(--spacing-sm) var(--spacing-lg);
			border-radius: var(--radius-md);
			font-size: var(--font-size-sm);
			cursor: pointer;
			transition: border-color var(--transition-speed), color var(--transition-speed);
			&:hover {
				border-color: var(--color-header-border-hover);
				color: var(--color-header-text);
			}
		}
		.login-btn {
			border: 1px solid var(--color-header-border);
			color: var(--color-header-text-dim);
			padding: var(--spacing-sm) var(--spacing-lg);
			border-radius: var(--radius-md);
			font-size: var(--font-size-sm);
			text-decoration: none;
			cursor: pointer;
			transition: border-color var(--transition-speed), color var(--transition-speed), background var(--transition-speed);
			&:hover {
				border-color: var(--color-header-border-hover);
				color: var(--color-header-text);
				background: var(--color-header-hover-bg);
			}
		}
		main {
			flex: 1;
			display: grid;
		}
	`;Ht([P()],De.prototype,"currentUser",2);Ht([P()],De.prototype,"accessMode",2);De=Ht([he("app-layout")],De);class Zn{async getPlugins(e){const r=new URLSearchParams;e?.search&&r.set("search",e.search),e?.tag&&r.set("tag",e.tag),e?.page&&r.set("page",e.page.toString()),e?.pageSize&&r.set("pageSize",e.pageSize.toString());const n=`/api/plugins${r.toString()?"?"+r.toString():""}`,i=await j.fetchWithAuth(n);if(!i.ok)throw new Error(`Failed to fetch plugins: ${i.statusText}`);return await i.json()}async getPlugin(e){const r=await j.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}`);if(!r.ok)throw new Error(`Failed to fetch plugin: ${r.statusText}`);return await r.json()}async deleteVersion(e,r){const n=await j.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}/versions/${encodeURIComponent(r)}`,{method:"DELETE"});if(!n.ok)throw new Error(`Failed to delete plugin version: ${n.statusText}`)}async downloadPlugin(e,r){const n=await j.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}/versions/${encodeURIComponent(r)}/download`);if(!n.ok)throw new Error(`Failed to download plugin: ${n.statusText}`);return await n.blob()}async uploadPlugin(e){const r=new FormData;r.append("file",e);const n=await j.fetchWithAuth("/api/plugins/upload",{method:"POST",body:r});if(!n.ok){const i=await n.json();throw new Error(i.error||`Failed to upload plugin: ${n.statusText}`)}return await n.json()}}const K=new Zn;function le(t,...e){const r=t.currentTarget.dataset;return Object.fromEntries(e.map(n=>[n,r?.[n]]))}const Fr=t=>{const e=["B","KB","MB","GB"];let r=t,n=0;for(;r>=1024&&n<e.length-1;)n++,r=r/1024;return`${r.toFixed(2)} ${e[n]}`},Hr=t=>new Date(t).toLocaleString();var Jn=Object.defineProperty,ei=Object.getOwnPropertyDescriptor,re=(t,e,r,n)=>{for(var i=n>1?void 0:n?ei(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&Jn(e,r,i),i};let Q=class extends pe{constructor(){super(...arguments),this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.expandedPlugin=null,this.pluginDetails=new Map,this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){this.currentUser=await j.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const t=await K.getPlugins({pageSize:100});this.plugins=t.plugins.filter(e=>e.author===this.currentUser)}catch(t){console.error("Failed to load plugins:",t)}finally{this.loading=!1}}async toggleExpand(t){if(this.expandedPlugin===t){this.expandedPlugin=null;return}if(this.expandedPlugin=t,!this.pluginDetails.has(t))try{const e=await K.getPlugin(t);this.pluginDetails=new Map(this.pluginDetails).set(t,e)}catch(e){console.error("Failed to load plugin details:",e)}}async deleteVersion(t,e){if(confirm(`Delete ${t} version ${e}?`))try{await K.deleteVersion(t,e);const r=await K.getPlugin(t);this.pluginDetails=new Map(this.pluginDetails).set(t,r),await this.loadPlugins()}catch(r){console.error("Failed to delete version:",r),alert("Failed to delete plugin version")}}handleDeleteVersionClick(t){const{pluginName:e,version:r}=le(t,"pluginName","version");e&&r&&this.deleteVersion(e,r)}handleToggleExpandClick(t){const{pluginName:e}=le(t,"pluginName");e&&this.toggleExpand(e)}async handleLogout(){await j.logout(),await B.navigate("/login")}handleFileSelect(t){const e=t.target;this.selectedFile=e.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const t=await K.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${t.plugin} v${t.version}`,this.selectedFile=null;const e=this.shadowRoot?.querySelector("#plugin-file");e&&(e.value=""),await this.loadPlugins()}catch(t){this.uploadError=t instanceof Error?t.message:"Upload failed"}finally{this.uploadProgress=!1}}renderUploadSection(){return b`
		<section class="section">
			<h2>Upload Plugin Package</h2>

			${L(this.uploadStatus,()=>b`
			<div class="alert alert-success">${this.uploadStatus}</div>
			`)}
			${L(this.uploadError,()=>b`
			<div class="alert alert-error">${this.uploadError}</div>
			`)}

			<div class="upload-form">
				<div class="form-group">
					<label for="plugin-file">Select .pivotpkg file</label>
					<input
						type="file"
						id="plugin-file"
						accept=".pivotpkg"
						?disabled=${this.uploadProgress}
						@change=${this.handleFileSelect}
					/>
				</div>

				${L(this.uploadProgress,()=>b`
				<div class="upload-progress">Uploading...</div>
				`)}

				<div class="form-actions">
					<button
						class="btn btn-primary"
						@click=${this.handleUpload}
						?disabled=${this.uploadProgress}
					>
						Upload Plugin
					</button>
				</div>
			</div>
		</section>
		`}renderVersionsForPlugin(t){const e=this.pluginDetails.get(t);if(!e)return b`<div class="loading">Loading versions...</div>`;const r=e.versions;return!r||r.length===0?b`<p>No versions.</p>`:b`
		<table class="versions-table">
			<thead>
				<tr>
					<th>Version</th>
					<th>File Size</th>
					<th>Downloads</th>
					<th>Uploaded</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${r.map(n=>b`
				<tr>
					<td>${n.version}</td>
					<td>${Fr(n.fileSize)}</td>
					<td>${n.downloadCount}</td>
					<td>${Hr(n.uploadedAt)}</td>
					<td>
						<button
							class="btn-small btn-danger"
							data-plugin-name=${t}
							data-version=${n.version}
							@click=${this.handleDeleteVersionClick}
						>
							Delete
						</button>
					</td>
				</tr>
				`)}
			</tbody>
		</table>
		`}renderPluginList(){return this.loading?b`<div class="loading">Loading...</div>`:this.plugins.length===0?b`
		<div class="empty-state">
			<p>You have no plugins to manage. Upload a plugin to get started.</p>
		</div>
			`:this.plugins.map(t=>b`
		<div class="admin-plugin-card">
			<div
				class="admin-plugin-header"
				data-plugin-name=${t.name}
				@click=${this.handleToggleExpandClick}
			>
				<div class="admin-plugin-info">
					<strong>${t.name}</strong>
					<span class="plugin-meta">
						v${t.latestVersion??"N/A"}
						· ${t.versionCount??0} versions
						· ${t.totalDownloads??0} downloads
					</span>
				</div>
				<span class="expand-icon">
					${L(this.expandedPlugin===t.name,()=>"▼",()=>"▶")}
				</span>
			</div>
			${L(this.expandedPlugin===t.name,()=>b`
			<div class="admin-plugin-body">
				${this.renderVersionsForPlugin(t.name)}
			</div>
			`)}
		</div>
		`)}renderStats(){const t=this.plugins.length,e=this.plugins.reduce((n,i)=>n+(i.versionCount??0),0),r=this.plugins.reduce((n,i)=>n+(i.totalDownloads??0),0);return b`
		<div class="stats-grid">
			<div class="stat-card">
				<h3>Your Plugins</h3>
				<p class="stat-value">${t}</p>
			</div>
			<div class="stat-card">
				<h3>Total Versions</h3>
				<p class="stat-value">${e}</p>
			</div>
			<div class="stat-card">
				<h3>Total Downloads</h3>
				<p class="stat-value">${r}</p>
			</div>
		</div>
		`}render(){return b`
		<div class="header-bar">
			<h1>Plugin Administration</h1>
			<div class="header-actions">
				<router-link to="/" class="btn btn-secondary">Dashboard</router-link>
				<button class="btn btn-secondary" @click=${this.handleLogout}>
					Logout (${this.currentUser})
				</button>
			</div>
		</div>

		${this.renderStats()}
		${this.renderUploadSection()}

		<section class="section">
			<h2>Your Plugins</h2>
			${this.renderPluginList()}
		</section>
		`}};Q.styles=de`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-text-light: #888;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-danger: #dc3545;
			--color-danger-hover: #c82333;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--color-alert-success-bg: #d4edda;
			--color-alert-success-text: #155724;
			--color-alert-success-border: #c3e6cb;
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--spacing-xs: 4px;
			--spacing-sm: 6px;
			--spacing-md: 8px;
			--spacing-lg: 10px;
			--spacing-xl: 12px;
			--spacing-2xl: 16px;
			--spacing-3xl: 20px;
			--spacing-4xl: 24px;
			--spacing-5xl: 30px;
			--spacing-6xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 13px;
			--font-size-md: 14px;
			--font-size-lg: 32px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-3xl);
			max-width: 1400px;
			margin: 0 auto;
		}
		h1 {
			margin: 0;
			color: var(--color-text);
		}
		h2 {
			color: var(--color-text);
			margin: 0 0 var(--spacing-2xl);
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-3xl);
		}
		.header-actions {
			display: flex;
			gap: var(--spacing-md);
			align-items: center;
		}
		.section {
			margin-top: var(--spacing-4xl);
		}
		/* Stats */
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--spacing-3xl);
			margin-bottom: var(--spacing-4xl);
		}
		.stat-card {
			background: var(--color-bg-surface);
			padding: var(--spacing-3xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			& h3 {
				margin: 0 0 var(--spacing-lg) 0;
				font-size: var(--font-size-md);
				color: var(--color-text-muted);
				font-weight: 500;
			}
		}
		.stat-value {
			font-size: var(--font-size-lg);
			font-weight: 700;
			color: var(--color-primary);
			margin: 0;
		}
		/* Plugin cards */
		.admin-plugin-card {
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			margin-bottom: var(--spacing-xl);
			overflow: hidden;
		}
		.admin-plugin-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--spacing-2xl) var(--spacing-3xl);
			cursor: pointer;
			transition: background 0.2s;
			&:hover {
				background: var(--color-bg-muted);
			}
		}
		.admin-plugin-info {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-xs);
		}
		.plugin-meta {
			font-size: var(--font-size-base);
			color: var(--color-text-light);
		}
		.expand-icon {
			color: var(--color-primary);
			font-size: var(--font-size-sm);
		}
		.admin-plugin-body {
			padding: 0 var(--spacing-3xl) var(--spacing-3xl);
			border-top: 1px solid var(--color-border-light);
		}
		/* Upload */
		.upload-form {
			max-width: 600px;
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.form-group {
			margin-bottom: var(--spacing-3xl);
			& label {
				display: block;
				margin-bottom: var(--spacing-md);
				font-weight: 500;
				color: var(--color-text);
			}
			& input[type='file'] {
				width: 100%;
				padding: var(--spacing-lg);
				border: 2px dashed var(--color-border);
				border-radius: var(--radius-sm);
				cursor: pointer;
				transition: all var(--transition-speed);
				&:hover:not(:disabled) {
					border-color: var(--color-primary);
				}
				&:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
			}
		}
		.upload-progress {
			text-align: center;
			padding: var(--spacing-3xl);
			color: var(--color-primary);
			font-weight: 500;
		}
		.form-actions {
			margin-top: var(--spacing-3xl);
		}
		/* Versions table */
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: var(--spacing-2xl);
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-lg) var(--spacing-xl);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-lg) var(--spacing-xl);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		/* Alerts */
		.alert {
			padding: var(--spacing-2xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-3xl);
		}
		.alert-success {
			background: var(--color-alert-success-bg);
			color: var(--color-alert-success-text);
			border: 1px solid var(--color-alert-success-border);
		}
		.alert-error {
			background: var(--color-alert-error-bg);
			color: var(--color-alert-error-text);
			border: 1px solid var(--color-alert-error-border);
		}
		/* Buttons */
		.btn {
			padding: var(--spacing-md) var(--spacing-2xl);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-md);
			transition: all var(--transition-speed);
			text-decoration: none;
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-xl) var(--spacing-4xl);
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-secondary {
			background: var(--color-secondary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-secondary-hover);
			}
		}
		.btn-small {
			padding: var(--spacing-sm) var(--spacing-xl);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
		}
		.btn-danger {
			background: var(--color-danger);
			color: white;
			&:hover {
				background: var(--color-danger-hover);
			}
		}
		/* States */
		.loading {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
	`;re([P()],Q.prototype,"plugins",2);re([P()],Q.prototype,"loading",2);re([P()],Q.prototype,"currentUser",2);re([P()],Q.prototype,"uploadStatus",2);re([P()],Q.prototype,"uploadError",2);re([P()],Q.prototype,"uploadProgress",2);re([P()],Q.prototype,"expandedPlugin",2);re([P()],Q.prototype,"pluginDetails",2);Q=re([he("plugin-admin")],Q);var ti=Object.defineProperty,ri=Object.getOwnPropertyDescriptor,we=(t,e,r,n)=>{for(var i=n>1?void 0:n?ri(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&ti(e,r,i),i};let oe=class extends pe{constructor(){super(...arguments),this.plugins=[],this.loading=!1,this.search="",this.page=1,this.totalPages=1}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const t=await K.getPlugins({search:this.search||void 0,page:this.page,pageSize:20});this.plugins=t.plugins,this.totalPages=t.totalPages}catch(t){console.error("Failed to load plugins:",t)}finally{this.loading=!1}}handleSearchInput(t){this.search=t.target.value}async handleSearch(t){t?.preventDefault(),this.page=1,await this.loadPlugins()}handlePreviousPage(){this.page>1&&(this.page--,this.loadPlugins())}handleNextPage(){this.page<this.totalPages&&(this.page++,this.loadPlugins())}handleViewDetails(t){const{pluginName:e}=le(t,"pluginName");e&&B.navigate(`/plugin/${encodeURIComponent(e)}`)}renderPagination(){return this.totalPages<=1?Tt:b`
		<div class="pagination">
			<button
				class="btn btn-secondary btn-small"
				?disabled=${this.page<=1}
				@click=${this.handlePreviousPage}
			>
				Previous
			</button>
			<span class="page-info">Page ${this.page} of ${this.totalPages}</span>
			<button
				class="btn btn-secondary btn-small"
				?disabled=${this.page>=this.totalPages}
				@click=${this.handleNextPage}
			>
				Next
			</button>
		</div>
		`}render(){return b`
		<div class="header-bar">
			<h1>Browse Plugins</h1>
		</div>

		<form class="search-bar" @submit=${this.handleSearch}>
			<input
				type="text"
				class="search-input"
				placeholder="Search plugins..."
				.value=${this.search}
				@input=${this.handleSearchInput}
			/>
			<button type="submit" class="btn btn-primary">Search</button>
		</form>

		${L(this.loading,()=>b`
		<div class="loading">Loading...</div>
		`,()=>L(this.plugins.length===0,()=>b`
		<p class="empty-state">No plugins found.</p>
		`,()=>b`
		<table class="plugins-table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Latest Version</th>
					<th>Author</th>
					<th>Description</th>
					<th>Downloads</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${this.plugins.map(t=>b`
				<tr>
					<td><strong>${t.name}</strong></td>
					<td>${t.latestVersion??"N/A"}</td>
					<td>${t.author??""}</td>
					<td>${t.description??""}</td>
					<td>${t.totalDownloads??0}</td>
					<td>
						<button
							class="btn-small btn-primary"
							data-plugin-name="${t.name}"
							@click=${this.handleViewDetails}
						>
							View Details
						</button>
					</td>
				</tr>
				`)}
			</tbody>
		</table>
		${this.renderPagination()}
		`))}
		`}};oe.styles=de`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-2xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 14px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-xl);
			max-width: 1400px;
		}
		h1 {
			margin: 0;
			color: var(--color-text);
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-xl);
		}
		.header-actions {
			display: flex;
			gap: var(--spacing-sm);
			align-items: center;
		}
		.search-bar {
			display: flex;
			gap: 10px;
			margin-bottom: var(--spacing-xl);
		}
		.search-input {
			flex: 1;
			padding: 10px var(--spacing-lg);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-base);
			transition: border-color var(--transition-speed);
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}
		.loading {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-md);
			overflow: hidden;
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-md);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-md);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.pagination {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: var(--spacing-lg);
			margin-top: var(--spacing-xl);
			padding: var(--spacing-lg) 0;
		}
		.page-info {
			font-size: var(--font-size-base);
			color: var(--color-text-muted);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-lg);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
			text-decoration: none;
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
		}
		.btn-secondary {
			background: var(--color-secondary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-secondary-hover);
			}
		}
		.btn-small {
			padding: 6px var(--spacing-md);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
	`;we([P()],oe.prototype,"plugins",2);we([P()],oe.prototype,"loading",2);we([P()],oe.prototype,"search",2);we([P()],oe.prototype,"page",2);we([P()],oe.prototype,"totalPages",2);oe=we([he("plugin-browse")],oe);const ni={CHILD:2},ii=t=>(...e)=>({_$litDirective$:t,values:e});class oi{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,r,n){this._$Ct=e,this._$AM=r,this._$Ci=n}_$AS(e,r){return this.update(e,r)}update(e,r){return this.render(...r)}}class At extends oi{constructor(e){if(super(e),this.it=Tt,e.type!==ni.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===Tt||e==null)return this._t=void 0,this.it=e;if(e===Kn)return e;if(typeof e!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const r=[e];return r.raw=r,this._t={_$litType$:this.constructor.resultType,strings:r,values:[]}}}At.directiveName="unsafeHTML",At.resultType=1;const ai=ii(At);function qt(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var ge=qt();function qr(t){ge=t}var Ce={exec:()=>null};function R(t,e=""){let r=typeof t=="string"?t:t.source,n={replace:(i,o)=>{let a=typeof o=="string"?o:o.source;return a=a.replace(M.caret,"$1"),r=r.replace(i,a),n},getRegex:()=>new RegExp(r,e)};return n}var si=(()=>{try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}})(),M={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:t=>new RegExp(`^( {0,3}${t})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}#`),htmlBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}<(?:[a-z].*>|!--)`,"i")},li=/^(?:[ \t]*(?:\n|$))+/,ci=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ui=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,Me=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,di=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Wt=/(?:[*+-]|\d{1,9}[.)])/,Wr=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,Kr=R(Wr).replace(/bull/g,Wt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),pi=R(Wr).replace(/bull/g,Wt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Kt=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,hi=/^[^\n]+/,Qt=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,gi=R(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",Qt).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),mi=R(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,Wt).getRegex(),pt="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Xt=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,fi=R("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",Xt).replace("tag",pt).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Qr=R(Kt).replace("hr",Me).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",pt).getRegex(),_i=R(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Qr).getRegex(),Yt={blockquote:_i,code:ci,def:gi,fences:ui,heading:di,hr:Me,html:fi,lheading:Kr,list:mi,newline:li,paragraph:Qr,table:Ce,text:hi},mr=R("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",Me).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",pt).getRegex(),vi={...Yt,lheading:pi,table:mr,paragraph:R(Kt).replace("hr",Me).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",mr).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",pt).getRegex()},bi={...Yt,html:R(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Xt).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Ce,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:R(Kt).replace("hr",Me).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Kr).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},yi=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,xi=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Xr=/^( {2,}|\\)\n(?!\s*$)/,ki=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,ht=/[\p{P}\p{S}]/u,Zt=/[\s\p{P}\p{S}]/u,Yr=/[^\s\p{P}\p{S}]/u,wi=R(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,Zt).getRegex(),Zr=/(?!~)[\p{P}\p{S}]/u,Ei=/(?!~)[\s\p{P}\p{S}]/u,Ri=/(?:[^\s\p{P}\p{S}]|~)/u,Pi=R(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",si?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),Jr=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,Si=R(Jr,"u").replace(/punct/g,ht).getRegex(),Ti=R(Jr,"u").replace(/punct/g,Zr).getRegex(),en="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Ai=R(en,"gu").replace(/notPunctSpace/g,Yr).replace(/punctSpace/g,Zt).replace(/punct/g,ht).getRegex(),Li=R(en,"gu").replace(/notPunctSpace/g,Ri).replace(/punctSpace/g,Ei).replace(/punct/g,Zr).getRegex(),Ii=R("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Yr).replace(/punctSpace/g,Zt).replace(/punct/g,ht).getRegex(),Ci=R(/\\(punct)/,"gu").replace(/punct/g,ht).getRegex(),Oi=R(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Di=R(Xt).replace("(?:-->|$)","-->").getRegex(),$i=R("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Di).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Ye=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,Ni=R(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",Ye).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),tn=R(/^!?\[(label)\]\[(ref)\]/).replace("label",Ye).replace("ref",Qt).getRegex(),rn=R(/^!?\[(ref)\](?:\[\])?/).replace("ref",Qt).getRegex(),Vi=R("reflink|nolink(?!\\()","g").replace("reflink",tn).replace("nolink",rn).getRegex(),fr=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Jt={_backpedal:Ce,anyPunctuation:Ci,autolink:Oi,blockSkip:Pi,br:Xr,code:xi,del:Ce,emStrongLDelim:Si,emStrongRDelimAst:Ai,emStrongRDelimUnd:Ii,escape:yi,link:Ni,nolink:rn,punctuation:wi,reflink:tn,reflinkSearch:Vi,tag:$i,text:ki,url:Ce},zi={...Jt,link:R(/^!?\[(label)\]\((.*?)\)/).replace("label",Ye).getRegex(),reflink:R(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Ye).getRegex()},Lt={...Jt,emStrongRDelimAst:Li,emStrongLDelim:Ti,url:R(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",fr).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:R(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",fr).getRegex()},Mi={...Lt,br:R(Xr).replace("{2,}","*").getRegex(),text:R(Lt.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Ue={normal:Yt,gfm:vi,pedantic:bi},Pe={normal:Jt,gfm:Lt,breaks:Mi,pedantic:zi},Bi={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},_r=t=>Bi[t];function Y(t,e){if(e){if(M.escapeTest.test(t))return t.replace(M.escapeReplace,_r)}else if(M.escapeTestNoEncode.test(t))return t.replace(M.escapeReplaceNoEncode,_r);return t}function vr(t){try{t=encodeURI(t).replace(M.percentDecode,"%")}catch{return null}return t}function br(t,e){let r=t.replace(M.findPipe,(o,a,l)=>{let s=!1,u=a;for(;--u>=0&&l[u]==="\\";)s=!s;return s?"|":" |"}),n=r.split(M.splitPipe),i=0;if(n[0].trim()||n.shift(),n.length>0&&!n.at(-1)?.trim()&&n.pop(),e)if(n.length>e)n.splice(e);else for(;n.length<e;)n.push("");for(;i<n.length;i++)n[i]=n[i].trim().replace(M.slashPipe,"|");return n}function Se(t,e,r){let n=t.length;if(n===0)return"";let i=0;for(;i<n&&t.charAt(n-i-1)===e;)i++;return t.slice(0,n-i)}function ji(t,e){if(t.indexOf(e[1])===-1)return-1;let r=0;for(let n=0;n<t.length;n++)if(t[n]==="\\")n++;else if(t[n]===e[0])r++;else if(t[n]===e[1]&&(r--,r<0))return n;return r>0?-2:-1}function yr(t,e,r,n,i){let o=e.href,a=e.title||null,l=t[1].replace(i.other.outputLinkReplace,"$1");n.state.inLink=!0;let s={type:t[0].charAt(0)==="!"?"image":"link",raw:r,href:o,title:a,text:l,tokens:n.inlineTokens(l)};return n.state.inLink=!1,s}function Gi(t,e,r){let n=t.match(r.other.indentCodeCompensation);if(n===null)return e;let i=n[1];return e.split(`
`).map(o=>{let a=o.match(r.other.beginningSpace);if(a===null)return o;let[l]=a;return l.length>=i.length?o.slice(i.length):o}).join(`
`)}var Ze=class{options;rules;lexer;constructor(t){this.options=t||ge}space(t){let e=this.rules.block.newline.exec(t);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(t){let e=this.rules.block.code.exec(t);if(e){let r=e[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:e[0],codeBlockStyle:"indented",text:this.options.pedantic?r:Se(r,`
`)}}}fences(t){let e=this.rules.block.fences.exec(t);if(e){let r=e[0],n=Gi(r,e[3]||"",this.rules);return{type:"code",raw:r,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:n}}}heading(t){let e=this.rules.block.heading.exec(t);if(e){let r=e[2].trim();if(this.rules.other.endingHash.test(r)){let n=Se(r,"#");(this.options.pedantic||!n||this.rules.other.endingSpaceChar.test(n))&&(r=n.trim())}return{type:"heading",raw:e[0],depth:e[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(t){let e=this.rules.block.hr.exec(t);if(e)return{type:"hr",raw:Se(e[0],`
`)}}blockquote(t){let e=this.rules.block.blockquote.exec(t);if(e){let r=Se(e[0],`
`).split(`
`),n="",i="",o=[];for(;r.length>0;){let a=!1,l=[],s;for(s=0;s<r.length;s++)if(this.rules.other.blockquoteStart.test(r[s]))l.push(r[s]),a=!0;else if(!a)l.push(r[s]);else break;r=r.slice(s);let u=l.join(`
`),d=u.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");n=n?`${n}
${u}`:u,i=i?`${i}
${d}`:d;let p=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(d,o,!0),this.lexer.state.top=p,r.length===0)break;let h=o.at(-1);if(h?.type==="code")break;if(h?.type==="blockquote"){let g=h,m=g.raw+`
`+r.join(`
`),y=this.blockquote(m);o[o.length-1]=y,n=n.substring(0,n.length-g.raw.length)+y.raw,i=i.substring(0,i.length-g.text.length)+y.text;break}else if(h?.type==="list"){let g=h,m=g.raw+`
`+r.join(`
`),y=this.list(m);o[o.length-1]=y,n=n.substring(0,n.length-h.raw.length)+y.raw,i=i.substring(0,i.length-g.raw.length)+y.raw,r=m.substring(o.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:n,tokens:o,text:i}}}list(t){let e=this.rules.block.list.exec(t);if(e){let r=e[1].trim(),n=r.length>1,i={type:"list",raw:"",ordered:n,start:n?+r.slice(0,-1):"",loose:!1,items:[]};r=n?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=n?r:"[*+-]");let o=this.rules.other.listItemRegex(r),a=!1;for(;t;){let s=!1,u="",d="";if(!(e=o.exec(t))||this.rules.block.hr.test(t))break;u=e[0],t=t.substring(u.length);let p=e[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,v=>" ".repeat(3*v.length)),h=t.split(`
`,1)[0],g=!p.trim(),m=0;if(this.options.pedantic?(m=2,d=p.trimStart()):g?m=e[1].length+1:(m=e[2].search(this.rules.other.nonSpaceChar),m=m>4?1:m,d=p.slice(m),m+=e[1].length),g&&this.rules.other.blankLine.test(h)&&(u+=h+`
`,t=t.substring(h.length+1),s=!0),!s){let v=this.rules.other.nextBulletRegex(m),x=this.rules.other.hrRegex(m),_=this.rules.other.fencesBeginRegex(m),E=this.rules.other.headingBeginRegex(m),T=this.rules.other.htmlBeginRegex(m);for(;t;){let N=t.split(`
`,1)[0],U;if(h=N,this.options.pedantic?(h=h.replace(this.rules.other.listReplaceNesting,"  "),U=h):U=h.replace(this.rules.other.tabCharGlobal,"    "),_.test(h)||E.test(h)||T.test(h)||v.test(h)||x.test(h))break;if(U.search(this.rules.other.nonSpaceChar)>=m||!h.trim())d+=`
`+U.slice(m);else{if(g||p.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||_.test(p)||E.test(p)||x.test(p))break;d+=`
`+h}!g&&!h.trim()&&(g=!0),u+=N+`
`,t=t.substring(N.length+1),p=U.slice(m)}}i.loose||(a?i.loose=!0:this.rules.other.doubleBlankLine.test(u)&&(a=!0));let y=null,k;this.options.gfm&&(y=this.rules.other.listIsTask.exec(d),y&&(k=y[0]!=="[ ] ",d=d.replace(this.rules.other.listReplaceTask,""))),i.items.push({type:"list_item",raw:u,task:!!y,checked:k,loose:!1,text:d,tokens:[]}),i.raw+=u}let l=i.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;i.raw=i.raw.trimEnd();for(let s=0;s<i.items.length;s++)if(this.lexer.state.top=!1,i.items[s].tokens=this.lexer.blockTokens(i.items[s].text,[]),!i.loose){let u=i.items[s].tokens.filter(p=>p.type==="space"),d=u.length>0&&u.some(p=>this.rules.other.anyLine.test(p.raw));i.loose=d}if(i.loose)for(let s=0;s<i.items.length;s++)i.items[s].loose=!0;return i}}html(t){let e=this.rules.block.html.exec(t);if(e)return{type:"html",block:!0,raw:e[0],pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:e[0]}}def(t){let e=this.rules.block.def.exec(t);if(e){let r=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),n=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",i=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:r,raw:e[0],href:n,title:i}}}table(t){let e=this.rules.block.table.exec(t);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;let r=br(e[1]),n=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),i=e[3]?.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],o={type:"table",raw:e[0],header:[],align:[],rows:[]};if(r.length===n.length){for(let a of n)this.rules.other.tableAlignRight.test(a)?o.align.push("right"):this.rules.other.tableAlignCenter.test(a)?o.align.push("center"):this.rules.other.tableAlignLeft.test(a)?o.align.push("left"):o.align.push(null);for(let a=0;a<r.length;a++)o.header.push({text:r[a],tokens:this.lexer.inline(r[a]),header:!0,align:o.align[a]});for(let a of i)o.rows.push(br(a,o.header.length).map((l,s)=>({text:l,tokens:this.lexer.inline(l),header:!1,align:o.align[s]})));return o}}lheading(t){let e=this.rules.block.lheading.exec(t);if(e)return{type:"heading",raw:e[0],depth:e[2].charAt(0)==="="?1:2,text:e[1],tokens:this.lexer.inline(e[1])}}paragraph(t){let e=this.rules.block.paragraph.exec(t);if(e){let r=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:r,tokens:this.lexer.inline(r)}}}text(t){let e=this.rules.block.text.exec(t);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(t){let e=this.rules.inline.escape.exec(t);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(t){let e=this.rules.inline.tag.exec(t);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(t){let e=this.rules.inline.link.exec(t);if(e){let r=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let o=Se(r.slice(0,-1),"\\");if((r.length-o.length)%2===0)return}else{let o=ji(e[2],"()");if(o===-2)return;if(o>-1){let a=(e[0].indexOf("!")===0?5:4)+e[1].length+o;e[2]=e[2].substring(0,o),e[0]=e[0].substring(0,a).trim(),e[3]=""}}let n=e[2],i="";if(this.options.pedantic){let o=this.rules.other.pedanticHrefTitle.exec(n);o&&(n=o[1],i=o[3])}else i=e[3]?e[3].slice(1,-1):"";return n=n.trim(),this.rules.other.startAngleBracket.test(n)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?n=n.slice(1):n=n.slice(1,-1)),yr(e,{href:n&&n.replace(this.rules.inline.anyPunctuation,"$1"),title:i&&i.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(t,e){let r;if((r=this.rules.inline.reflink.exec(t))||(r=this.rules.inline.nolink.exec(t))){let n=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),i=e[n.toLowerCase()];if(!i){let o=r[0].charAt(0);return{type:"text",raw:o,text:o}}return yr(r,i,r[0],this.lexer,this.rules)}}emStrong(t,e,r=""){let n=this.rules.inline.emStrongLDelim.exec(t);if(!(!n||n[3]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(n[1]||n[2])||!r||this.rules.inline.punctuation.exec(r))){let i=[...n[0]].length-1,o,a,l=i,s=0,u=n[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(u.lastIndex=0,e=e.slice(-1*t.length+i);(n=u.exec(e))!=null;){if(o=n[1]||n[2]||n[3]||n[4]||n[5]||n[6],!o)continue;if(a=[...o].length,n[3]||n[4]){l+=a;continue}else if((n[5]||n[6])&&i%3&&!((i+a)%3)){s+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+s);let d=[...n[0]][0].length,p=t.slice(0,i+n.index+d+a);if(Math.min(i,a)%2){let g=p.slice(1,-1);return{type:"em",raw:p,text:g,tokens:this.lexer.inlineTokens(g)}}let h=p.slice(2,-2);return{type:"strong",raw:p,text:h,tokens:this.lexer.inlineTokens(h)}}}}codespan(t){let e=this.rules.inline.code.exec(t);if(e){let r=e[2].replace(this.rules.other.newLineCharGlobal," "),n=this.rules.other.nonSpaceChar.test(r),i=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return n&&i&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:e[0],text:r}}}br(t){let e=this.rules.inline.br.exec(t);if(e)return{type:"br",raw:e[0]}}del(t){let e=this.rules.inline.del.exec(t);if(e)return{type:"del",raw:e[0],text:e[2],tokens:this.lexer.inlineTokens(e[2])}}autolink(t){let e=this.rules.inline.autolink.exec(t);if(e){let r,n;return e[2]==="@"?(r=e[1],n="mailto:"+r):(r=e[1],n=r),{type:"link",raw:e[0],text:r,href:n,tokens:[{type:"text",raw:r,text:r}]}}}url(t){let e;if(e=this.rules.inline.url.exec(t)){let r,n;if(e[2]==="@")r=e[0],n="mailto:"+r;else{let i;do i=e[0],e[0]=this.rules.inline._backpedal.exec(e[0])?.[0]??"";while(i!==e[0]);r=e[0],e[1]==="www."?n="http://"+e[0]:n=e[0]}return{type:"link",raw:e[0],text:r,href:n,tokens:[{type:"text",raw:r,text:r}]}}}inlineText(t){let e=this.rules.inline.text.exec(t);if(e){let r=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:r}}}},q=class It{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||ge,this.options.tokenizer=this.options.tokenizer||new Ze,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:M,block:Ue.normal,inline:Pe.normal};this.options.pedantic?(r.block=Ue.pedantic,r.inline=Pe.pedantic):this.options.gfm&&(r.block=Ue.gfm,this.options.breaks?r.inline=Pe.breaks:r.inline=Pe.gfm),this.tokenizer.rules=r}static get rules(){return{block:Ue,inline:Pe}}static lex(e,r){return new It(r).lex(e)}static lexInline(e,r){return new It(r).inlineTokens(e)}lex(e){e=e.replace(M.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let n=this.inlineQueue[r];this.inlineTokens(n.src,n.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,r=[],n=!1){for(this.options.pedantic&&(e=e.replace(M.tabCharGlobal,"    ").replace(M.spaceLine,""));e;){let i;if(this.options.extensions?.block?.some(a=>(i=a.call({lexer:this},e,r))?(e=e.substring(i.raw.length),r.push(i),!0):!1))continue;if(i=this.tokenizer.space(e)){e=e.substring(i.raw.length);let a=r.at(-1);i.raw.length===1&&a!==void 0?a.raw+=`
`:r.push(i);continue}if(i=this.tokenizer.code(e)){e=e.substring(i.raw.length);let a=r.at(-1);a?.type==="paragraph"||a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.at(-1).src=a.text):r.push(i);continue}if(i=this.tokenizer.fences(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.heading(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.hr(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.blockquote(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.list(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.html(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.def(e)){e=e.substring(i.raw.length);let a=r.at(-1);a?.type==="paragraph"||a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.raw,this.inlineQueue.at(-1).src=a.text):this.tokens.links[i.tag]||(this.tokens.links[i.tag]={href:i.href,title:i.title},r.push(i));continue}if(i=this.tokenizer.table(e)){e=e.substring(i.raw.length),r.push(i);continue}if(i=this.tokenizer.lheading(e)){e=e.substring(i.raw.length),r.push(i);continue}let o=e;if(this.options.extensions?.startBlock){let a=1/0,l=e.slice(1),s;this.options.extensions.startBlock.forEach(u=>{s=u.call({lexer:this},l),typeof s=="number"&&s>=0&&(a=Math.min(a,s))}),a<1/0&&a>=0&&(o=e.substring(0,a+1))}if(this.state.top&&(i=this.tokenizer.paragraph(o))){let a=r.at(-1);n&&a?.type==="paragraph"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):r.push(i),n=o.length!==e.length,e=e.substring(i.raw.length);continue}if(i=this.tokenizer.text(e)){e=e.substring(i.raw.length);let a=r.at(-1);a?.type==="text"?(a.raw+=(a.raw.endsWith(`
`)?"":`
`)+i.raw,a.text+=`
`+i.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=a.text):r.push(i);continue}if(e){let a="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(a);break}else throw new Error(a)}}return this.state.top=!0,r}inline(e,r=[]){return this.inlineQueue.push({src:e,tokens:r}),r}inlineTokens(e,r=[]){let n=e,i=null;if(this.tokens.links){let s=Object.keys(this.tokens.links);if(s.length>0)for(;(i=this.tokenizer.rules.inline.reflinkSearch.exec(n))!=null;)s.includes(i[0].slice(i[0].lastIndexOf("[")+1,-1))&&(n=n.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(i=this.tokenizer.rules.inline.anyPunctuation.exec(n))!=null;)n=n.slice(0,i.index)+"++"+n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let o;for(;(i=this.tokenizer.rules.inline.blockSkip.exec(n))!=null;)o=i[2]?i[2].length:0,n=n.slice(0,i.index+o)+"["+"a".repeat(i[0].length-o-2)+"]"+n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);n=this.options.hooks?.emStrongMask?.call({lexer:this},n)??n;let a=!1,l="";for(;e;){a||(l=""),a=!1;let s;if(this.options.extensions?.inline?.some(d=>(s=d.call({lexer:this},e,r))?(e=e.substring(s.raw.length),r.push(s),!0):!1))continue;if(s=this.tokenizer.escape(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.tag(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.link(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(s.raw.length);let d=r.at(-1);s.type==="text"&&d?.type==="text"?(d.raw+=s.raw,d.text+=s.text):r.push(s);continue}if(s=this.tokenizer.emStrong(e,n,l)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.codespan(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.br(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.del(e)){e=e.substring(s.raw.length),r.push(s);continue}if(s=this.tokenizer.autolink(e)){e=e.substring(s.raw.length),r.push(s);continue}if(!this.state.inLink&&(s=this.tokenizer.url(e))){e=e.substring(s.raw.length),r.push(s);continue}let u=e;if(this.options.extensions?.startInline){let d=1/0,p=e.slice(1),h;this.options.extensions.startInline.forEach(g=>{h=g.call({lexer:this},p),typeof h=="number"&&h>=0&&(d=Math.min(d,h))}),d<1/0&&d>=0&&(u=e.substring(0,d+1))}if(s=this.tokenizer.inlineText(u)){e=e.substring(s.raw.length),s.raw.slice(-1)!=="_"&&(l=s.raw.slice(-1)),a=!0;let d=r.at(-1);d?.type==="text"?(d.raw+=s.raw,d.text+=s.text):r.push(s);continue}if(e){let d="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(d);break}else throw new Error(d)}}return r}},Je=class{options;parser;constructor(t){this.options=t||ge}space(t){return""}code({text:t,lang:e,escaped:r}){let n=(e||"").match(M.notSpaceStart)?.[0],i=t.replace(M.endingNewline,"")+`
`;return n?'<pre><code class="language-'+Y(n)+'">'+(r?i:Y(i,!0))+`</code></pre>
`:"<pre><code>"+(r?i:Y(i,!0))+`</code></pre>
`}blockquote({tokens:t}){return`<blockquote>
${this.parser.parse(t)}</blockquote>
`}html({text:t}){return t}def(t){return""}heading({tokens:t,depth:e}){return`<h${e}>${this.parser.parseInline(t)}</h${e}>
`}hr(t){return`<hr>
`}list(t){let e=t.ordered,r=t.start,n="";for(let a=0;a<t.items.length;a++){let l=t.items[a];n+=this.listitem(l)}let i=e?"ol":"ul",o=e&&r!==1?' start="'+r+'"':"";return"<"+i+o+`>
`+n+"</"+i+`>
`}listitem(t){let e="";if(t.task){let r=this.checkbox({checked:!!t.checked});t.loose?t.tokens[0]?.type==="paragraph"?(t.tokens[0].text=r+" "+t.tokens[0].text,t.tokens[0].tokens&&t.tokens[0].tokens.length>0&&t.tokens[0].tokens[0].type==="text"&&(t.tokens[0].tokens[0].text=r+" "+Y(t.tokens[0].tokens[0].text),t.tokens[0].tokens[0].escaped=!0)):t.tokens.unshift({type:"text",raw:r+" ",text:r+" ",escaped:!0}):e+=r+" "}return e+=this.parser.parse(t.tokens,!!t.loose),`<li>${e}</li>
`}checkbox({checked:t}){return"<input "+(t?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:t}){return`<p>${this.parser.parseInline(t)}</p>
`}table(t){let e="",r="";for(let i=0;i<t.header.length;i++)r+=this.tablecell(t.header[i]);e+=this.tablerow({text:r});let n="";for(let i=0;i<t.rows.length;i++){let o=t.rows[i];r="";for(let a=0;a<o.length;a++)r+=this.tablecell(o[a]);n+=this.tablerow({text:r})}return n&&(n=`<tbody>${n}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+n+`</table>
`}tablerow({text:t}){return`<tr>
${t}</tr>
`}tablecell(t){let e=this.parser.parseInline(t.tokens),r=t.header?"th":"td";return(t.align?`<${r} align="${t.align}">`:`<${r}>`)+e+`</${r}>
`}strong({tokens:t}){return`<strong>${this.parser.parseInline(t)}</strong>`}em({tokens:t}){return`<em>${this.parser.parseInline(t)}</em>`}codespan({text:t}){return`<code>${Y(t,!0)}</code>`}br(t){return"<br>"}del({tokens:t}){return`<del>${this.parser.parseInline(t)}</del>`}link({href:t,title:e,tokens:r}){let n=this.parser.parseInline(r),i=vr(t);if(i===null)return n;t=i;let o='<a href="'+t+'"';return e&&(o+=' title="'+Y(e)+'"'),o+=">"+n+"</a>",o}image({href:t,title:e,text:r,tokens:n}){n&&(r=this.parser.parseInline(n,this.parser.textRenderer));let i=vr(t);if(i===null)return Y(r);t=i;let o=`<img src="${t}" alt="${r}"`;return e&&(o+=` title="${Y(e)}"`),o+=">",o}text(t){return"tokens"in t&&t.tokens?this.parser.parseInline(t.tokens):"escaped"in t&&t.escaped?t.text:Y(t.text)}},er=class{strong({text:t}){return t}em({text:t}){return t}codespan({text:t}){return t}del({text:t}){return t}html({text:t}){return t}text({text:t}){return t}link({text:t}){return""+t}image({text:t}){return""+t}br(){return""}},W=class Ct{options;renderer;textRenderer;constructor(e){this.options=e||ge,this.options.renderer=this.options.renderer||new Je,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new er}static parse(e,r){return new Ct(r).parse(e)}static parseInline(e,r){return new Ct(r).parseInline(e)}parse(e,r=!0){let n="";for(let i=0;i<e.length;i++){let o=e[i];if(this.options.extensions?.renderers?.[o.type]){let l=o,s=this.options.extensions.renderers[l.type].call({parser:this},l);if(s!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(l.type)){n+=s||"";continue}}let a=o;switch(a.type){case"space":{n+=this.renderer.space(a);continue}case"hr":{n+=this.renderer.hr(a);continue}case"heading":{n+=this.renderer.heading(a);continue}case"code":{n+=this.renderer.code(a);continue}case"table":{n+=this.renderer.table(a);continue}case"blockquote":{n+=this.renderer.blockquote(a);continue}case"list":{n+=this.renderer.list(a);continue}case"html":{n+=this.renderer.html(a);continue}case"def":{n+=this.renderer.def(a);continue}case"paragraph":{n+=this.renderer.paragraph(a);continue}case"text":{let l=a,s=this.renderer.text(l);for(;i+1<e.length&&e[i+1].type==="text";)l=e[++i],s+=`
`+this.renderer.text(l);r?n+=this.renderer.paragraph({type:"paragraph",raw:s,text:s,tokens:[{type:"text",raw:s,text:s,escaped:!0}]}):n+=s;continue}default:{let l='Token with "'+a.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return n}parseInline(e,r=this.renderer){let n="";for(let i=0;i<e.length;i++){let o=e[i];if(this.options.extensions?.renderers?.[o.type]){let l=this.options.extensions.renderers[o.type].call({parser:this},o);if(l!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(o.type)){n+=l||"";continue}}let a=o;switch(a.type){case"escape":{n+=r.text(a);break}case"html":{n+=r.html(a);break}case"link":{n+=r.link(a);break}case"image":{n+=r.image(a);break}case"strong":{n+=r.strong(a);break}case"em":{n+=r.em(a);break}case"codespan":{n+=r.codespan(a);break}case"br":{n+=r.br(a);break}case"del":{n+=r.del(a);break}case"text":{n+=r.text(a);break}default:{let l='Token with "'+a.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return n}},Le=class{options;block;constructor(t){this.options=t||ge}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(t){return t}postprocess(t){return t}processAllTokens(t){return t}emStrongMask(t){return t}provideLexer(){return this.block?q.lex:q.lexInline}provideParser(){return this.block?W.parse:W.parseInline}},nn=class{defaults=qt();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=W;Renderer=Je;TextRenderer=er;Lexer=q;Tokenizer=Ze;Hooks=Le;constructor(...t){this.use(...t)}walkTokens(t,e){let r=[];for(let n of t)switch(r=r.concat(e.call(this,n)),n.type){case"table":{let i=n;for(let o of i.header)r=r.concat(this.walkTokens(o.tokens,e));for(let o of i.rows)for(let a of o)r=r.concat(this.walkTokens(a.tokens,e));break}case"list":{let i=n;r=r.concat(this.walkTokens(i.items,e));break}default:{let i=n;this.defaults.extensions?.childTokens?.[i.type]?this.defaults.extensions.childTokens[i.type].forEach(o=>{let a=i[o].flat(1/0);r=r.concat(this.walkTokens(a,e))}):i.tokens&&(r=r.concat(this.walkTokens(i.tokens,e)))}}return r}use(...t){let e=this.defaults.extensions||{renderers:{},childTokens:{}};return t.forEach(r=>{let n={...r};if(n.async=this.defaults.async||n.async||!1,r.extensions&&(r.extensions.forEach(i=>{if(!i.name)throw new Error("extension name required");if("renderer"in i){let o=e.renderers[i.name];o?e.renderers[i.name]=function(...a){let l=i.renderer.apply(this,a);return l===!1&&(l=o.apply(this,a)),l}:e.renderers[i.name]=i.renderer}if("tokenizer"in i){if(!i.level||i.level!=="block"&&i.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let o=e[i.level];o?o.unshift(i.tokenizer):e[i.level]=[i.tokenizer],i.start&&(i.level==="block"?e.startBlock?e.startBlock.push(i.start):e.startBlock=[i.start]:i.level==="inline"&&(e.startInline?e.startInline.push(i.start):e.startInline=[i.start]))}"childTokens"in i&&i.childTokens&&(e.childTokens[i.name]=i.childTokens)}),n.extensions=e),r.renderer){let i=this.defaults.renderer||new Je(this.defaults);for(let o in r.renderer){if(!(o in i))throw new Error(`renderer '${o}' does not exist`);if(["options","parser"].includes(o))continue;let a=o,l=r.renderer[a],s=i[a];i[a]=(...u)=>{let d=l.apply(i,u);return d===!1&&(d=s.apply(i,u)),d||""}}n.renderer=i}if(r.tokenizer){let i=this.defaults.tokenizer||new Ze(this.defaults);for(let o in r.tokenizer){if(!(o in i))throw new Error(`tokenizer '${o}' does not exist`);if(["options","rules","lexer"].includes(o))continue;let a=o,l=r.tokenizer[a],s=i[a];i[a]=(...u)=>{let d=l.apply(i,u);return d===!1&&(d=s.apply(i,u)),d}}n.tokenizer=i}if(r.hooks){let i=this.defaults.hooks||new Le;for(let o in r.hooks){if(!(o in i))throw new Error(`hook '${o}' does not exist`);if(["options","block"].includes(o))continue;let a=o,l=r.hooks[a],s=i[a];Le.passThroughHooks.has(o)?i[a]=u=>{if(this.defaults.async&&Le.passThroughHooksRespectAsync.has(o))return(async()=>{let p=await l.call(i,u);return s.call(i,p)})();let d=l.call(i,u);return s.call(i,d)}:i[a]=(...u)=>{if(this.defaults.async)return(async()=>{let p=await l.apply(i,u);return p===!1&&(p=await s.apply(i,u)),p})();let d=l.apply(i,u);return d===!1&&(d=s.apply(i,u)),d}}n.hooks=i}if(r.walkTokens){let i=this.defaults.walkTokens,o=r.walkTokens;n.walkTokens=function(a){let l=[];return l.push(o.call(this,a)),i&&(l=l.concat(i.call(this,a))),l}}this.defaults={...this.defaults,...n}}),this}setOptions(t){return this.defaults={...this.defaults,...t},this}lexer(t,e){return q.lex(t,e??this.defaults)}parser(t,e){return W.parse(t,e??this.defaults)}parseMarkdown(t){return(e,r)=>{let n={...r},i={...this.defaults,...n},o=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&n.async===!1)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof e>"u"||e===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof e!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(e)+", string expected"));if(i.hooks&&(i.hooks.options=i,i.hooks.block=t),i.async)return(async()=>{let a=i.hooks?await i.hooks.preprocess(e):e,l=await(i.hooks?await i.hooks.provideLexer():t?q.lex:q.lexInline)(a,i),s=i.hooks?await i.hooks.processAllTokens(l):l;i.walkTokens&&await Promise.all(this.walkTokens(s,i.walkTokens));let u=await(i.hooks?await i.hooks.provideParser():t?W.parse:W.parseInline)(s,i);return i.hooks?await i.hooks.postprocess(u):u})().catch(o);try{i.hooks&&(e=i.hooks.preprocess(e));let a=(i.hooks?i.hooks.provideLexer():t?q.lex:q.lexInline)(e,i);i.hooks&&(a=i.hooks.processAllTokens(a)),i.walkTokens&&this.walkTokens(a,i.walkTokens);let l=(i.hooks?i.hooks.provideParser():t?W.parse:W.parseInline)(a,i);return i.hooks&&(l=i.hooks.postprocess(l)),l}catch(a){return o(a)}}}onError(t,e){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,t){let n="<p>An error occurred:</p><pre>"+Y(r.message+"",!0)+"</pre>";return e?Promise.resolve(n):n}if(e)return Promise.reject(r);throw r}}},ce=new nn;function S(t,e){return ce.parse(t,e)}S.options=S.setOptions=function(t){return ce.setOptions(t),S.defaults=ce.defaults,qr(S.defaults),S};S.getDefaults=qt;S.defaults=ge;S.use=function(...t){return ce.use(...t),S.defaults=ce.defaults,qr(S.defaults),S};S.walkTokens=function(t,e){return ce.walkTokens(t,e)};S.parseInline=ce.parseInline;S.Parser=W;S.parser=W.parse;S.Renderer=Je;S.TextRenderer=er;S.Lexer=q;S.lexer=q.lex;S.Tokenizer=Ze;S.Hooks=Le;S.parse=S;S.options;S.setOptions;S.use;S.walkTokens;S.parseInline;W.parse;q.lex;function Ui(t={}){const{highlight:e,container:r}=t;return{async:!0,async walkTokens(n){var i;if(n.type!=="code"||typeof e!="function")return;const[o="text",...a]=((i=n.lang)==null?void 0:i.split(" "))??[],{text:l}=n,s=await e(l,o,a),u=r?r.replace("%l",String(o).toUpperCase()).replace("%s",s).replace("%t",l):s;Object.assign(n,{type:"html",block:!0,text:`${u}
`})}}}let C=class extends Error{constructor(e){super(e),this.name="ShikiError"}};function Fi(t){return tr(t)}function tr(t){return Array.isArray(t)?Hi(t):t instanceof RegExp?t:typeof t=="object"?qi(t):t}function Hi(t){let e=[];for(let r=0,n=t.length;r<n;r++)e[r]=tr(t[r]);return e}function qi(t){let e={};for(let r in t)e[r]=tr(t[r]);return e}function on(t,...e){return e.forEach(r=>{for(let n in r)t[n]=r[n]}),t}function an(t){const e=~t.lastIndexOf("/")||~t.lastIndexOf("\\");return e===0?t:~e===t.length-1?an(t.substring(0,t.length-1)):t.substr(~e+1)}var yt=/\$(\d+)|\${(\d+):\/(downcase|upcase)}/g,Fe=class{static hasCaptures(t){return t===null?!1:(yt.lastIndex=0,yt.test(t))}static replaceCaptures(t,e,r){return t.replace(yt,(n,i,o,a)=>{let l=r[parseInt(i||o,10)];if(l){let s=e.substring(l.start,l.end);for(;s[0]===".";)s=s.substring(1);switch(a){case"downcase":return s.toLowerCase();case"upcase":return s.toUpperCase();default:return s}}else return n})}};function sn(t,e){return t<e?-1:t>e?1:0}function ln(t,e){if(t===null&&e===null)return 0;if(!t)return-1;if(!e)return 1;let r=t.length,n=e.length;if(r===n){for(let i=0;i<r;i++){let o=sn(t[i],e[i]);if(o!==0)return o}return 0}return r-n}function xr(t){return!!(/^#[0-9a-f]{6}$/i.test(t)||/^#[0-9a-f]{8}$/i.test(t)||/^#[0-9a-f]{3}$/i.test(t)||/^#[0-9a-f]{4}$/i.test(t))}function cn(t){return t.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g,"\\$&")}var un=class{constructor(t){this.fn=t}cache=new Map;get(t){if(this.cache.has(t))return this.cache.get(t);const e=this.fn(t);return this.cache.set(t,e),e}},et=class{constructor(t,e,r){this._colorMap=t,this._defaults=e,this._root=r}static createFromRawTheme(t,e){return this.createFromParsedTheme(Qi(t),e)}static createFromParsedTheme(t,e){return Yi(t,e)}_cachedMatchRoot=new un(t=>this._root.match(t));getColorMap(){return this._colorMap.getColorMap()}getDefaults(){return this._defaults}match(t){if(t===null)return this._defaults;const e=t.scopeName,n=this._cachedMatchRoot.get(e).find(i=>Wi(t.parent,i.parentScopes));return n?new dn(n.fontStyle,n.foreground,n.background):null}},xt=class Qe{constructor(e,r){this.parent=e,this.scopeName=r}static push(e,r){for(const n of r)e=new Qe(e,n);return e}static from(...e){let r=null;for(let n=0;n<e.length;n++)r=new Qe(r,e[n]);return r}push(e){return new Qe(this,e)}getSegments(){let e=this;const r=[];for(;e;)r.push(e.scopeName),e=e.parent;return r.reverse(),r}toString(){return this.getSegments().join(" ")}extends(e){return this===e?!0:this.parent===null?!1:this.parent.extends(e)}getExtensionIfDefined(e){const r=[];let n=this;for(;n&&n!==e;)r.push(n.scopeName),n=n.parent;return n===e?r.reverse():void 0}};function Wi(t,e){if(e.length===0)return!0;for(let r=0;r<e.length;r++){let n=e[r],i=!1;if(n===">"){if(r===e.length-1)return!1;n=e[++r],i=!0}for(;t&&!Ki(t.scopeName,n);){if(i)return!1;t=t.parent}if(!t)return!1;t=t.parent}return!0}function Ki(t,e){return e===t||t.startsWith(e)&&t[e.length]==="."}var dn=class{constructor(t,e,r){this.fontStyle=t,this.foregroundId=e,this.backgroundId=r}};function Qi(t){if(!t)return[];if(!t.settings||!Array.isArray(t.settings))return[];let e=t.settings,r=[],n=0;for(let i=0,o=e.length;i<o;i++){let a=e[i];if(!a.settings)continue;let l;if(typeof a.scope=="string"){let p=a.scope;p=p.replace(/^[,]+/,""),p=p.replace(/[,]+$/,""),l=p.split(",")}else Array.isArray(a.scope)?l=a.scope:l=[""];let s=-1;if(typeof a.settings.fontStyle=="string"){s=0;let p=a.settings.fontStyle.split(" ");for(let h=0,g=p.length;h<g;h++)switch(p[h]){case"italic":s=s|1;break;case"bold":s=s|2;break;case"underline":s=s|4;break;case"strikethrough":s=s|8;break}}let u=null;typeof a.settings.foreground=="string"&&xr(a.settings.foreground)&&(u=a.settings.foreground);let d=null;typeof a.settings.background=="string"&&xr(a.settings.background)&&(d=a.settings.background);for(let p=0,h=l.length;p<h;p++){let m=l[p].trim().split(" "),y=m[m.length-1],k=null;m.length>1&&(k=m.slice(0,m.length-1),k.reverse()),r[n++]=new Xi(y,k,i,s,u,d)}}return r}var Xi=class{constructor(t,e,r,n,i,o){this.scope=t,this.parentScopes=e,this.index=r,this.fontStyle=n,this.foreground=i,this.background=o}},z=(t=>(t[t.NotSet=-1]="NotSet",t[t.None=0]="None",t[t.Italic=1]="Italic",t[t.Bold=2]="Bold",t[t.Underline=4]="Underline",t[t.Strikethrough=8]="Strikethrough",t))(z||{});function Yi(t,e){t.sort((s,u)=>{let d=sn(s.scope,u.scope);return d!==0||(d=ln(s.parentScopes,u.parentScopes),d!==0)?d:s.index-u.index});let r=0,n="#000000",i="#ffffff";for(;t.length>=1&&t[0].scope==="";){let s=t.shift();s.fontStyle!==-1&&(r=s.fontStyle),s.foreground!==null&&(n=s.foreground),s.background!==null&&(i=s.background)}let o=new Zi(e),a=new dn(r,o.getId(n),o.getId(i)),l=new eo(new Ot(0,null,-1,0,0),[]);for(let s=0,u=t.length;s<u;s++){let d=t[s];l.insert(0,d.scope,d.parentScopes,d.fontStyle,o.getId(d.foreground),o.getId(d.background))}return new et(o,a,l)}var Zi=class{_isFrozen;_lastColorId;_id2color;_color2id;constructor(t){if(this._lastColorId=0,this._id2color=[],this._color2id=Object.create(null),Array.isArray(t)){this._isFrozen=!0;for(let e=0,r=t.length;e<r;e++)this._color2id[t[e]]=e,this._id2color[e]=t[e]}else this._isFrozen=!1}getId(t){if(t===null)return 0;t=t.toUpperCase();let e=this._color2id[t];if(e)return e;if(this._isFrozen)throw new Error(`Missing color in color map - ${t}`);return e=++this._lastColorId,this._color2id[t]=e,this._id2color[e]=t,e}getColorMap(){return this._id2color.slice(0)}},Ji=Object.freeze([]),Ot=class pn{scopeDepth;parentScopes;fontStyle;foreground;background;constructor(e,r,n,i,o){this.scopeDepth=e,this.parentScopes=r||Ji,this.fontStyle=n,this.foreground=i,this.background=o}clone(){return new pn(this.scopeDepth,this.parentScopes,this.fontStyle,this.foreground,this.background)}static cloneArr(e){let r=[];for(let n=0,i=e.length;n<i;n++)r[n]=e[n].clone();return r}acceptOverwrite(e,r,n,i){this.scopeDepth>e?console.log("how did this happen?"):this.scopeDepth=e,r!==-1&&(this.fontStyle=r),n!==0&&(this.foreground=n),i!==0&&(this.background=i)}},eo=class Dt{constructor(e,r=[],n={}){this._mainRule=e,this._children=n,this._rulesWithParentScopes=r}_rulesWithParentScopes;static _cmpBySpecificity(e,r){if(e.scopeDepth!==r.scopeDepth)return r.scopeDepth-e.scopeDepth;let n=0,i=0;for(;e.parentScopes[n]===">"&&n++,r.parentScopes[i]===">"&&i++,!(n>=e.parentScopes.length||i>=r.parentScopes.length);){const o=r.parentScopes[i].length-e.parentScopes[n].length;if(o!==0)return o;n++,i++}return r.parentScopes.length-e.parentScopes.length}match(e){if(e!==""){let n=e.indexOf("."),i,o;if(n===-1?(i=e,o=""):(i=e.substring(0,n),o=e.substring(n+1)),this._children.hasOwnProperty(i))return this._children[i].match(o)}const r=this._rulesWithParentScopes.concat(this._mainRule);return r.sort(Dt._cmpBySpecificity),r}insert(e,r,n,i,o,a){if(r===""){this._doInsertHere(e,n,i,o,a);return}let l=r.indexOf("."),s,u;l===-1?(s=r,u=""):(s=r.substring(0,l),u=r.substring(l+1));let d;this._children.hasOwnProperty(s)?d=this._children[s]:(d=new Dt(this._mainRule.clone(),Ot.cloneArr(this._rulesWithParentScopes)),this._children[s]=d),d.insert(e+1,u,n,i,o,a)}_doInsertHere(e,r,n,i,o){if(r===null){this._mainRule.acceptOverwrite(e,n,i,o);return}for(let a=0,l=this._rulesWithParentScopes.length;a<l;a++){let s=this._rulesWithParentScopes[a];if(ln(s.parentScopes,r)===0){s.acceptOverwrite(e,n,i,o);return}}n===-1&&(n=this._mainRule.fontStyle),i===0&&(i=this._mainRule.foreground),o===0&&(o=this._mainRule.background),this._rulesWithParentScopes.push(new Ot(e,r,n,i,o))}},ke=class H{static toBinaryStr(e){return e.toString(2).padStart(32,"0")}static print(e){const r=H.getLanguageId(e),n=H.getTokenType(e),i=H.getFontStyle(e),o=H.getForeground(e),a=H.getBackground(e);console.log({languageId:r,tokenType:n,fontStyle:i,foreground:o,background:a})}static getLanguageId(e){return(e&255)>>>0}static getTokenType(e){return(e&768)>>>8}static containsBalancedBrackets(e){return(e&1024)!==0}static getFontStyle(e){return(e&30720)>>>11}static getForeground(e){return(e&16744448)>>>15}static getBackground(e){return(e&4278190080)>>>24}static set(e,r,n,i,o,a,l){let s=H.getLanguageId(e),u=H.getTokenType(e),d=H.containsBalancedBrackets(e)?1:0,p=H.getFontStyle(e),h=H.getForeground(e),g=H.getBackground(e);return r!==0&&(s=r),n!==8&&(u=n),i!==null&&(d=i?1:0),o!==-1&&(p=o),a!==0&&(h=a),l!==0&&(g=l),(s<<0|u<<8|d<<10|p<<11|h<<15|g<<24)>>>0}};function tt(t,e){const r=[],n=to(t);let i=n.next();for(;i!==null;){let s=0;if(i.length===2&&i.charAt(1)===":"){switch(i.charAt(0)){case"R":s=1;break;case"L":s=-1;break;default:console.log(`Unknown priority ${i} in scope selector`)}i=n.next()}let u=a();if(r.push({matcher:u,priority:s}),i!==",")break;i=n.next()}return r;function o(){if(i==="-"){i=n.next();const s=o();return u=>!!s&&!s(u)}if(i==="("){i=n.next();const s=l();return i===")"&&(i=n.next()),s}if(kr(i)){const s=[];do s.push(i),i=n.next();while(kr(i));return u=>e(s,u)}return null}function a(){const s=[];let u=o();for(;u;)s.push(u),u=o();return d=>s.every(p=>p(d))}function l(){const s=[];let u=a();for(;u&&(s.push(u),i==="|"||i===",");){do i=n.next();while(i==="|"||i===",");u=a()}return d=>s.some(p=>p(d))}}function kr(t){return!!t&&!!t.match(/[\w\.:]+/)}function to(t){let e=/([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g,r=e.exec(t);return{next:()=>{if(!r)return null;const n=r[0];return r=e.exec(t),n}}}function hn(t){typeof t.dispose=="function"&&t.dispose()}var $e=class{constructor(t){this.scopeName=t}toKey(){return this.scopeName}},ro=class{constructor(t,e){this.scopeName=t,this.ruleName=e}toKey(){return`${this.scopeName}#${this.ruleName}`}},no=class{_references=[];_seenReferenceKeys=new Set;get references(){return this._references}visitedRule=new Set;add(t){const e=t.toKey();this._seenReferenceKeys.has(e)||(this._seenReferenceKeys.add(e),this._references.push(t))}},io=class{constructor(t,e){this.repo=t,this.initialScopeName=e,this.seenFullScopeRequests.add(this.initialScopeName),this.Q=[new $e(this.initialScopeName)]}seenFullScopeRequests=new Set;seenPartialScopeRequests=new Set;Q;processQueue(){const t=this.Q;this.Q=[];const e=new no;for(const r of t)oo(r,this.initialScopeName,this.repo,e);for(const r of e.references)if(r instanceof $e){if(this.seenFullScopeRequests.has(r.scopeName))continue;this.seenFullScopeRequests.add(r.scopeName),this.Q.push(r)}else{if(this.seenFullScopeRequests.has(r.scopeName)||this.seenPartialScopeRequests.has(r.toKey()))continue;this.seenPartialScopeRequests.add(r.toKey()),this.Q.push(r)}}};function oo(t,e,r,n){const i=r.lookup(t.scopeName);if(!i){if(t.scopeName===e)throw new Error(`No grammar provided for <${e}>`);return}const o=r.lookup(e);t instanceof $e?Xe({baseGrammar:o,selfGrammar:i},n):$t(t.ruleName,{baseGrammar:o,selfGrammar:i,repository:i.repository},n);const a=r.injections(t.scopeName);if(a)for(const l of a)n.add(new $e(l))}function $t(t,e,r){if(e.repository&&e.repository[t]){const n=e.repository[t];rt([n],e,r)}}function Xe(t,e){t.selfGrammar.patterns&&Array.isArray(t.selfGrammar.patterns)&&rt(t.selfGrammar.patterns,{...t,repository:t.selfGrammar.repository},e),t.selfGrammar.injections&&rt(Object.values(t.selfGrammar.injections),{...t,repository:t.selfGrammar.repository},e)}function rt(t,e,r){for(const n of t){if(r.visitedRule.has(n))continue;r.visitedRule.add(n);const i=n.repository?on({},e.repository,n.repository):e.repository;Array.isArray(n.patterns)&&rt(n.patterns,{...e,repository:i},r);const o=n.include;if(!o)continue;const a=gn(o);switch(a.kind){case 0:Xe({...e,selfGrammar:e.baseGrammar},r);break;case 1:Xe(e,r);break;case 2:$t(a.ruleName,{...e,repository:i},r);break;case 3:case 4:const l=a.scopeName===e.selfGrammar.scopeName?e.selfGrammar:a.scopeName===e.baseGrammar.scopeName?e.baseGrammar:void 0;if(l){const s={baseGrammar:e.baseGrammar,selfGrammar:l,repository:i};a.kind===4?$t(a.ruleName,s,r):Xe(s,r)}else a.kind===4?r.add(new ro(a.scopeName,a.ruleName)):r.add(new $e(a.scopeName));break}}}var ao=class{kind=0},so=class{kind=1},lo=class{constructor(t){this.ruleName=t}kind=2},co=class{constructor(t){this.scopeName=t}kind=3},uo=class{constructor(t,e){this.scopeName=t,this.ruleName=e}kind=4};function gn(t){if(t==="$base")return new ao;if(t==="$self")return new so;const e=t.indexOf("#");if(e===-1)return new co(t);if(e===0)return new lo(t.substring(1));{const r=t.substring(0,e),n=t.substring(e+1);return new uo(r,n)}}var po=/\\(\d+)/,wr=/\\(\d+)/g,ho=-1,mn=-2;var Be=class{$location;id;_nameIsCapturing;_name;_contentNameIsCapturing;_contentName;constructor(t,e,r,n){this.$location=t,this.id=e,this._name=r||null,this._nameIsCapturing=Fe.hasCaptures(this._name),this._contentName=n||null,this._contentNameIsCapturing=Fe.hasCaptures(this._contentName)}get debugName(){const t=this.$location?`${an(this.$location.filename)}:${this.$location.line}`:"unknown";return`${this.constructor.name}#${this.id} @ ${t}`}getName(t,e){return!this._nameIsCapturing||this._name===null||t===null||e===null?this._name:Fe.replaceCaptures(this._name,t,e)}getContentName(t,e){return!this._contentNameIsCapturing||this._contentName===null?this._contentName:Fe.replaceCaptures(this._contentName,t,e)}},go=class extends Be{retokenizeCapturedWithRuleId;constructor(t,e,r,n,i){super(t,e,r,n),this.retokenizeCapturedWithRuleId=i}dispose(){}collectPatterns(t,e){throw new Error("Not supported!")}compile(t,e){throw new Error("Not supported!")}compileAG(t,e,r,n){throw new Error("Not supported!")}},mo=class extends Be{_match;captures;_cachedCompiledPatterns;constructor(t,e,r,n,i){super(t,e,r,null),this._match=new Ne(n,this.id),this.captures=i,this._cachedCompiledPatterns=null}dispose(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null)}get debugMatchRegExp(){return`${this._match.source}`}collectPatterns(t,e){e.push(this._match)}compile(t,e){return this._getCachedCompiledPatterns(t).compile(t)}compileAG(t,e,r,n){return this._getCachedCompiledPatterns(t).compileAG(t,r,n)}_getCachedCompiledPatterns(t){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new Ve,this.collectPatterns(t,this._cachedCompiledPatterns)),this._cachedCompiledPatterns}},Er=class extends Be{hasMissingPatterns;patterns;_cachedCompiledPatterns;constructor(t,e,r,n,i){super(t,e,r,n),this.patterns=i.patterns,this.hasMissingPatterns=i.hasMissingPatterns,this._cachedCompiledPatterns=null}dispose(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null)}collectPatterns(t,e){for(const r of this.patterns)t.getRule(r).collectPatterns(t,e)}compile(t,e){return this._getCachedCompiledPatterns(t).compile(t)}compileAG(t,e,r,n){return this._getCachedCompiledPatterns(t).compileAG(t,r,n)}_getCachedCompiledPatterns(t){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new Ve,this.collectPatterns(t,this._cachedCompiledPatterns)),this._cachedCompiledPatterns}},Nt=class extends Be{_begin;beginCaptures;_end;endHasBackReferences;endCaptures;applyEndPatternLast;hasMissingPatterns;patterns;_cachedCompiledPatterns;constructor(t,e,r,n,i,o,a,l,s,u){super(t,e,r,n),this._begin=new Ne(i,this.id),this.beginCaptures=o,this._end=new Ne(a||"￿",-1),this.endHasBackReferences=this._end.hasBackReferences,this.endCaptures=l,this.applyEndPatternLast=s||!1,this.patterns=u.patterns,this.hasMissingPatterns=u.hasMissingPatterns,this._cachedCompiledPatterns=null}dispose(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null)}get debugBeginRegExp(){return`${this._begin.source}`}get debugEndRegExp(){return`${this._end.source}`}getEndWithResolvedBackReferences(t,e){return this._end.resolveBackReferences(t,e)}collectPatterns(t,e){e.push(this._begin)}compile(t,e){return this._getCachedCompiledPatterns(t,e).compile(t)}compileAG(t,e,r,n){return this._getCachedCompiledPatterns(t,e).compileAG(t,r,n)}_getCachedCompiledPatterns(t,e){if(!this._cachedCompiledPatterns){this._cachedCompiledPatterns=new Ve;for(const r of this.patterns)t.getRule(r).collectPatterns(t,this._cachedCompiledPatterns);this.applyEndPatternLast?this._cachedCompiledPatterns.push(this._end.hasBackReferences?this._end.clone():this._end):this._cachedCompiledPatterns.unshift(this._end.hasBackReferences?this._end.clone():this._end)}return this._end.hasBackReferences&&(this.applyEndPatternLast?this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length()-1,e):this._cachedCompiledPatterns.setSource(0,e)),this._cachedCompiledPatterns}},nt=class extends Be{_begin;beginCaptures;whileCaptures;_while;whileHasBackReferences;hasMissingPatterns;patterns;_cachedCompiledPatterns;_cachedCompiledWhilePatterns;constructor(t,e,r,n,i,o,a,l,s){super(t,e,r,n),this._begin=new Ne(i,this.id),this.beginCaptures=o,this.whileCaptures=l,this._while=new Ne(a,mn),this.whileHasBackReferences=this._while.hasBackReferences,this.patterns=s.patterns,this.hasMissingPatterns=s.hasMissingPatterns,this._cachedCompiledPatterns=null,this._cachedCompiledWhilePatterns=null}dispose(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null),this._cachedCompiledWhilePatterns&&(this._cachedCompiledWhilePatterns.dispose(),this._cachedCompiledWhilePatterns=null)}get debugBeginRegExp(){return`${this._begin.source}`}get debugWhileRegExp(){return`${this._while.source}`}getWhileWithResolvedBackReferences(t,e){return this._while.resolveBackReferences(t,e)}collectPatterns(t,e){e.push(this._begin)}compile(t,e){return this._getCachedCompiledPatterns(t).compile(t)}compileAG(t,e,r,n){return this._getCachedCompiledPatterns(t).compileAG(t,r,n)}_getCachedCompiledPatterns(t){if(!this._cachedCompiledPatterns){this._cachedCompiledPatterns=new Ve;for(const e of this.patterns)t.getRule(e).collectPatterns(t,this._cachedCompiledPatterns)}return this._cachedCompiledPatterns}compileWhile(t,e){return this._getCachedCompiledWhilePatterns(t,e).compile(t)}compileWhileAG(t,e,r,n){return this._getCachedCompiledWhilePatterns(t,e).compileAG(t,r,n)}_getCachedCompiledWhilePatterns(t,e){return this._cachedCompiledWhilePatterns||(this._cachedCompiledWhilePatterns=new Ve,this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences?this._while.clone():this._while)),this._while.hasBackReferences&&this._cachedCompiledWhilePatterns.setSource(0,e||"￿"),this._cachedCompiledWhilePatterns}},fn=class V{static createCaptureRule(e,r,n,i,o){return e.registerRule(a=>new go(r,a,n,i,o))}static getCompiledRuleId(e,r,n){return e.id||r.registerRule(i=>{if(e.id=i,e.match)return new mo(e.$vscodeTextmateLocation,e.id,e.name,e.match,V._compileCaptures(e.captures,r,n));if(typeof e.begin>"u"){e.repository&&(n=on({},n,e.repository));let o=e.patterns;return typeof o>"u"&&e.include&&(o=[{include:e.include}]),new Er(e.$vscodeTextmateLocation,e.id,e.name,e.contentName,V._compilePatterns(o,r,n))}return e.while?new nt(e.$vscodeTextmateLocation,e.id,e.name,e.contentName,e.begin,V._compileCaptures(e.beginCaptures||e.captures,r,n),e.while,V._compileCaptures(e.whileCaptures||e.captures,r,n),V._compilePatterns(e.patterns,r,n)):new Nt(e.$vscodeTextmateLocation,e.id,e.name,e.contentName,e.begin,V._compileCaptures(e.beginCaptures||e.captures,r,n),e.end,V._compileCaptures(e.endCaptures||e.captures,r,n),e.applyEndPatternLast,V._compilePatterns(e.patterns,r,n))}),e.id}static _compileCaptures(e,r,n){let i=[];if(e){let o=0;for(const a in e){if(a==="$vscodeTextmateLocation")continue;const l=parseInt(a,10);l>o&&(o=l)}for(let a=0;a<=o;a++)i[a]=null;for(const a in e){if(a==="$vscodeTextmateLocation")continue;const l=parseInt(a,10);let s=0;e[a].patterns&&(s=V.getCompiledRuleId(e[a],r,n)),i[l]=V.createCaptureRule(r,e[a].$vscodeTextmateLocation,e[a].name,e[a].contentName,s)}}return i}static _compilePatterns(e,r,n){let i=[];if(e)for(let o=0,a=e.length;o<a;o++){const l=e[o];let s=-1;if(l.include){const u=gn(l.include);switch(u.kind){case 0:case 1:s=V.getCompiledRuleId(n[l.include],r,n);break;case 2:let d=n[u.ruleName];d&&(s=V.getCompiledRuleId(d,r,n));break;case 3:case 4:const p=u.scopeName,h=u.kind===4?u.ruleName:null,g=r.getExternalGrammar(p,n);if(g)if(h){let m=g.repository[h];m&&(s=V.getCompiledRuleId(m,r,g.repository))}else s=V.getCompiledRuleId(g.repository.$self,r,g.repository);break}}else s=V.getCompiledRuleId(l,r,n);if(s!==-1){const u=r.getRule(s);let d=!1;if((u instanceof Er||u instanceof Nt||u instanceof nt)&&u.hasMissingPatterns&&u.patterns.length===0&&(d=!0),d)continue;i.push(s)}}return{patterns:i,hasMissingPatterns:(e?e.length:0)!==i.length}}},Ne=class _n{source;ruleId;hasAnchor;hasBackReferences;_anchorCache;constructor(e,r){if(e&&typeof e=="string"){const n=e.length;let i=0,o=[],a=!1;for(let l=0;l<n;l++)if(e.charAt(l)==="\\"&&l+1<n){const u=e.charAt(l+1);u==="z"?(o.push(e.substring(i,l)),o.push("$(?!\\n)(?<!\\n)"),i=l+2):(u==="A"||u==="G")&&(a=!0),l++}this.hasAnchor=a,i===0?this.source=e:(o.push(e.substring(i,n)),this.source=o.join(""))}else this.hasAnchor=!1,this.source=e;this.hasAnchor?this._anchorCache=this._buildAnchorCache():this._anchorCache=null,this.ruleId=r,typeof this.source=="string"?this.hasBackReferences=po.test(this.source):this.hasBackReferences=!1}clone(){return new _n(this.source,this.ruleId)}setSource(e){this.source!==e&&(this.source=e,this.hasAnchor&&(this._anchorCache=this._buildAnchorCache()))}resolveBackReferences(e,r){if(typeof this.source!="string")throw new Error("This method should only be called if the source is a string");let n=r.map(i=>e.substring(i.start,i.end));return wr.lastIndex=0,this.source.replace(wr,(i,o)=>cn(n[parseInt(o,10)]||""))}_buildAnchorCache(){if(typeof this.source!="string")throw new Error("This method should only be called if the source is a string");let e=[],r=[],n=[],i=[],o,a,l,s;for(o=0,a=this.source.length;o<a;o++)l=this.source.charAt(o),e[o]=l,r[o]=l,n[o]=l,i[o]=l,l==="\\"&&o+1<a&&(s=this.source.charAt(o+1),s==="A"?(e[o+1]="￿",r[o+1]="￿",n[o+1]="A",i[o+1]="A"):s==="G"?(e[o+1]="￿",r[o+1]="G",n[o+1]="￿",i[o+1]="G"):(e[o+1]=s,r[o+1]=s,n[o+1]=s,i[o+1]=s),o++);return{A0_G0:e.join(""),A0_G1:r.join(""),A1_G0:n.join(""),A1_G1:i.join("")}}resolveAnchors(e,r){return!this.hasAnchor||!this._anchorCache||typeof this.source!="string"?this.source:e?r?this._anchorCache.A1_G1:this._anchorCache.A1_G0:r?this._anchorCache.A0_G1:this._anchorCache.A0_G0}},Ve=class{_items;_hasAnchors;_cached;_anchorCache;constructor(){this._items=[],this._hasAnchors=!1,this._cached=null,this._anchorCache={A0_G0:null,A0_G1:null,A1_G0:null,A1_G1:null}}dispose(){this._disposeCaches()}_disposeCaches(){this._cached&&(this._cached.dispose(),this._cached=null),this._anchorCache.A0_G0&&(this._anchorCache.A0_G0.dispose(),this._anchorCache.A0_G0=null),this._anchorCache.A0_G1&&(this._anchorCache.A0_G1.dispose(),this._anchorCache.A0_G1=null),this._anchorCache.A1_G0&&(this._anchorCache.A1_G0.dispose(),this._anchorCache.A1_G0=null),this._anchorCache.A1_G1&&(this._anchorCache.A1_G1.dispose(),this._anchorCache.A1_G1=null)}push(t){this._items.push(t),this._hasAnchors=this._hasAnchors||t.hasAnchor}unshift(t){this._items.unshift(t),this._hasAnchors=this._hasAnchors||t.hasAnchor}length(){return this._items.length}setSource(t,e){this._items[t].source!==e&&(this._disposeCaches(),this._items[t].setSource(e))}compile(t){if(!this._cached){let e=this._items.map(r=>r.source);this._cached=new Rr(t,e,this._items.map(r=>r.ruleId))}return this._cached}compileAG(t,e,r){return this._hasAnchors?e?r?(this._anchorCache.A1_G1||(this._anchorCache.A1_G1=this._resolveAnchors(t,e,r)),this._anchorCache.A1_G1):(this._anchorCache.A1_G0||(this._anchorCache.A1_G0=this._resolveAnchors(t,e,r)),this._anchorCache.A1_G0):r?(this._anchorCache.A0_G1||(this._anchorCache.A0_G1=this._resolveAnchors(t,e,r)),this._anchorCache.A0_G1):(this._anchorCache.A0_G0||(this._anchorCache.A0_G0=this._resolveAnchors(t,e,r)),this._anchorCache.A0_G0):this.compile(t)}_resolveAnchors(t,e,r){let n=this._items.map(i=>i.resolveAnchors(e,r));return new Rr(t,n,this._items.map(i=>i.ruleId))}},Rr=class{constructor(t,e,r){this.regExps=e,this.rules=r,this.scanner=t.createOnigScanner(e)}scanner;dispose(){typeof this.scanner.dispose=="function"&&this.scanner.dispose()}toString(){const t=[];for(let e=0,r=this.rules.length;e<r;e++)t.push("   - "+this.rules[e]+": "+this.regExps[e]);return t.join(`
`)}findNextMatchSync(t,e,r){const n=this.scanner.findNextMatchSync(t,e,r);return n?{ruleId:this.rules[n.index],captureIndices:n.captureIndices}:null}},kt=class{constructor(t,e){this.languageId=t,this.tokenType=e}},fo=class Vt{_defaultAttributes;_embeddedLanguagesMatcher;constructor(e,r){this._defaultAttributes=new kt(e,8),this._embeddedLanguagesMatcher=new _o(Object.entries(r||{}))}getDefaultAttributes(){return this._defaultAttributes}getBasicScopeAttributes(e){return e===null?Vt._NULL_SCOPE_METADATA:this._getBasicScopeAttributes.get(e)}static _NULL_SCOPE_METADATA=new kt(0,0);_getBasicScopeAttributes=new un(e=>{const r=this._scopeToLanguage(e),n=this._toStandardTokenType(e);return new kt(r,n)});_scopeToLanguage(e){return this._embeddedLanguagesMatcher.match(e)||0}_toStandardTokenType(e){const r=e.match(Vt.STANDARD_TOKEN_TYPE_REGEXP);if(!r)return 8;switch(r[1]){case"comment":return 1;case"string":return 2;case"regex":return 3;case"meta.embedded":return 0}throw new Error("Unexpected match for standard token type!")}static STANDARD_TOKEN_TYPE_REGEXP=/\b(comment|string|regex|meta\.embedded)\b/},_o=class{values;scopesRegExp;constructor(t){if(t.length===0)this.values=null,this.scopesRegExp=null;else{this.values=new Map(t);const e=t.map(([r,n])=>cn(r));e.sort(),e.reverse(),this.scopesRegExp=new RegExp(`^((${e.join(")|(")}))($|\\.)`,"")}}match(t){if(!this.scopesRegExp)return;const e=t.match(this.scopesRegExp);if(e)return this.values.get(e[1])}},Pr=class{constructor(t,e){this.stack=t,this.stoppedEarly=e}};function vn(t,e,r,n,i,o,a,l){const s=e.content.length;let u=!1,d=-1;if(a){const g=vo(t,e,r,n,i,o);i=g.stack,n=g.linePos,r=g.isFirstLine,d=g.anchorPosition}const p=Date.now();for(;!u;){if(l!==0&&Date.now()-p>l)return new Pr(i,!0);h()}return new Pr(i,!1);function h(){const g=bo(t,e,r,n,i,d);if(!g){o.produce(i,s),u=!0;return}const m=g.captureIndices,y=g.matchedRuleId,k=m&&m.length>0?m[0].end>n:!1;if(y===ho){const v=i.getRule(t);o.produce(i,m[0].start),i=i.withContentNameScopesList(i.nameScopesList),Ie(t,e,r,i,o,v.endCaptures,m),o.produce(i,m[0].end);const x=i;if(i=i.parent,d=x.getAnchorPos(),!k&&x.getEnterPos()===n){i=x,o.produce(i,s),u=!0;return}}else{const v=t.getRule(y);o.produce(i,m[0].start);const x=i,_=v.getName(e.content,m),E=i.contentNameScopesList.pushAttributed(_,t);if(i=i.push(y,n,d,m[0].end===s,null,E,E),v instanceof Nt){const T=v;Ie(t,e,r,i,o,T.beginCaptures,m),o.produce(i,m[0].end),d=m[0].end;const N=T.getContentName(e.content,m),U=E.pushAttributed(N,t);if(i=i.withContentNameScopesList(U),T.endHasBackReferences&&(i=i.withEndRule(T.getEndWithResolvedBackReferences(e.content,m))),!k&&x.hasSameRuleAs(i)){i=i.pop(),o.produce(i,s),u=!0;return}}else if(v instanceof nt){const T=v;Ie(t,e,r,i,o,T.beginCaptures,m),o.produce(i,m[0].end),d=m[0].end;const N=T.getContentName(e.content,m),U=E.pushAttributed(N,t);if(i=i.withContentNameScopesList(U),T.whileHasBackReferences&&(i=i.withEndRule(T.getWhileWithResolvedBackReferences(e.content,m))),!k&&x.hasSameRuleAs(i)){i=i.pop(),o.produce(i,s),u=!0;return}}else if(Ie(t,e,r,i,o,v.captures,m),o.produce(i,m[0].end),i=i.pop(),!k){i=i.safePop(),o.produce(i,s),u=!0;return}}m[0].end>n&&(n=m[0].end,r=!1)}}function vo(t,e,r,n,i,o){let a=i.beginRuleCapturedEOL?0:-1;const l=[];for(let s=i;s;s=s.pop()){const u=s.getRule(t);u instanceof nt&&l.push({rule:u,stack:s})}for(let s=l.pop();s;s=l.pop()){const{ruleScanner:u,findOptions:d}=ko(s.rule,t,s.stack.endRule,r,n===a),p=u.findNextMatchSync(e,n,d);if(p){if(p.ruleId!==mn){i=s.stack.pop();break}p.captureIndices&&p.captureIndices.length&&(o.produce(s.stack,p.captureIndices[0].start),Ie(t,e,r,s.stack,o,s.rule.whileCaptures,p.captureIndices),o.produce(s.stack,p.captureIndices[0].end),a=p.captureIndices[0].end,p.captureIndices[0].end>n&&(n=p.captureIndices[0].end,r=!1))}else{i=s.stack.pop();break}}return{stack:i,linePos:n,anchorPosition:a,isFirstLine:r}}function bo(t,e,r,n,i,o){const a=yo(t,e,r,n,i,o),l=t.getInjections();if(l.length===0)return a;const s=xo(l,t,e,r,n,i,o);if(!s)return a;if(!a)return s;const u=a.captureIndices[0].start,d=s.captureIndices[0].start;return d<u||s.priorityMatch&&d===u?s:a}function yo(t,e,r,n,i,o){const a=i.getRule(t),{ruleScanner:l,findOptions:s}=bn(a,t,i.endRule,r,n===o),u=l.findNextMatchSync(e,n,s);return u?{captureIndices:u.captureIndices,matchedRuleId:u.ruleId}:null}function xo(t,e,r,n,i,o,a){let l=Number.MAX_VALUE,s=null,u,d=0;const p=o.contentNameScopesList.getScopeNames();for(let h=0,g=t.length;h<g;h++){const m=t[h];if(!m.matcher(p))continue;const y=e.getRule(m.ruleId),{ruleScanner:k,findOptions:v}=bn(y,e,null,n,i===a),x=k.findNextMatchSync(r,i,v);if(!x)continue;const _=x.captureIndices[0].start;if(!(_>=l)&&(l=_,s=x.captureIndices,u=x.ruleId,d=m.priority,l===i))break}return s?{priorityMatch:d===-1,captureIndices:s,matchedRuleId:u}:null}function bn(t,e,r,n,i){return{ruleScanner:t.compileAG(e,r,n,i),findOptions:0}}function ko(t,e,r,n,i){return{ruleScanner:t.compileWhileAG(e,r,n,i),findOptions:0}}function Ie(t,e,r,n,i,o,a){if(o.length===0)return;const l=e.content,s=Math.min(o.length,a.length),u=[],d=a[0].end;for(let p=0;p<s;p++){const h=o[p];if(h===null)continue;const g=a[p];if(g.length===0)continue;if(g.start>d)break;for(;u.length>0&&u[u.length-1].endPos<=g.start;)i.produceFromScopes(u[u.length-1].scopes,u[u.length-1].endPos),u.pop();if(u.length>0?i.produceFromScopes(u[u.length-1].scopes,g.start):i.produce(n,g.start),h.retokenizeCapturedWithRuleId){const y=h.getName(l,a),k=n.contentNameScopesList.pushAttributed(y,t),v=h.getContentName(l,a),x=k.pushAttributed(v,t),_=n.push(h.retokenizeCapturedWithRuleId,g.start,-1,!1,null,k,x),E=t.createOnigString(l.substring(0,g.end));vn(t,E,r&&g.start===0,g.start,_,i,!1,0),hn(E);continue}const m=h.getName(l,a);if(m!==null){const k=(u.length>0?u[u.length-1].scopes:n.contentNameScopesList).pushAttributed(m,t);u.push(new wo(k,g.end))}}for(;u.length>0;)i.produceFromScopes(u[u.length-1].scopes,u[u.length-1].endPos),u.pop()}var wo=class{scopes;endPos;constructor(t,e){this.scopes=t,this.endPos=e}};function Eo(t,e,r,n,i,o,a,l){return new Po(t,e,r,n,i,o,a,l)}function Sr(t,e,r,n,i){const o=tt(e,it),a=fn.getCompiledRuleId(r,n,i.repository);for(const l of o)t.push({debugSelector:e,matcher:l.matcher,ruleId:a,grammar:i,priority:l.priority})}function it(t,e){if(e.length<t.length)return!1;let r=0;return t.every(n=>{for(let i=r;i<e.length;i++)if(Ro(e[i],n))return r=i+1,!0;return!1})}function Ro(t,e){if(!t)return!1;if(t===e)return!0;const r=e.length;return t.length>r&&t.substr(0,r)===e&&t[r]==="."}var Po=class{constructor(t,e,r,n,i,o,a,l){if(this._rootScopeName=t,this.balancedBracketSelectors=o,this._onigLib=l,this._basicScopeAttributesProvider=new fo(r,n),this._rootId=-1,this._lastRuleId=0,this._ruleId2desc=[null],this._includedGrammars={},this._grammarRepository=a,this._grammar=Tr(e,null),this._injections=null,this._tokenTypeMatchers=[],i)for(const s of Object.keys(i)){const u=tt(s,it);for(const d of u)this._tokenTypeMatchers.push({matcher:d.matcher,type:i[s]})}}_rootId;_lastRuleId;_ruleId2desc;_includedGrammars;_grammarRepository;_grammar;_injections;_basicScopeAttributesProvider;_tokenTypeMatchers;get themeProvider(){return this._grammarRepository}dispose(){for(const t of this._ruleId2desc)t&&t.dispose()}createOnigScanner(t){return this._onigLib.createOnigScanner(t)}createOnigString(t){return this._onigLib.createOnigString(t)}getMetadataForScope(t){return this._basicScopeAttributesProvider.getBasicScopeAttributes(t)}_collectInjections(){const t={lookup:i=>i===this._rootScopeName?this._grammar:this.getExternalGrammar(i),injections:i=>this._grammarRepository.injections(i)},e=[],r=this._rootScopeName,n=t.lookup(r);if(n){const i=n.injections;if(i)for(let a in i)Sr(e,a,i[a],this,n);const o=this._grammarRepository.injections(r);o&&o.forEach(a=>{const l=this.getExternalGrammar(a);if(l){const s=l.injectionSelector;s&&Sr(e,s,l,this,l)}})}return e.sort((i,o)=>i.priority-o.priority),e}getInjections(){return this._injections===null&&(this._injections=this._collectInjections()),this._injections}registerRule(t){const e=++this._lastRuleId,r=t(e);return this._ruleId2desc[e]=r,r}getRule(t){return this._ruleId2desc[t]}getExternalGrammar(t,e){if(this._includedGrammars[t])return this._includedGrammars[t];if(this._grammarRepository){const r=this._grammarRepository.lookup(t);if(r)return this._includedGrammars[t]=Tr(r,e&&e.$base),this._includedGrammars[t]}}tokenizeLine(t,e,r=0){const n=this._tokenize(t,e,!1,r);return{tokens:n.lineTokens.getResult(n.ruleStack,n.lineLength),ruleStack:n.ruleStack,stoppedEarly:n.stoppedEarly}}tokenizeLine2(t,e,r=0){const n=this._tokenize(t,e,!0,r);return{tokens:n.lineTokens.getBinaryResult(n.ruleStack,n.lineLength),ruleStack:n.ruleStack,stoppedEarly:n.stoppedEarly}}_tokenize(t,e,r,n){this._rootId===-1&&(this._rootId=fn.getCompiledRuleId(this._grammar.repository.$self,this,this._grammar.repository),this.getInjections());let i;if(!e||e===zt.NULL){i=!0;const u=this._basicScopeAttributesProvider.getDefaultAttributes(),d=this.themeProvider.getDefaults(),p=ke.set(0,u.languageId,u.tokenType,null,d.fontStyle,d.foregroundId,d.backgroundId),h=this.getRule(this._rootId).getName(null,null);let g;h?g=Oe.createRootAndLookUpScopeName(h,p,this):g=Oe.createRoot("unknown",p),e=new zt(null,this._rootId,-1,-1,!1,null,g,g)}else i=!1,e.reset();t=t+`
`;const o=this.createOnigString(t),a=o.content.length,l=new To(r,t,this._tokenTypeMatchers,this.balancedBracketSelectors),s=vn(this,o,i,0,e,l,!0,n);return hn(o),{lineLength:a,lineTokens:l,ruleStack:s.stack,stoppedEarly:s.stoppedEarly}}};function Tr(t,e){return t=Fi(t),t.repository=t.repository||{},t.repository.$self={$vscodeTextmateLocation:t.$vscodeTextmateLocation,patterns:t.patterns,name:t.scopeName},t.repository.$base=e||t.repository.$self,t}var Oe=class Z{constructor(e,r,n){this.parent=e,this.scopePath=r,this.tokenAttributes=n}static fromExtension(e,r){let n=e,i=e?.scopePath??null;for(const o of r)i=xt.push(i,o.scopeNames),n=new Z(n,i,o.encodedTokenAttributes);return n}static createRoot(e,r){return new Z(null,new xt(null,e),r)}static createRootAndLookUpScopeName(e,r,n){const i=n.getMetadataForScope(e),o=new xt(null,e),a=n.themeProvider.themeMatch(o),l=Z.mergeAttributes(r,i,a);return new Z(null,o,l)}get scopeName(){return this.scopePath.scopeName}toString(){return this.getScopeNames().join(" ")}equals(e){return Z.equals(this,e)}static equals(e,r){do{if(e===r||!e&&!r)return!0;if(!e||!r||e.scopeName!==r.scopeName||e.tokenAttributes!==r.tokenAttributes)return!1;e=e.parent,r=r.parent}while(!0)}static mergeAttributes(e,r,n){let i=-1,o=0,a=0;return n!==null&&(i=n.fontStyle,o=n.foregroundId,a=n.backgroundId),ke.set(e,r.languageId,r.tokenType,null,i,o,a)}pushAttributed(e,r){if(e===null)return this;if(e.indexOf(" ")===-1)return Z._pushAttributed(this,e,r);const n=e.split(/ /g);let i=this;for(const o of n)i=Z._pushAttributed(i,o,r);return i}static _pushAttributed(e,r,n){const i=n.getMetadataForScope(r),o=e.scopePath.push(r),a=n.themeProvider.themeMatch(o),l=Z.mergeAttributes(e.tokenAttributes,i,a);return new Z(e,o,l)}getScopeNames(){return this.scopePath.getSegments()}getExtensionIfDefined(e){const r=[];let n=this;for(;n&&n!==e;)r.push({encodedTokenAttributes:n.tokenAttributes,scopeNames:n.scopePath.getExtensionIfDefined(n.parent?.scopePath??null)}),n=n.parent;return n===e?r.reverse():void 0}},zt=class ae{constructor(e,r,n,i,o,a,l,s){this.parent=e,this.ruleId=r,this.beginRuleCapturedEOL=o,this.endRule=a,this.nameScopesList=l,this.contentNameScopesList=s,this.depth=this.parent?this.parent.depth+1:1,this._enterPos=n,this._anchorPos=i}_stackElementBrand=void 0;static NULL=new ae(null,0,0,0,!1,null,null,null);_enterPos;_anchorPos;depth;equals(e){return e===null?!1:ae._equals(this,e)}static _equals(e,r){return e===r?!0:this._structuralEquals(e,r)?Oe.equals(e.contentNameScopesList,r.contentNameScopesList):!1}static _structuralEquals(e,r){do{if(e===r||!e&&!r)return!0;if(!e||!r||e.depth!==r.depth||e.ruleId!==r.ruleId||e.endRule!==r.endRule)return!1;e=e.parent,r=r.parent}while(!0)}clone(){return this}static _reset(e){for(;e;)e._enterPos=-1,e._anchorPos=-1,e=e.parent}reset(){ae._reset(this)}pop(){return this.parent}safePop(){return this.parent?this.parent:this}push(e,r,n,i,o,a,l){return new ae(this,e,r,n,i,o,a,l)}getEnterPos(){return this._enterPos}getAnchorPos(){return this._anchorPos}getRule(e){return e.getRule(this.ruleId)}toString(){const e=[];return this._writeString(e,0),"["+e.join(",")+"]"}_writeString(e,r){return this.parent&&(r=this.parent._writeString(e,r)),e[r++]=`(${this.ruleId}, ${this.nameScopesList?.toString()}, ${this.contentNameScopesList?.toString()})`,r}withContentNameScopesList(e){return this.contentNameScopesList===e?this:this.parent.push(this.ruleId,this._enterPos,this._anchorPos,this.beginRuleCapturedEOL,this.endRule,this.nameScopesList,e)}withEndRule(e){return this.endRule===e?this:new ae(this.parent,this.ruleId,this._enterPos,this._anchorPos,this.beginRuleCapturedEOL,e,this.nameScopesList,this.contentNameScopesList)}hasSameRuleAs(e){let r=this;for(;r&&r._enterPos===e._enterPos;){if(r.ruleId===e.ruleId)return!0;r=r.parent}return!1}toStateStackFrame(){return{ruleId:this.ruleId,beginRuleCapturedEOL:this.beginRuleCapturedEOL,endRule:this.endRule,nameScopesList:this.nameScopesList?.getExtensionIfDefined(this.parent?.nameScopesList??null)??[],contentNameScopesList:this.contentNameScopesList?.getExtensionIfDefined(this.nameScopesList)??[]}}static pushFrame(e,r){const n=Oe.fromExtension(e?.nameScopesList??null,r.nameScopesList);return new ae(e,r.ruleId,r.enterPos??-1,r.anchorPos??-1,r.beginRuleCapturedEOL,r.endRule,n,Oe.fromExtension(n,r.contentNameScopesList))}},So=class{balancedBracketScopes;unbalancedBracketScopes;allowAny=!1;constructor(t,e){this.balancedBracketScopes=t.flatMap(r=>r==="*"?(this.allowAny=!0,[]):tt(r,it).map(n=>n.matcher)),this.unbalancedBracketScopes=e.flatMap(r=>tt(r,it).map(n=>n.matcher))}get matchesAlways(){return this.allowAny&&this.unbalancedBracketScopes.length===0}get matchesNever(){return this.balancedBracketScopes.length===0&&!this.allowAny}match(t){for(const e of this.unbalancedBracketScopes)if(e(t))return!1;for(const e of this.balancedBracketScopes)if(e(t))return!0;return this.allowAny}},To=class{constructor(t,e,r,n){this.balancedBracketSelectors=n,this._emitBinaryTokens=t,this._tokenTypeOverrides=r,this._lineText=null,this._tokens=[],this._binaryTokens=[],this._lastTokenEndIndex=0}_emitBinaryTokens;_lineText;_tokens;_binaryTokens;_lastTokenEndIndex;_tokenTypeOverrides;produce(t,e){this.produceFromScopes(t.contentNameScopesList,e)}produceFromScopes(t,e){if(this._lastTokenEndIndex>=e)return;if(this._emitBinaryTokens){let n=t?.tokenAttributes??0,i=!1;if(this.balancedBracketSelectors?.matchesAlways&&(i=!0),this._tokenTypeOverrides.length>0||this.balancedBracketSelectors&&!this.balancedBracketSelectors.matchesAlways&&!this.balancedBracketSelectors.matchesNever){const o=t?.getScopeNames()??[];for(const a of this._tokenTypeOverrides)a.matcher(o)&&(n=ke.set(n,0,a.type,null,-1,0,0));this.balancedBracketSelectors&&(i=this.balancedBracketSelectors.match(o))}if(i&&(n=ke.set(n,0,8,i,-1,0,0)),this._binaryTokens.length>0&&this._binaryTokens[this._binaryTokens.length-1]===n){this._lastTokenEndIndex=e;return}this._binaryTokens.push(this._lastTokenEndIndex),this._binaryTokens.push(n),this._lastTokenEndIndex=e;return}const r=t?.getScopeNames()??[];this._tokens.push({startIndex:this._lastTokenEndIndex,endIndex:e,scopes:r}),this._lastTokenEndIndex=e}getResult(t,e){return this._tokens.length>0&&this._tokens[this._tokens.length-1].startIndex===e-1&&this._tokens.pop(),this._tokens.length===0&&(this._lastTokenEndIndex=-1,this.produce(t,e),this._tokens[this._tokens.length-1].startIndex=0),this._tokens}getBinaryResult(t,e){this._binaryTokens.length>0&&this._binaryTokens[this._binaryTokens.length-2]===e-1&&(this._binaryTokens.pop(),this._binaryTokens.pop()),this._binaryTokens.length===0&&(this._lastTokenEndIndex=-1,this.produce(t,e),this._binaryTokens[this._binaryTokens.length-2]=0);const r=new Uint32Array(this._binaryTokens.length);for(let n=0,i=this._binaryTokens.length;n<i;n++)r[n]=this._binaryTokens[n];return r}},Ao=class{constructor(t,e){this._onigLib=e,this._theme=t}_grammars=new Map;_rawGrammars=new Map;_injectionGrammars=new Map;_theme;dispose(){for(const t of this._grammars.values())t.dispose()}setTheme(t){this._theme=t}getColorMap(){return this._theme.getColorMap()}addGrammar(t,e){this._rawGrammars.set(t.scopeName,t),e&&this._injectionGrammars.set(t.scopeName,e)}lookup(t){return this._rawGrammars.get(t)}injections(t){return this._injectionGrammars.get(t)}getDefaults(){return this._theme.getDefaults()}themeMatch(t){return this._theme.match(t)}grammarForScopeName(t,e,r,n,i){if(!this._grammars.has(t)){let o=this._rawGrammars.get(t);if(!o)return null;this._grammars.set(t,Eo(t,o,e,r,n,i,this,this._onigLib))}return this._grammars.get(t)}},Lo=class{_options;_syncRegistry;_ensureGrammarCache;constructor(e){this._options=e,this._syncRegistry=new Ao(et.createFromRawTheme(e.theme,e.colorMap),e.onigLib),this._ensureGrammarCache=new Map}dispose(){this._syncRegistry.dispose()}setTheme(e,r){this._syncRegistry.setTheme(et.createFromRawTheme(e,r))}getColorMap(){return this._syncRegistry.getColorMap()}loadGrammarWithEmbeddedLanguages(e,r,n){return this.loadGrammarWithConfiguration(e,r,{embeddedLanguages:n})}loadGrammarWithConfiguration(e,r,n){return this._loadGrammar(e,r,n.embeddedLanguages,n.tokenTypes,new So(n.balancedBracketSelectors||[],n.unbalancedBracketSelectors||[]))}loadGrammar(e){return this._loadGrammar(e,0,null,null,null)}_loadGrammar(e,r,n,i,o){const a=new io(this._syncRegistry,e);for(;a.Q.length>0;)a.Q.map(l=>this._loadSingleGrammar(l.scopeName)),a.processQueue();return this._grammarForScopeName(e,r,n,i,o)}_loadSingleGrammar(e){this._ensureGrammarCache.has(e)||(this._doLoadSingleGrammar(e),this._ensureGrammarCache.set(e,!0))}_doLoadSingleGrammar(e){const r=this._options.loadGrammar(e);if(r){const n=typeof this._options.getInjections=="function"?this._options.getInjections(e):void 0;this._syncRegistry.addGrammar(r,n)}}addGrammar(e,r=[],n=0,i=null){return this._syncRegistry.addGrammar(e,r),this._grammarForScopeName(e.scopeName,n,i)}_grammarForScopeName(e,r=0,n=null,i=null,o=null){return this._syncRegistry.grammarForScopeName(e,r,n,i,o)}},Mt=zt.NULL;const Io=["area","base","basefont","bgsound","br","col","command","embed","frame","hr","image","img","input","keygen","link","meta","param","source","track","wbr"];class je{constructor(e,r,n){this.normal=r,this.property=e,n&&(this.space=n)}}je.prototype.normal={};je.prototype.property={};je.prototype.space=void 0;function yn(t,e){const r={},n={};for(const i of t)Object.assign(r,i.property),Object.assign(n,i.normal);return new je(r,n,e)}function Bt(t){return t.toLowerCase()}class G{constructor(e,r){this.attribute=r,this.property=e}}G.prototype.attribute="";G.prototype.booleanish=!1;G.prototype.boolean=!1;G.prototype.commaOrSpaceSeparated=!1;G.prototype.commaSeparated=!1;G.prototype.defined=!1;G.prototype.mustUseProperty=!1;G.prototype.number=!1;G.prototype.overloadedBoolean=!1;G.prototype.property="";G.prototype.spaceSeparated=!1;G.prototype.space=void 0;let Co=0;const w=me(),I=me(),jt=me(),f=me(),A=me(),ye=me(),F=me();function me(){return 2**++Co}const Gt=Object.freeze(Object.defineProperty({__proto__:null,boolean:w,booleanish:I,commaOrSpaceSeparated:F,commaSeparated:ye,number:f,overloadedBoolean:jt,spaceSeparated:A},Symbol.toStringTag,{value:"Module"})),wt=Object.keys(Gt);class rr extends G{constructor(e,r,n,i){let o=-1;if(super(e,r),Ar(this,"space",i),typeof n=="number")for(;++o<wt.length;){const a=wt[o];Ar(this,wt[o],(n&Gt[a])===Gt[a])}}}rr.prototype.defined=!0;function Ar(t,e,r){r&&(t[e]=r)}function Ee(t){const e={},r={};for(const[n,i]of Object.entries(t.properties)){const o=new rr(n,t.transform(t.attributes||{},n),i,t.space);t.mustUseProperty&&t.mustUseProperty.includes(n)&&(o.mustUseProperty=!0),e[n]=o,r[Bt(n)]=n,r[Bt(o.attribute)]=n}return new je(e,r,t.space)}const xn=Ee({properties:{ariaActiveDescendant:null,ariaAtomic:I,ariaAutoComplete:null,ariaBusy:I,ariaChecked:I,ariaColCount:f,ariaColIndex:f,ariaColSpan:f,ariaControls:A,ariaCurrent:null,ariaDescribedBy:A,ariaDetails:null,ariaDisabled:I,ariaDropEffect:A,ariaErrorMessage:null,ariaExpanded:I,ariaFlowTo:A,ariaGrabbed:I,ariaHasPopup:null,ariaHidden:I,ariaInvalid:null,ariaKeyShortcuts:null,ariaLabel:null,ariaLabelledBy:A,ariaLevel:f,ariaLive:null,ariaModal:I,ariaMultiLine:I,ariaMultiSelectable:I,ariaOrientation:null,ariaOwns:A,ariaPlaceholder:null,ariaPosInSet:f,ariaPressed:I,ariaReadOnly:I,ariaRelevant:null,ariaRequired:I,ariaRoleDescription:A,ariaRowCount:f,ariaRowIndex:f,ariaRowSpan:f,ariaSelected:I,ariaSetSize:f,ariaSort:null,ariaValueMax:f,ariaValueMin:f,ariaValueNow:f,ariaValueText:null,role:null},transform(t,e){return e==="role"?e:"aria-"+e.slice(4).toLowerCase()}});function kn(t,e){return e in t?t[e]:e}function wn(t,e){return kn(t,e.toLowerCase())}const Oo=Ee({attributes:{acceptcharset:"accept-charset",classname:"class",htmlfor:"for",httpequiv:"http-equiv"},mustUseProperty:["checked","multiple","muted","selected"],properties:{abbr:null,accept:ye,acceptCharset:A,accessKey:A,action:null,allow:null,allowFullScreen:w,allowPaymentRequest:w,allowUserMedia:w,alt:null,as:null,async:w,autoCapitalize:null,autoComplete:A,autoFocus:w,autoPlay:w,blocking:A,capture:null,charSet:null,checked:w,cite:null,className:A,cols:f,colSpan:null,content:null,contentEditable:I,controls:w,controlsList:A,coords:f|ye,crossOrigin:null,data:null,dateTime:null,decoding:null,default:w,defer:w,dir:null,dirName:null,disabled:w,download:jt,draggable:I,encType:null,enterKeyHint:null,fetchPriority:null,form:null,formAction:null,formEncType:null,formMethod:null,formNoValidate:w,formTarget:null,headers:A,height:f,hidden:jt,high:f,href:null,hrefLang:null,htmlFor:A,httpEquiv:A,id:null,imageSizes:null,imageSrcSet:null,inert:w,inputMode:null,integrity:null,is:null,isMap:w,itemId:null,itemProp:A,itemRef:A,itemScope:w,itemType:A,kind:null,label:null,lang:null,language:null,list:null,loading:null,loop:w,low:f,manifest:null,max:null,maxLength:f,media:null,method:null,min:null,minLength:f,multiple:w,muted:w,name:null,nonce:null,noModule:w,noValidate:w,onAbort:null,onAfterPrint:null,onAuxClick:null,onBeforeMatch:null,onBeforePrint:null,onBeforeToggle:null,onBeforeUnload:null,onBlur:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onContextLost:null,onContextMenu:null,onContextRestored:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnded:null,onError:null,onFocus:null,onFormData:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLanguageChange:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadEnd:null,onLoadStart:null,onMessage:null,onMessageError:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRejectionHandled:null,onReset:null,onResize:null,onScroll:null,onScrollEnd:null,onSecurityPolicyViolation:null,onSeeked:null,onSeeking:null,onSelect:null,onSlotChange:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnhandledRejection:null,onUnload:null,onVolumeChange:null,onWaiting:null,onWheel:null,open:w,optimum:f,pattern:null,ping:A,placeholder:null,playsInline:w,popover:null,popoverTarget:null,popoverTargetAction:null,poster:null,preload:null,readOnly:w,referrerPolicy:null,rel:A,required:w,reversed:w,rows:f,rowSpan:f,sandbox:A,scope:null,scoped:w,seamless:w,selected:w,shadowRootClonable:w,shadowRootDelegatesFocus:w,shadowRootMode:null,shape:null,size:f,sizes:null,slot:null,span:f,spellCheck:I,src:null,srcDoc:null,srcLang:null,srcSet:null,start:f,step:null,style:null,tabIndex:f,target:null,title:null,translate:null,type:null,typeMustMatch:w,useMap:null,value:I,width:f,wrap:null,writingSuggestions:null,align:null,aLink:null,archive:A,axis:null,background:null,bgColor:null,border:f,borderColor:null,bottomMargin:f,cellPadding:null,cellSpacing:null,char:null,charOff:null,classId:null,clear:null,code:null,codeBase:null,codeType:null,color:null,compact:w,declare:w,event:null,face:null,frame:null,frameBorder:null,hSpace:f,leftMargin:f,link:null,longDesc:null,lowSrc:null,marginHeight:f,marginWidth:f,noResize:w,noHref:w,noShade:w,noWrap:w,object:null,profile:null,prompt:null,rev:null,rightMargin:f,rules:null,scheme:null,scrolling:I,standby:null,summary:null,text:null,topMargin:f,valueType:null,version:null,vAlign:null,vLink:null,vSpace:f,allowTransparency:null,autoCorrect:null,autoSave:null,disablePictureInPicture:w,disableRemotePlayback:w,prefix:null,property:null,results:f,security:null,unselectable:null},space:"html",transform:wn}),Do=Ee({attributes:{accentHeight:"accent-height",alignmentBaseline:"alignment-baseline",arabicForm:"arabic-form",baselineShift:"baseline-shift",capHeight:"cap-height",className:"class",clipPath:"clip-path",clipRule:"clip-rule",colorInterpolation:"color-interpolation",colorInterpolationFilters:"color-interpolation-filters",colorProfile:"color-profile",colorRendering:"color-rendering",crossOrigin:"crossorigin",dataType:"datatype",dominantBaseline:"dominant-baseline",enableBackground:"enable-background",fillOpacity:"fill-opacity",fillRule:"fill-rule",floodColor:"flood-color",floodOpacity:"flood-opacity",fontFamily:"font-family",fontSize:"font-size",fontSizeAdjust:"font-size-adjust",fontStretch:"font-stretch",fontStyle:"font-style",fontVariant:"font-variant",fontWeight:"font-weight",glyphName:"glyph-name",glyphOrientationHorizontal:"glyph-orientation-horizontal",glyphOrientationVertical:"glyph-orientation-vertical",hrefLang:"hreflang",horizAdvX:"horiz-adv-x",horizOriginX:"horiz-origin-x",horizOriginY:"horiz-origin-y",imageRendering:"image-rendering",letterSpacing:"letter-spacing",lightingColor:"lighting-color",markerEnd:"marker-end",markerMid:"marker-mid",markerStart:"marker-start",navDown:"nav-down",navDownLeft:"nav-down-left",navDownRight:"nav-down-right",navLeft:"nav-left",navNext:"nav-next",navPrev:"nav-prev",navRight:"nav-right",navUp:"nav-up",navUpLeft:"nav-up-left",navUpRight:"nav-up-right",onAbort:"onabort",onActivate:"onactivate",onAfterPrint:"onafterprint",onBeforePrint:"onbeforeprint",onBegin:"onbegin",onCancel:"oncancel",onCanPlay:"oncanplay",onCanPlayThrough:"oncanplaythrough",onChange:"onchange",onClick:"onclick",onClose:"onclose",onCopy:"oncopy",onCueChange:"oncuechange",onCut:"oncut",onDblClick:"ondblclick",onDrag:"ondrag",onDragEnd:"ondragend",onDragEnter:"ondragenter",onDragExit:"ondragexit",onDragLeave:"ondragleave",onDragOver:"ondragover",onDragStart:"ondragstart",onDrop:"ondrop",onDurationChange:"ondurationchange",onEmptied:"onemptied",onEnd:"onend",onEnded:"onended",onError:"onerror",onFocus:"onfocus",onFocusIn:"onfocusin",onFocusOut:"onfocusout",onHashChange:"onhashchange",onInput:"oninput",onInvalid:"oninvalid",onKeyDown:"onkeydown",onKeyPress:"onkeypress",onKeyUp:"onkeyup",onLoad:"onload",onLoadedData:"onloadeddata",onLoadedMetadata:"onloadedmetadata",onLoadStart:"onloadstart",onMessage:"onmessage",onMouseDown:"onmousedown",onMouseEnter:"onmouseenter",onMouseLeave:"onmouseleave",onMouseMove:"onmousemove",onMouseOut:"onmouseout",onMouseOver:"onmouseover",onMouseUp:"onmouseup",onMouseWheel:"onmousewheel",onOffline:"onoffline",onOnline:"ononline",onPageHide:"onpagehide",onPageShow:"onpageshow",onPaste:"onpaste",onPause:"onpause",onPlay:"onplay",onPlaying:"onplaying",onPopState:"onpopstate",onProgress:"onprogress",onRateChange:"onratechange",onRepeat:"onrepeat",onReset:"onreset",onResize:"onresize",onScroll:"onscroll",onSeeked:"onseeked",onSeeking:"onseeking",onSelect:"onselect",onShow:"onshow",onStalled:"onstalled",onStorage:"onstorage",onSubmit:"onsubmit",onSuspend:"onsuspend",onTimeUpdate:"ontimeupdate",onToggle:"ontoggle",onUnload:"onunload",onVolumeChange:"onvolumechange",onWaiting:"onwaiting",onZoom:"onzoom",overlinePosition:"overline-position",overlineThickness:"overline-thickness",paintOrder:"paint-order",panose1:"panose-1",pointerEvents:"pointer-events",referrerPolicy:"referrerpolicy",renderingIntent:"rendering-intent",shapeRendering:"shape-rendering",stopColor:"stop-color",stopOpacity:"stop-opacity",strikethroughPosition:"strikethrough-position",strikethroughThickness:"strikethrough-thickness",strokeDashArray:"stroke-dasharray",strokeDashOffset:"stroke-dashoffset",strokeLineCap:"stroke-linecap",strokeLineJoin:"stroke-linejoin",strokeMiterLimit:"stroke-miterlimit",strokeOpacity:"stroke-opacity",strokeWidth:"stroke-width",tabIndex:"tabindex",textAnchor:"text-anchor",textDecoration:"text-decoration",textRendering:"text-rendering",transformOrigin:"transform-origin",typeOf:"typeof",underlinePosition:"underline-position",underlineThickness:"underline-thickness",unicodeBidi:"unicode-bidi",unicodeRange:"unicode-range",unitsPerEm:"units-per-em",vAlphabetic:"v-alphabetic",vHanging:"v-hanging",vIdeographic:"v-ideographic",vMathematical:"v-mathematical",vectorEffect:"vector-effect",vertAdvY:"vert-adv-y",vertOriginX:"vert-origin-x",vertOriginY:"vert-origin-y",wordSpacing:"word-spacing",writingMode:"writing-mode",xHeight:"x-height",playbackOrder:"playbackorder",timelineBegin:"timelinebegin"},properties:{about:F,accentHeight:f,accumulate:null,additive:null,alignmentBaseline:null,alphabetic:f,amplitude:f,arabicForm:null,ascent:f,attributeName:null,attributeType:null,azimuth:f,bandwidth:null,baselineShift:null,baseFrequency:null,baseProfile:null,bbox:null,begin:null,bias:f,by:null,calcMode:null,capHeight:f,className:A,clip:null,clipPath:null,clipPathUnits:null,clipRule:null,color:null,colorInterpolation:null,colorInterpolationFilters:null,colorProfile:null,colorRendering:null,content:null,contentScriptType:null,contentStyleType:null,crossOrigin:null,cursor:null,cx:null,cy:null,d:null,dataType:null,defaultAction:null,descent:f,diffuseConstant:f,direction:null,display:null,dur:null,divisor:f,dominantBaseline:null,download:w,dx:null,dy:null,edgeMode:null,editable:null,elevation:f,enableBackground:null,end:null,event:null,exponent:f,externalResourcesRequired:null,fill:null,fillOpacity:f,fillRule:null,filter:null,filterRes:null,filterUnits:null,floodColor:null,floodOpacity:null,focusable:null,focusHighlight:null,fontFamily:null,fontSize:null,fontSizeAdjust:null,fontStretch:null,fontStyle:null,fontVariant:null,fontWeight:null,format:null,fr:null,from:null,fx:null,fy:null,g1:ye,g2:ye,glyphName:ye,glyphOrientationHorizontal:null,glyphOrientationVertical:null,glyphRef:null,gradientTransform:null,gradientUnits:null,handler:null,hanging:f,hatchContentUnits:null,hatchUnits:null,height:null,href:null,hrefLang:null,horizAdvX:f,horizOriginX:f,horizOriginY:f,id:null,ideographic:f,imageRendering:null,initialVisibility:null,in:null,in2:null,intercept:f,k:f,k1:f,k2:f,k3:f,k4:f,kernelMatrix:F,kernelUnitLength:null,keyPoints:null,keySplines:null,keyTimes:null,kerning:null,lang:null,lengthAdjust:null,letterSpacing:null,lightingColor:null,limitingConeAngle:f,local:null,markerEnd:null,markerMid:null,markerStart:null,markerHeight:null,markerUnits:null,markerWidth:null,mask:null,maskContentUnits:null,maskUnits:null,mathematical:null,max:null,media:null,mediaCharacterEncoding:null,mediaContentEncodings:null,mediaSize:f,mediaTime:null,method:null,min:null,mode:null,name:null,navDown:null,navDownLeft:null,navDownRight:null,navLeft:null,navNext:null,navPrev:null,navRight:null,navUp:null,navUpLeft:null,navUpRight:null,numOctaves:null,observer:null,offset:null,onAbort:null,onActivate:null,onAfterPrint:null,onBeforePrint:null,onBegin:null,onCancel:null,onCanPlay:null,onCanPlayThrough:null,onChange:null,onClick:null,onClose:null,onCopy:null,onCueChange:null,onCut:null,onDblClick:null,onDrag:null,onDragEnd:null,onDragEnter:null,onDragExit:null,onDragLeave:null,onDragOver:null,onDragStart:null,onDrop:null,onDurationChange:null,onEmptied:null,onEnd:null,onEnded:null,onError:null,onFocus:null,onFocusIn:null,onFocusOut:null,onHashChange:null,onInput:null,onInvalid:null,onKeyDown:null,onKeyPress:null,onKeyUp:null,onLoad:null,onLoadedData:null,onLoadedMetadata:null,onLoadStart:null,onMessage:null,onMouseDown:null,onMouseEnter:null,onMouseLeave:null,onMouseMove:null,onMouseOut:null,onMouseOver:null,onMouseUp:null,onMouseWheel:null,onOffline:null,onOnline:null,onPageHide:null,onPageShow:null,onPaste:null,onPause:null,onPlay:null,onPlaying:null,onPopState:null,onProgress:null,onRateChange:null,onRepeat:null,onReset:null,onResize:null,onScroll:null,onSeeked:null,onSeeking:null,onSelect:null,onShow:null,onStalled:null,onStorage:null,onSubmit:null,onSuspend:null,onTimeUpdate:null,onToggle:null,onUnload:null,onVolumeChange:null,onWaiting:null,onZoom:null,opacity:null,operator:null,order:null,orient:null,orientation:null,origin:null,overflow:null,overlay:null,overlinePosition:f,overlineThickness:f,paintOrder:null,panose1:null,path:null,pathLength:f,patternContentUnits:null,patternTransform:null,patternUnits:null,phase:null,ping:A,pitch:null,playbackOrder:null,pointerEvents:null,points:null,pointsAtX:f,pointsAtY:f,pointsAtZ:f,preserveAlpha:null,preserveAspectRatio:null,primitiveUnits:null,propagate:null,property:F,r:null,radius:null,referrerPolicy:null,refX:null,refY:null,rel:F,rev:F,renderingIntent:null,repeatCount:null,repeatDur:null,requiredExtensions:F,requiredFeatures:F,requiredFonts:F,requiredFormats:F,resource:null,restart:null,result:null,rotate:null,rx:null,ry:null,scale:null,seed:null,shapeRendering:null,side:null,slope:null,snapshotTime:null,specularConstant:f,specularExponent:f,spreadMethod:null,spacing:null,startOffset:null,stdDeviation:null,stemh:null,stemv:null,stitchTiles:null,stopColor:null,stopOpacity:null,strikethroughPosition:f,strikethroughThickness:f,string:null,stroke:null,strokeDashArray:F,strokeDashOffset:null,strokeLineCap:null,strokeLineJoin:null,strokeMiterLimit:f,strokeOpacity:f,strokeWidth:null,style:null,surfaceScale:f,syncBehavior:null,syncBehaviorDefault:null,syncMaster:null,syncTolerance:null,syncToleranceDefault:null,systemLanguage:F,tabIndex:f,tableValues:null,target:null,targetX:f,targetY:f,textAnchor:null,textDecoration:null,textRendering:null,textLength:null,timelineBegin:null,title:null,transformBehavior:null,type:null,typeOf:F,to:null,transform:null,transformOrigin:null,u1:null,u2:null,underlinePosition:f,underlineThickness:f,unicode:null,unicodeBidi:null,unicodeRange:null,unitsPerEm:f,values:null,vAlphabetic:f,vMathematical:f,vectorEffect:null,vHanging:f,vIdeographic:f,version:null,vertAdvY:f,vertOriginX:f,vertOriginY:f,viewBox:null,viewTarget:null,visibility:null,width:null,widths:null,wordSpacing:null,writingMode:null,x:null,x1:null,x2:null,xChannelSelector:null,xHeight:f,y:null,y1:null,y2:null,yChannelSelector:null,z:null,zoomAndPan:null},space:"svg",transform:kn}),En=Ee({properties:{xLinkActuate:null,xLinkArcRole:null,xLinkHref:null,xLinkRole:null,xLinkShow:null,xLinkTitle:null,xLinkType:null},space:"xlink",transform(t,e){return"xlink:"+e.slice(5).toLowerCase()}}),Rn=Ee({attributes:{xmlnsxlink:"xmlns:xlink"},properties:{xmlnsXLink:null,xmlns:null},space:"xmlns",transform:wn}),Pn=Ee({properties:{xmlBase:null,xmlLang:null,xmlSpace:null},space:"xml",transform(t,e){return"xml:"+e.slice(3).toLowerCase()}}),$o=/[A-Z]/g,Lr=/-[a-z]/g,No=/^data[-\w.:]+$/i;function Vo(t,e){const r=Bt(e);let n=e,i=G;if(r in t.normal)return t.property[t.normal[r]];if(r.length>4&&r.slice(0,4)==="data"&&No.test(e)){if(e.charAt(4)==="-"){const o=e.slice(5).replace(Lr,Mo);n="data"+o.charAt(0).toUpperCase()+o.slice(1)}else{const o=e.slice(4);if(!Lr.test(o)){let a=o.replace($o,zo);a.charAt(0)!=="-"&&(a="-"+a),e="data"+a}}i=rr}return new i(n,e)}function zo(t){return"-"+t.toLowerCase()}function Mo(t){return t.charAt(1).toUpperCase()}const Bo=yn([xn,Oo,En,Rn,Pn],"html"),Sn=yn([xn,Do,En,Rn,Pn],"svg"),Ir={}.hasOwnProperty;function jo(t,e){const r=e||{};function n(i,...o){let a=n.invalid;const l=n.handlers;if(i&&Ir.call(i,t)){const s=String(i[t]);a=Ir.call(l,s)?l[s]:n.unknown}if(a)return a.call(this,i,...o)}return n.handlers=r.handlers||{},n.invalid=r.invalid,n.unknown=r.unknown,n}const Go=/["&'<>`]/g,Uo=/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,Fo=/[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g,Ho=/[|\\{}()[\]^$+*?.]/g,Cr=new WeakMap;function qo(t,e){if(t=t.replace(e.subset?Wo(e.subset):Go,n),e.subset||e.escapeOnly)return t;return t.replace(Uo,r).replace(Fo,n);function r(i,o,a){return e.format((i.charCodeAt(0)-55296)*1024+i.charCodeAt(1)-56320+65536,a.charCodeAt(o+2),e)}function n(i,o,a){return e.format(i.charCodeAt(0),a.charCodeAt(o+1),e)}}function Wo(t){let e=Cr.get(t);return e||(e=Ko(t),Cr.set(t,e)),e}function Ko(t){const e=[];let r=-1;for(;++r<t.length;)e.push(t[r].replace(Ho,"\\$&"));return new RegExp("(?:"+e.join("|")+")","g")}const Qo=/[\dA-Fa-f]/;function Xo(t,e,r){const n="&#x"+t.toString(16).toUpperCase();return r&&e&&!Qo.test(String.fromCharCode(e))?n:n+";"}const Yo=/\d/;function Zo(t,e,r){const n="&#"+String(t);return r&&e&&!Yo.test(String.fromCharCode(e))?n:n+";"}const Jo=["AElig","AMP","Aacute","Acirc","Agrave","Aring","Atilde","Auml","COPY","Ccedil","ETH","Eacute","Ecirc","Egrave","Euml","GT","Iacute","Icirc","Igrave","Iuml","LT","Ntilde","Oacute","Ocirc","Ograve","Oslash","Otilde","Ouml","QUOT","REG","THORN","Uacute","Ucirc","Ugrave","Uuml","Yacute","aacute","acirc","acute","aelig","agrave","amp","aring","atilde","auml","brvbar","ccedil","cedil","cent","copy","curren","deg","divide","eacute","ecirc","egrave","eth","euml","frac12","frac14","frac34","gt","iacute","icirc","iexcl","igrave","iquest","iuml","laquo","lt","macr","micro","middot","nbsp","not","ntilde","oacute","ocirc","ograve","ordf","ordm","oslash","otilde","ouml","para","plusmn","pound","quot","raquo","reg","sect","shy","sup1","sup2","sup3","szlig","thorn","times","uacute","ucirc","ugrave","uml","uuml","yacute","yen","yuml"],Et={nbsp:" ",iexcl:"¡",cent:"¢",pound:"£",curren:"¤",yen:"¥",brvbar:"¦",sect:"§",uml:"¨",copy:"©",ordf:"ª",laquo:"«",not:"¬",shy:"­",reg:"®",macr:"¯",deg:"°",plusmn:"±",sup2:"²",sup3:"³",acute:"´",micro:"µ",para:"¶",middot:"·",cedil:"¸",sup1:"¹",ordm:"º",raquo:"»",frac14:"¼",frac12:"½",frac34:"¾",iquest:"¿",Agrave:"À",Aacute:"Á",Acirc:"Â",Atilde:"Ã",Auml:"Ä",Aring:"Å",AElig:"Æ",Ccedil:"Ç",Egrave:"È",Eacute:"É",Ecirc:"Ê",Euml:"Ë",Igrave:"Ì",Iacute:"Í",Icirc:"Î",Iuml:"Ï",ETH:"Ð",Ntilde:"Ñ",Ograve:"Ò",Oacute:"Ó",Ocirc:"Ô",Otilde:"Õ",Ouml:"Ö",times:"×",Oslash:"Ø",Ugrave:"Ù",Uacute:"Ú",Ucirc:"Û",Uuml:"Ü",Yacute:"Ý",THORN:"Þ",szlig:"ß",agrave:"à",aacute:"á",acirc:"â",atilde:"ã",auml:"ä",aring:"å",aelig:"æ",ccedil:"ç",egrave:"è",eacute:"é",ecirc:"ê",euml:"ë",igrave:"ì",iacute:"í",icirc:"î",iuml:"ï",eth:"ð",ntilde:"ñ",ograve:"ò",oacute:"ó",ocirc:"ô",otilde:"õ",ouml:"ö",divide:"÷",oslash:"ø",ugrave:"ù",uacute:"ú",ucirc:"û",uuml:"ü",yacute:"ý",thorn:"þ",yuml:"ÿ",fnof:"ƒ",Alpha:"Α",Beta:"Β",Gamma:"Γ",Delta:"Δ",Epsilon:"Ε",Zeta:"Ζ",Eta:"Η",Theta:"Θ",Iota:"Ι",Kappa:"Κ",Lambda:"Λ",Mu:"Μ",Nu:"Ν",Xi:"Ξ",Omicron:"Ο",Pi:"Π",Rho:"Ρ",Sigma:"Σ",Tau:"Τ",Upsilon:"Υ",Phi:"Φ",Chi:"Χ",Psi:"Ψ",Omega:"Ω",alpha:"α",beta:"β",gamma:"γ",delta:"δ",epsilon:"ε",zeta:"ζ",eta:"η",theta:"θ",iota:"ι",kappa:"κ",lambda:"λ",mu:"μ",nu:"ν",xi:"ξ",omicron:"ο",pi:"π",rho:"ρ",sigmaf:"ς",sigma:"σ",tau:"τ",upsilon:"υ",phi:"φ",chi:"χ",psi:"ψ",omega:"ω",thetasym:"ϑ",upsih:"ϒ",piv:"ϖ",bull:"•",hellip:"…",prime:"′",Prime:"″",oline:"‾",frasl:"⁄",weierp:"℘",image:"ℑ",real:"ℜ",trade:"™",alefsym:"ℵ",larr:"←",uarr:"↑",rarr:"→",darr:"↓",harr:"↔",crarr:"↵",lArr:"⇐",uArr:"⇑",rArr:"⇒",dArr:"⇓",hArr:"⇔",forall:"∀",part:"∂",exist:"∃",empty:"∅",nabla:"∇",isin:"∈",notin:"∉",ni:"∋",prod:"∏",sum:"∑",minus:"−",lowast:"∗",radic:"√",prop:"∝",infin:"∞",ang:"∠",and:"∧",or:"∨",cap:"∩",cup:"∪",int:"∫",there4:"∴",sim:"∼",cong:"≅",asymp:"≈",ne:"≠",equiv:"≡",le:"≤",ge:"≥",sub:"⊂",sup:"⊃",nsub:"⊄",sube:"⊆",supe:"⊇",oplus:"⊕",otimes:"⊗",perp:"⊥",sdot:"⋅",lceil:"⌈",rceil:"⌉",lfloor:"⌊",rfloor:"⌋",lang:"〈",rang:"〉",loz:"◊",spades:"♠",clubs:"♣",hearts:"♥",diams:"♦",quot:'"',amp:"&",lt:"<",gt:">",OElig:"Œ",oelig:"œ",Scaron:"Š",scaron:"š",Yuml:"Ÿ",circ:"ˆ",tilde:"˜",ensp:" ",emsp:" ",thinsp:" ",zwnj:"‌",zwj:"‍",lrm:"‎",rlm:"‏",ndash:"–",mdash:"—",lsquo:"‘",rsquo:"’",sbquo:"‚",ldquo:"“",rdquo:"”",bdquo:"„",dagger:"†",Dagger:"‡",permil:"‰",lsaquo:"‹",rsaquo:"›",euro:"€"},ea=["cent","copy","divide","gt","lt","not","para","times"],Tn={}.hasOwnProperty,Ut={};let He;for(He in Et)Tn.call(Et,He)&&(Ut[Et[He]]=He);const ta=/[^\dA-Za-z]/;function ra(t,e,r,n){const i=String.fromCharCode(t);if(Tn.call(Ut,i)){const o=Ut[i],a="&"+o;return r&&Jo.includes(o)&&!ea.includes(o)&&(!n||e&&e!==61&&ta.test(String.fromCharCode(e)))?a:a+";"}return""}function na(t,e,r){let n=Xo(t,e,r.omitOptionalSemicolons),i;if((r.useNamedReferences||r.useShortestReferences)&&(i=ra(t,e,r.omitOptionalSemicolons,r.attribute)),(r.useShortestReferences||!i)&&r.useShortestReferences){const o=Zo(t,e,r.omitOptionalSemicolons);o.length<n.length&&(n=o)}return i&&(!r.useShortestReferences||i.length<n.length)?i:n}function xe(t,e){return qo(t,Object.assign({format:na},e))}const ia=/^>|^->|<!--|-->|--!>|<!-$/g,oa=[">"],aa=["<",">"];function sa(t,e,r,n){return n.settings.bogusComments?"<?"+xe(t.value,Object.assign({},n.settings.characterReferences,{subset:oa}))+">":"<!--"+t.value.replace(ia,i)+"-->";function i(o){return xe(o,Object.assign({},n.settings.characterReferences,{subset:aa}))}}function la(t,e,r,n){return"<!"+(n.settings.upperDoctype?"DOCTYPE":"doctype")+(n.settings.tightDoctype?"":" ")+"html>"}function Or(t,e){const r=String(t);if(typeof e!="string")throw new TypeError("Expected character");let n=0,i=r.indexOf(e);for(;i!==-1;)n++,i=r.indexOf(e,i+e.length);return n}function ca(t,e){const r=e||{};return(t[t.length-1]===""?[...t,""]:t).join((r.padRight?" ":"")+","+(r.padLeft===!1?"":" ")).trim()}function ua(t){return t.join(" ").trim()}const da=/[ \t\n\f\r]/g;function nr(t){return typeof t=="object"?t.type==="text"?Dr(t.value):!1:Dr(t)}function Dr(t){return t.replace(da,"")===""}const D=Ln(1),An=Ln(-1),pa=[];function Ln(t){return e;function e(r,n,i){const o=r?r.children:pa;let a=(n||0)+t,l=o[a];if(!i)for(;l&&nr(l);)a+=t,l=o[a];return l}}const ha={}.hasOwnProperty;function In(t){return e;function e(r,n,i){return ha.call(t,r.tagName)&&t[r.tagName](r,n,i)}}const ir=In({body:ma,caption:Rt,colgroup:Rt,dd:ba,dt:va,head:Rt,html:ga,li:_a,optgroup:ya,option:xa,p:fa,rp:$r,rt:$r,tbody:wa,td:Nr,tfoot:Ea,th:Nr,thead:ka,tr:Ra});function Rt(t,e,r){const n=D(r,e,!0);return!n||n.type!=="comment"&&!(n.type==="text"&&nr(n.value.charAt(0)))}function ga(t,e,r){const n=D(r,e);return!n||n.type!=="comment"}function ma(t,e,r){const n=D(r,e);return!n||n.type!=="comment"}function fa(t,e,r){const n=D(r,e);return n?n.type==="element"&&(n.tagName==="address"||n.tagName==="article"||n.tagName==="aside"||n.tagName==="blockquote"||n.tagName==="details"||n.tagName==="div"||n.tagName==="dl"||n.tagName==="fieldset"||n.tagName==="figcaption"||n.tagName==="figure"||n.tagName==="footer"||n.tagName==="form"||n.tagName==="h1"||n.tagName==="h2"||n.tagName==="h3"||n.tagName==="h4"||n.tagName==="h5"||n.tagName==="h6"||n.tagName==="header"||n.tagName==="hgroup"||n.tagName==="hr"||n.tagName==="main"||n.tagName==="menu"||n.tagName==="nav"||n.tagName==="ol"||n.tagName==="p"||n.tagName==="pre"||n.tagName==="section"||n.tagName==="table"||n.tagName==="ul"):!r||!(r.type==="element"&&(r.tagName==="a"||r.tagName==="audio"||r.tagName==="del"||r.tagName==="ins"||r.tagName==="map"||r.tagName==="noscript"||r.tagName==="video"))}function _a(t,e,r){const n=D(r,e);return!n||n.type==="element"&&n.tagName==="li"}function va(t,e,r){const n=D(r,e);return!!(n&&n.type==="element"&&(n.tagName==="dt"||n.tagName==="dd"))}function ba(t,e,r){const n=D(r,e);return!n||n.type==="element"&&(n.tagName==="dt"||n.tagName==="dd")}function $r(t,e,r){const n=D(r,e);return!n||n.type==="element"&&(n.tagName==="rp"||n.tagName==="rt")}function ya(t,e,r){const n=D(r,e);return!n||n.type==="element"&&n.tagName==="optgroup"}function xa(t,e,r){const n=D(r,e);return!n||n.type==="element"&&(n.tagName==="option"||n.tagName==="optgroup")}function ka(t,e,r){const n=D(r,e);return!!(n&&n.type==="element"&&(n.tagName==="tbody"||n.tagName==="tfoot"))}function wa(t,e,r){const n=D(r,e);return!n||n.type==="element"&&(n.tagName==="tbody"||n.tagName==="tfoot")}function Ea(t,e,r){return!D(r,e)}function Ra(t,e,r){const n=D(r,e);return!n||n.type==="element"&&n.tagName==="tr"}function Nr(t,e,r){const n=D(r,e);return!n||n.type==="element"&&(n.tagName==="td"||n.tagName==="th")}const Pa=In({body:Aa,colgroup:La,head:Ta,html:Sa,tbody:Ia});function Sa(t){const e=D(t,-1);return!e||e.type!=="comment"}function Ta(t){const e=new Set;for(const n of t.children)if(n.type==="element"&&(n.tagName==="base"||n.tagName==="title")){if(e.has(n.tagName))return!1;e.add(n.tagName)}const r=t.children[0];return!r||r.type==="element"}function Aa(t){const e=D(t,-1,!0);return!e||e.type!=="comment"&&!(e.type==="text"&&nr(e.value.charAt(0)))&&!(e.type==="element"&&(e.tagName==="meta"||e.tagName==="link"||e.tagName==="script"||e.tagName==="style"||e.tagName==="template"))}function La(t,e,r){const n=An(r,e),i=D(t,-1,!0);return r&&n&&n.type==="element"&&n.tagName==="colgroup"&&ir(n,r.children.indexOf(n),r)?!1:!!(i&&i.type==="element"&&i.tagName==="col")}function Ia(t,e,r){const n=An(r,e),i=D(t,-1);return r&&n&&n.type==="element"&&(n.tagName==="thead"||n.tagName==="tbody")&&ir(n,r.children.indexOf(n),r)?!1:!!(i&&i.type==="element"&&i.tagName==="tr")}const qe={name:[[`	
\f\r &/=>`.split(""),`	
\f\r "&'/=>\``.split("")],[`\0	
\f\r "&'/<=>`.split(""),`\0	
\f\r "&'/<=>\``.split("")]],unquoted:[[`	
\f\r &>`.split(""),`\0	
\f\r "&'<=>\``.split("")],[`\0	
\f\r "&'<=>\``.split(""),`\0	
\f\r "&'<=>\``.split("")]],single:[["&'".split(""),"\"&'`".split("")],["\0&'".split(""),"\0\"&'`".split("")]],double:[['"&'.split(""),"\"&'`".split("")],['\0"&'.split(""),"\0\"&'`".split("")]]};function Ca(t,e,r,n){const i=n.schema,o=i.space==="svg"?!1:n.settings.omitOptionalTags;let a=i.space==="svg"?n.settings.closeEmptyElements:n.settings.voids.includes(t.tagName.toLowerCase());const l=[];let s;i.space==="html"&&t.tagName==="svg"&&(n.schema=Sn);const u=Oa(n,t.properties),d=n.all(i.space==="html"&&t.tagName==="template"?t.content:t);return n.schema=i,d&&(a=!1),(u||!o||!Pa(t,e,r))&&(l.push("<",t.tagName,u?" "+u:""),a&&(i.space==="svg"||n.settings.closeSelfClosing)&&(s=u.charAt(u.length-1),(!n.settings.tightSelfClosing||s==="/"||s&&s!=='"'&&s!=="'")&&l.push(" "),l.push("/")),l.push(">")),l.push(d),!a&&(!o||!ir(t,e,r))&&l.push("</"+t.tagName+">"),l.join("")}function Oa(t,e){const r=[];let n=-1,i;if(e){for(i in e)if(e[i]!==null&&e[i]!==void 0){const o=Da(t,i,e[i]);o&&r.push(o)}}for(;++n<r.length;){const o=t.settings.tightAttributes?r[n].charAt(r[n].length-1):void 0;n!==r.length-1&&o!=='"'&&o!=="'"&&(r[n]+=" ")}return r.join("")}function Da(t,e,r){const n=Vo(t.schema,e),i=t.settings.allowParseErrors&&t.schema.space==="html"?0:1,o=t.settings.allowDangerousCharacters?0:1;let a=t.quote,l;if(n.overloadedBoolean&&(r===n.attribute||r==="")?r=!0:(n.boolean||n.overloadedBoolean)&&(typeof r!="string"||r===n.attribute||r==="")&&(r=!!r),r==null||r===!1||typeof r=="number"&&Number.isNaN(r))return"";const s=xe(n.attribute,Object.assign({},t.settings.characterReferences,{subset:qe.name[i][o]}));return r===!0||(r=Array.isArray(r)?(n.commaSeparated?ca:ua)(r,{padLeft:!t.settings.tightCommaSeparatedLists}):String(r),t.settings.collapseEmptyAttributes&&!r)?s:(t.settings.preferUnquoted&&(l=xe(r,Object.assign({},t.settings.characterReferences,{attribute:!0,subset:qe.unquoted[i][o]}))),l!==r&&(t.settings.quoteSmart&&Or(r,a)>Or(r,t.alternative)&&(a=t.alternative),l=a+xe(r,Object.assign({},t.settings.characterReferences,{subset:(a==="'"?qe.single:qe.double)[i][o],attribute:!0}))+a),s+(l&&"="+l))}const $a=["<","&"];function Cn(t,e,r,n){return r&&r.type==="element"&&(r.tagName==="script"||r.tagName==="style")?t.value:xe(t.value,Object.assign({},n.settings.characterReferences,{subset:$a}))}function Na(t,e,r,n){return n.settings.allowDangerousHtml?t.value:Cn(t,e,r,n)}function Va(t,e,r,n){return n.all(t)}const za=jo("type",{invalid:Ma,unknown:Ba,handlers:{comment:sa,doctype:la,element:Ca,raw:Na,root:Va,text:Cn}});function Ma(t){throw new Error("Expected node, not `"+t+"`")}function Ba(t){const e=t;throw new Error("Cannot compile unknown node `"+e.type+"`")}const ja={},Ga={},Ua=[];function Fa(t,e){const r=e||ja,n=r.quote||'"',i=n==='"'?"'":'"';if(n!=='"'&&n!=="'")throw new Error("Invalid quote `"+n+"`, expected `'` or `\"`");return{one:Ha,all:qa,settings:{omitOptionalTags:r.omitOptionalTags||!1,allowParseErrors:r.allowParseErrors||!1,allowDangerousCharacters:r.allowDangerousCharacters||!1,quoteSmart:r.quoteSmart||!1,preferUnquoted:r.preferUnquoted||!1,tightAttributes:r.tightAttributes||!1,upperDoctype:r.upperDoctype||!1,tightDoctype:r.tightDoctype||!1,bogusComments:r.bogusComments||!1,tightCommaSeparatedLists:r.tightCommaSeparatedLists||!1,tightSelfClosing:r.tightSelfClosing||!1,collapseEmptyAttributes:r.collapseEmptyAttributes||!1,allowDangerousHtml:r.allowDangerousHtml||!1,voids:r.voids||Io,characterReferences:r.characterReferences||Ga,closeSelfClosing:r.closeSelfClosing||!1,closeEmptyElements:r.closeEmptyElements||!1},schema:r.space==="svg"?Sn:Bo,quote:n,alternative:i}.one(Array.isArray(t)?{type:"root",children:t}:t,void 0,void 0)}function Ha(t,e,r){return za(t,e,r,this)}function qa(t){const e=[],r=t&&t.children||Ua;let n=-1;for(;++n<r.length;)e[n]=this.one(r[n],n,t);return e.join("")}function ot(t,e){const r=typeof t=="string"?{}:{...t.colorReplacements},n=typeof t=="string"?t:t.name;for(const[i,o]of Object.entries(e?.colorReplacements||{}))typeof o=="string"?r[i]=o:i===n&&Object.assign(r,o);return r}function ie(t,e){return t&&(e?.[t?.toLowerCase()]||t)}function Wa(t){return Array.isArray(t)?t:[t]}async function On(t){return Promise.resolve(typeof t=="function"?t():t).then(e=>e.default||e)}function or(t){return!t||["plaintext","txt","text","plain"].includes(t)}function Dn(t){return t==="ansi"||or(t)}function ar(t){return t==="none"}function $n(t){return ar(t)}function Nn(t,e){if(!e)return t;t.properties||={},t.properties.class||=[],typeof t.properties.class=="string"&&(t.properties.class=t.properties.class.split(/\s+/g)),Array.isArray(t.properties.class)||(t.properties.class=[]);const r=Array.isArray(e)?e:e.split(/\s+/g);for(const n of r)n&&!t.properties.class.includes(n)&&t.properties.class.push(n);return t}function gt(t,e=!1){if(t.length===0)return[["",0]];const r=t.split(/(\r?\n)/g);let n=0;const i=[];for(let o=0;o<r.length;o+=2){const a=e?r[o]+(r[o+1]||""):r[o];i.push([a,n]),n+=r[o].length,n+=r[o+1]?.length||0}return i}function Ka(t){const e=gt(t,!0).map(([i])=>i);function r(i){if(i===t.length)return{line:e.length-1,character:e[e.length-1].length};let o=i,a=0;for(const l of e){if(o<l.length)break;o-=l.length,a++}return{line:a,character:o}}function n(i,o){let a=0;for(let l=0;l<i;l++)a+=e[l].length;return a+=o,a}return{lines:e,indexToPos:r,posToIndex:n}}const sr="light-dark()",Qa=["color","background-color"];function Xa(t,e){let r=0;const n=[];for(const i of e)i>r&&n.push({...t,content:t.content.slice(r,i),offset:t.offset+r}),r=i;return r<t.content.length&&n.push({...t,content:t.content.slice(r),offset:t.offset+r}),n}function Ya(t,e){const r=Array.from(e instanceof Set?e:new Set(e)).sort((n,i)=>n-i);return r.length?t.map(n=>n.flatMap(i=>{const o=r.filter(a=>i.offset<a&&a<i.offset+i.content.length).map(a=>a-i.offset).sort((a,l)=>a-l);return o.length?Xa(i,o):i})):t}function Za(t,e,r,n,i="css-vars"){const o={content:t.content,explanation:t.explanation,offset:t.offset},a=e.map(d=>at(t.variants[d])),l=new Set(a.flatMap(d=>Object.keys(d))),s={},u=(d,p)=>{const h=p==="color"?"":p==="background-color"?"-bg":`-${p}`;return r+e[d]+(p==="color"?"":h)};return a.forEach((d,p)=>{for(const h of l){const g=d[h]||"inherit";if(p===0&&n&&Qa.includes(h))if(n===sr&&a.length>1){const m=e.findIndex(x=>x==="light"),y=e.findIndex(x=>x==="dark");if(m===-1||y===-1)throw new C('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');const k=a[m][h]||"inherit",v=a[y][h]||"inherit";s[h]=`light-dark(${k}, ${v})`,i==="css-vars"&&(s[u(p,h)]=g)}else s[h]=g;else i==="css-vars"&&(s[u(p,h)]=g)}}),o.htmlStyle=s,o}function at(t){const e={};if(t.color&&(e.color=t.color),t.bgColor&&(e["background-color"]=t.bgColor),t.fontStyle){t.fontStyle&z.Italic&&(e["font-style"]="italic"),t.fontStyle&z.Bold&&(e["font-weight"]="bold");const r=[];t.fontStyle&z.Underline&&r.push("underline"),t.fontStyle&z.Strikethrough&&r.push("line-through"),r.length&&(e["text-decoration"]=r.join(" "))}return e}function Ft(t){return typeof t=="string"?t:Object.entries(t).map(([e,r])=>`${e}:${r}`).join(";")}const Vn=new WeakMap;function mt(t,e){Vn.set(t,e)}function ze(t){return Vn.get(t)}class Re{_stacks={};lang;get themes(){return Object.keys(this._stacks)}get theme(){return this.themes[0]}get _stack(){return this._stacks[this.theme]}static initial(e,r){return new Re(Object.fromEntries(Wa(r).map(n=>[n,Mt])),e)}constructor(...e){if(e.length===2){const[r,n]=e;this.lang=n,this._stacks=r}else{const[r,n,i]=e;this.lang=n,this._stacks={[i]:r}}}getInternalStack(e=this.theme){return this._stacks[e]}getScopes(e=this.theme){return Ja(this._stacks[e])}toJSON(){return{lang:this.lang,theme:this.theme,themes:this.themes,scopes:this.getScopes()}}}function Ja(t){const e=[],r=new Set;function n(i){if(r.has(i))return;r.add(i);const o=i?.nameScopesList?.scopeName;o&&e.push(o),i.parent&&n(i.parent)}return n(t),e}function es(t,e){if(!(t instanceof Re))throw new C("Invalid grammar state");return t.getInternalStack(e)}function ts(){const t=new WeakMap;function e(r){if(!t.has(r.meta)){let n=function(a){if(typeof a=="number"){if(a<0||a>r.source.length)throw new C(`Invalid decoration offset: ${a}. Code length: ${r.source.length}`);return{...i.indexToPos(a),offset:a}}else{const l=i.lines[a.line];if(l===void 0)throw new C(`Invalid decoration position ${JSON.stringify(a)}. Lines length: ${i.lines.length}`);let s=a.character;if(s<0&&(s=l.length+s),s<0||s>l.length)throw new C(`Invalid decoration position ${JSON.stringify(a)}. Line ${a.line} length: ${l.length}`);return{...a,character:s,offset:i.posToIndex(a.line,s)}}};const i=Ka(r.source),o=(r.options.decorations||[]).map(a=>({...a,start:n(a.start),end:n(a.end)}));rs(o),t.set(r.meta,{decorations:o,converter:i,source:r.source})}return t.get(r.meta)}return{name:"shiki:decorations",tokens(r){if(!this.options.decorations?.length)return;const i=e(this).decorations.flatMap(a=>[a.start.offset,a.end.offset]);return Ya(r,i)},code(r){if(!this.options.decorations?.length)return;const n=e(this),i=Array.from(r.children).filter(d=>d.type==="element"&&d.tagName==="span");if(i.length!==n.converter.lines.length)throw new C(`Number of lines in code element (${i.length}) does not match the number of lines in the source (${n.converter.lines.length}). Failed to apply decorations.`);function o(d,p,h,g){const m=i[d];let y="",k=-1,v=-1;if(p===0&&(k=0),h===0&&(v=0),h===Number.POSITIVE_INFINITY&&(v=m.children.length),k===-1||v===-1)for(let _=0;_<m.children.length;_++)y+=zn(m.children[_]),k===-1&&y.length===p&&(k=_+1),v===-1&&y.length===h&&(v=_+1);if(k===-1)throw new C(`Failed to find start index for decoration ${JSON.stringify(g.start)}`);if(v===-1)throw new C(`Failed to find end index for decoration ${JSON.stringify(g.end)}`);const x=m.children.slice(k,v);if(!g.alwaysWrap&&x.length===m.children.length)l(m,g,"line");else if(!g.alwaysWrap&&x.length===1&&x[0].type==="element")l(x[0],g,"token");else{const _={type:"element",tagName:"span",properties:{},children:x};l(_,g,"wrapper"),m.children.splice(k,x.length,_)}}function a(d,p){i[d]=l(i[d],p,"line")}function l(d,p,h){const g=p.properties||{},m=p.transform||(y=>y);return d.tagName=p.tagName||"span",d.properties={...d.properties,...g,class:d.properties.class},p.properties?.class&&Nn(d,p.properties.class),d=m(d,h)||d,d}const s=[],u=n.decorations.sort((d,p)=>p.start.offset-d.start.offset||d.end.offset-p.end.offset);for(const d of u){const{start:p,end:h}=d;if(p.line===h.line)o(p.line,p.character,h.character,d);else if(p.line<h.line){o(p.line,p.character,Number.POSITIVE_INFINITY,d);for(let g=p.line+1;g<h.line;g++)s.unshift(()=>a(g,d));o(h.line,0,h.character,d)}}s.forEach(d=>d())}}}function rs(t){for(let e=0;e<t.length;e++){const r=t[e];if(r.start.offset>r.end.offset)throw new C(`Invalid decoration range: ${JSON.stringify(r.start)} - ${JSON.stringify(r.end)}`);for(let n=e+1;n<t.length;n++){const i=t[n],o=r.start.offset<=i.start.offset&&i.start.offset<r.end.offset,a=r.start.offset<i.end.offset&&i.end.offset<=r.end.offset,l=i.start.offset<=r.start.offset&&r.start.offset<i.end.offset,s=i.start.offset<r.end.offset&&r.end.offset<=i.end.offset;if(o||a||l||s){if(o&&a||l&&s||l&&r.start.offset===r.end.offset||a&&i.start.offset===i.end.offset)continue;throw new C(`Decorations ${JSON.stringify(r.start)} and ${JSON.stringify(i.start)} intersect.`)}}}}function zn(t){return t.type==="text"?t.value:t.type==="element"?t.children.map(zn).join(""):""}const ns=[ts()];function st(t){const e=is(t.transformers||[]);return[...e.pre,...e.normal,...e.post,...ns]}function is(t){const e=[],r=[],n=[];for(const i of t)switch(i.enforce){case"pre":e.push(i);break;case"post":r.push(i);break;default:n.push(i)}return{pre:e,post:r,normal:n}}var se=["black","red","green","yellow","blue","magenta","cyan","white","brightBlack","brightRed","brightGreen","brightYellow","brightBlue","brightMagenta","brightCyan","brightWhite"],Pt={1:"bold",2:"dim",3:"italic",4:"underline",7:"reverse",8:"hidden",9:"strikethrough"};function os(t,e){const r=t.indexOf("\x1B",e);if(r!==-1&&t[r+1]==="["){const n=t.indexOf("m",r);if(n!==-1)return{sequence:t.substring(r+2,n).split(";"),startPosition:r,position:n+1}}return{position:t.length}}function Vr(t){const e=t.shift();if(e==="2"){const r=t.splice(0,3).map(n=>Number.parseInt(n));return r.length!==3||r.some(n=>Number.isNaN(n))?void 0:{type:"rgb",rgb:r}}else if(e==="5"){const r=t.shift();if(r)return{type:"table",index:Number(r)}}}function as(t){const e=[];for(;t.length>0;){const r=t.shift();if(!r)continue;const n=Number.parseInt(r);if(!Number.isNaN(n))if(n===0)e.push({type:"resetAll"});else if(n<=9)Pt[n]&&e.push({type:"setDecoration",value:Pt[n]});else if(n<=29){const i=Pt[n-20];i&&(e.push({type:"resetDecoration",value:i}),i==="dim"&&e.push({type:"resetDecoration",value:"bold"}))}else if(n<=37)e.push({type:"setForegroundColor",value:{type:"named",name:se[n-30]}});else if(n===38){const i=Vr(t);i&&e.push({type:"setForegroundColor",value:i})}else if(n===39)e.push({type:"resetForegroundColor"});else if(n<=47)e.push({type:"setBackgroundColor",value:{type:"named",name:se[n-40]}});else if(n===48){const i=Vr(t);i&&e.push({type:"setBackgroundColor",value:i})}else n===49?e.push({type:"resetBackgroundColor"}):n===53?e.push({type:"setDecoration",value:"overline"}):n===55?e.push({type:"resetDecoration",value:"overline"}):n>=90&&n<=97?e.push({type:"setForegroundColor",value:{type:"named",name:se[n-90+8]}}):n>=100&&n<=107&&e.push({type:"setBackgroundColor",value:{type:"named",name:se[n-100+8]}})}return e}function ss(){let t=null,e=null,r=new Set;return{parse(n){const i=[];let o=0;do{const a=os(n,o),l=a.sequence?n.substring(o,a.startPosition):n.substring(o);if(l.length>0&&i.push({value:l,foreground:t,background:e,decorations:new Set(r)}),a.sequence){const s=as(a.sequence);for(const u of s)u.type==="resetAll"?(t=null,e=null,r.clear()):u.type==="resetForegroundColor"?t=null:u.type==="resetBackgroundColor"?e=null:u.type==="resetDecoration"&&r.delete(u.value);for(const u of s)u.type==="setForegroundColor"?t=u.value:u.type==="setBackgroundColor"?e=u.value:u.type==="setDecoration"&&r.add(u.value)}o=a.position}while(o<n.length);return i}}}var ls={black:"#000000",red:"#bb0000",green:"#00bb00",yellow:"#bbbb00",blue:"#0000bb",magenta:"#ff00ff",cyan:"#00bbbb",white:"#eeeeee",brightBlack:"#555555",brightRed:"#ff5555",brightGreen:"#00ff00",brightYellow:"#ffff55",brightBlue:"#5555ff",brightMagenta:"#ff55ff",brightCyan:"#55ffff",brightWhite:"#ffffff"};function cs(t=ls){function e(l){return t[l]}function r(l){return`#${l.map(s=>Math.max(0,Math.min(s,255)).toString(16).padStart(2,"0")).join("")}`}let n;function i(){if(n)return n;n=[];for(let u=0;u<se.length;u++)n.push(e(se[u]));let l=[0,95,135,175,215,255];for(let u=0;u<6;u++)for(let d=0;d<6;d++)for(let p=0;p<6;p++)n.push(r([l[u],l[d],l[p]]));let s=8;for(let u=0;u<24;u++,s+=10)n.push(r([s,s,s]));return n}function o(l){return i()[l]}function a(l){switch(l.type){case"named":return e(l.name);case"rgb":return r(l.rgb);case"table":return o(l.index)}}return{value:a}}const us={black:"#000000",red:"#cd3131",green:"#0DBC79",yellow:"#E5E510",blue:"#2472C8",magenta:"#BC3FBC",cyan:"#11A8CD",white:"#E5E5E5",brightBlack:"#666666",brightRed:"#F14C4C",brightGreen:"#23D18B",brightYellow:"#F5F543",brightBlue:"#3B8EEA",brightMagenta:"#D670D6",brightCyan:"#29B8DB",brightWhite:"#FFFFFF"};function ds(t,e,r){const n=ot(t,r),i=gt(e),o=Object.fromEntries(se.map(s=>{const u=`terminal.ansi${s[0].toUpperCase()}${s.substring(1)}`,d=t.colors?.[u];return[s,d||us[s]]})),a=cs(o),l=ss();return i.map(s=>l.parse(s[0]).map(u=>{let d,p;u.decorations.has("reverse")?(d=u.background?a.value(u.background):t.bg,p=u.foreground?a.value(u.foreground):t.fg):(d=u.foreground?a.value(u.foreground):t.fg,p=u.background?a.value(u.background):void 0),d=ie(d,n),p=ie(p,n),u.decorations.has("dim")&&(d=ps(d));let h=z.None;return u.decorations.has("bold")&&(h|=z.Bold),u.decorations.has("italic")&&(h|=z.Italic),u.decorations.has("underline")&&(h|=z.Underline),u.decorations.has("strikethrough")&&(h|=z.Strikethrough),{content:u.value,offset:s[1],color:d,bgColor:p,fontStyle:h}}))}function ps(t){const e=t.match(/#([0-9a-f]{3,8})/i);if(e){const n=e[1];if(n.length===8){const i=Math.round(Number.parseInt(n.slice(6,8),16)/2).toString(16).padStart(2,"0");return`#${n.slice(0,6)}${i}`}else{if(n.length===6)return`#${n}80`;if(n.length===4){const i=n[0],o=n[1],a=n[2],l=n[3],s=Math.round(Number.parseInt(`${l}${l}`,16)/2).toString(16).padStart(2,"0");return`#${i}${i}${o}${o}${a}${a}${s}`}else if(n.length===3){const i=n[0],o=n[1],a=n[2];return`#${i}${i}${o}${o}${a}${a}80`}}}const r=t.match(/var\((--[\w-]+-ansi-[\w-]+)\)/);return r?`var(${r[1]}-dim)`:t}function lr(t,e,r={}){const{theme:n=t.getLoadedThemes()[0]}=r,i=t.resolveLangAlias(r.lang||"text");if(or(i)||ar(n))return gt(e).map(s=>[{content:s[0],offset:s[1]}]);const{theme:o,colorMap:a}=t.setTheme(n);if(i==="ansi")return ds(o,e,r);const l=t.getLanguage(r.lang||"text");if(r.grammarState){if(r.grammarState.lang!==l.name)throw new C(`Grammar state language "${r.grammarState.lang}" does not match highlight language "${l.name}"`);if(!r.grammarState.themes.includes(o.name))throw new C(`Grammar state themes "${r.grammarState.themes}" do not contain highlight theme "${o.name}"`)}return gs(e,l,o,a,r)}function hs(...t){if(t.length===2)return ze(t[1]);const[e,r,n={}]=t,{lang:i="text",theme:o=e.getLoadedThemes()[0]}=n;if(or(i)||ar(o))throw new C("Plain language does not have grammar state");if(i==="ansi")throw new C("ANSI language does not have grammar state");const{theme:a,colorMap:l}=e.setTheme(o),s=e.getLanguage(i);return new Re(cr(r,s,a,l,n).stateStack,s.name,a.name)}function gs(t,e,r,n,i){const o=cr(t,e,r,n,i),a=new Re(o.stateStack,e.name,r.name);return mt(o.tokens,a),o.tokens}function cr(t,e,r,n,i){const o=ot(r,i),{tokenizeMaxLineLength:a=0,tokenizeTimeLimit:l=500}=i,s=gt(t);let u=i.grammarState?es(i.grammarState,r.name)??Mt:i.grammarContextCode!=null?cr(i.grammarContextCode,e,r,n,{...i,grammarState:void 0,grammarContextCode:void 0}).stateStack:Mt,d=[];const p=[];for(let h=0,g=s.length;h<g;h++){const[m,y]=s[h];if(m===""){d=[],p.push([]);continue}if(a>0&&m.length>=a){d=[],p.push([{content:m,offset:y,color:"",fontStyle:0}]);continue}let k,v,x;i.includeExplanation&&(k=e.tokenizeLine(m,u,l),v=k.tokens,x=0);const _=e.tokenizeLine2(m,u,l),E=_.tokens.length/2;for(let T=0;T<E;T++){const N=_.tokens[2*T],U=T+1<E?_.tokens[2*T+2]:m.length;if(N===U)continue;const pr=_.tokens[2*T+1],qn=ie(n[ke.getForeground(pr)],o),Wn=ke.getFontStyle(pr),vt={content:m.substring(N,U),offset:y+N,color:qn,fontStyle:Wn};if(i.includeExplanation){const hr=[];if(i.includeExplanation!=="scopeName")for(const ee of r.settings){let _e;switch(typeof ee.scope){case"string":_e=ee.scope.split(/,/).map(bt=>bt.trim());break;case"object":_e=ee.scope;break;default:continue}hr.push({settings:ee,selectors:_e.map(bt=>bt.split(/ /))})}vt.explanation=[];let gr=0;for(;N+gr<U;){const ee=v[x],_e=m.substring(ee.startIndex,ee.endIndex);gr+=_e.length,vt.explanation.push({content:_e,scopes:i.includeExplanation==="scopeName"?ms(ee.scopes):fs(hr,ee.scopes)}),x+=1}}d.push(vt)}p.push(d),d=[],u=_.ruleStack}return{tokens:p,stateStack:u}}function ms(t){return t.map(e=>({scopeName:e}))}function fs(t,e){const r=[];for(let n=0,i=e.length;n<i;n++){const o=e[n];r[n]={scopeName:o,themeMatches:vs(t,o,e.slice(0,n))}}return r}function zr(t,e){return t===e||e.substring(0,t.length)===t&&e[t.length]==="."}function _s(t,e,r){if(!zr(t[t.length-1],e))return!1;let n=t.length-2,i=r.length-1;for(;n>=0&&i>=0;)zr(t[n],r[i])&&(n-=1),i-=1;return n===-1}function vs(t,e,r){const n=[];for(const{selectors:i,settings:o}of t)for(const a of i)if(_s(a,e,r)){n.push(o);break}return n}function Mn(t,e,r){const n=Object.entries(r.themes).filter(s=>s[1]).map(s=>({color:s[0],theme:s[1]})),i=n.map(s=>{const u=lr(t,e,{...r,theme:s.theme}),d=ze(u),p=typeof s.theme=="string"?s.theme:s.theme.name;return{tokens:u,state:d,theme:p}}),o=bs(...i.map(s=>s.tokens)),a=o[0].map((s,u)=>s.map((d,p)=>{const h={content:d.content,variants:{},offset:d.offset};return"includeExplanation"in r&&r.includeExplanation&&(h.explanation=d.explanation),o.forEach((g,m)=>{const{content:y,explanation:k,offset:v,...x}=g[u][p];h.variants[n[m].color]=x}),h})),l=i[0].state?new Re(Object.fromEntries(i.map(s=>[s.theme,s.state?.getInternalStack(s.theme)])),i[0].state.lang):void 0;return l&&mt(a,l),a}function bs(...t){const e=t.map(()=>[]),r=t.length;for(let n=0;n<t[0].length;n++){const i=t.map(s=>s[n]),o=e.map(()=>[]);e.forEach((s,u)=>s.push(o[u]));const a=i.map(()=>0),l=i.map(s=>s[0]);for(;l.every(s=>s);){const s=Math.min(...l.map(u=>u.content.length));for(let u=0;u<r;u++){const d=l[u];d.content.length===s?(o[u].push(d),a[u]+=1,l[u]=i[u][a[u]]):(o[u].push({...d,content:d.content.slice(0,s)}),l[u]={...d,content:d.content.slice(s),offset:d.offset+s})}}}return e}function lt(t,e,r){let n,i,o,a,l,s;if("themes"in r){const{defaultColor:u="light",cssVariablePrefix:d="--shiki-",colorsRendering:p="css-vars"}=r,h=Object.entries(r.themes).filter(v=>v[1]).map(v=>({color:v[0],theme:v[1]})).sort((v,x)=>v.color===u?-1:x.color===u?1:0);if(h.length===0)throw new C("`themes` option must not be empty");const g=Mn(t,e,r);if(s=ze(g),u&&sr!==u&&!h.find(v=>v.color===u))throw new C(`\`themes\` option must contain the defaultColor key \`${u}\``);const m=h.map(v=>t.getTheme(v.theme)),y=h.map(v=>v.color);o=g.map(v=>v.map(x=>Za(x,y,d,u,p))),s&&mt(o,s);const k=h.map(v=>ot(v.theme,r));i=Mr(h,m,k,d,u,"fg",p),n=Mr(h,m,k,d,u,"bg",p),a=`shiki-themes ${m.map(v=>v.name).join(" ")}`,l=u?void 0:[i,n].join(";")}else if("theme"in r){const u=ot(r.theme,r);o=lr(t,e,r);const d=t.getTheme(r.theme);n=ie(d.bg,u),i=ie(d.fg,u),a=d.name,s=ze(o)}else throw new C("Invalid options, either `theme` or `themes` must be provided");return{tokens:o,fg:i,bg:n,themeName:a,rootStyle:l,grammarState:s}}function Mr(t,e,r,n,i,o,a){return t.map((l,s)=>{const u=ie(e[s][o],r[s])||"inherit",d=`${n+l.color}${o==="bg"?"-bg":""}:${u}`;if(s===0&&i){if(i===sr&&t.length>1){const p=t.findIndex(y=>y.color==="light"),h=t.findIndex(y=>y.color==="dark");if(p===-1||h===-1)throw new C('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');const g=ie(e[p][o],r[p])||"inherit",m=ie(e[h][o],r[h])||"inherit";return`light-dark(${g}, ${m});${d}`}return u}return a==="css-vars"?d:null}).filter(l=>!!l).join(";")}function ct(t,e,r,n={meta:{},options:r,codeToHast:(i,o)=>ct(t,i,o),codeToTokens:(i,o)=>lt(t,i,o)}){let i=e;for(const m of st(r))i=m.preprocess?.call(n,i,r)||i;let{tokens:o,fg:a,bg:l,themeName:s,rootStyle:u,grammarState:d}=lt(t,i,r);const{mergeWhitespaces:p=!0,mergeSameStyleTokens:h=!1}=r;p===!0?o=xs(o):p==="never"&&(o=ks(o)),h&&(o=ws(o));const g={...n,get source(){return i}};for(const m of st(r))o=m.tokens?.call(g,o)||o;return ys(o,{...r,fg:a,bg:l,themeName:s,rootStyle:r.rootStyle===!1?!1:r.rootStyle??u},g,d)}function ys(t,e,r,n=ze(t)){const i=st(e),o=[],a={type:"root",children:[]},{structure:l="classic",tabindex:s="0"}=e,u={class:`shiki ${e.themeName||""}`};e.rootStyle!==!1&&(e.rootStyle!=null?u.style=e.rootStyle:u.style=`background-color:${e.bg};color:${e.fg}`),s!==!1&&s!=null&&(u.tabindex=s.toString());for(const[y,k]of Object.entries(e.meta||{}))y.startsWith("_")||(u[y]=k);let d={type:"element",tagName:"pre",properties:u,children:[],data:e.data},p={type:"element",tagName:"code",properties:{},children:o};const h=[],g={...r,structure:l,addClassToHast:Nn,get source(){return r.source},get tokens(){return t},get options(){return e},get root(){return a},get pre(){return d},get code(){return p},get lines(){return h}};if(t.forEach((y,k)=>{k&&(l==="inline"?a.children.push({type:"element",tagName:"br",properties:{},children:[]}):l==="classic"&&o.push({type:"text",value:`
`}));let v={type:"element",tagName:"span",properties:{class:"line"},children:[]},x=0;for(const _ of y){let E={type:"element",tagName:"span",properties:{..._.htmlAttrs},children:[{type:"text",value:_.content}]};const T=Ft(_.htmlStyle||at(_));T&&(E.properties.style=T);for(const N of i)E=N?.span?.call(g,E,k+1,x,v,_)||E;l==="inline"?a.children.push(E):l==="classic"&&v.children.push(E),x+=_.content.length}if(l==="classic"){for(const _ of i)v=_?.line?.call(g,v,k+1)||v;h.push(v),o.push(v)}else l==="inline"&&h.push(v)}),l==="classic"){for(const y of i)p=y?.code?.call(g,p)||p;d.children.push(p);for(const y of i)d=y?.pre?.call(g,d)||d;a.children.push(d)}else if(l==="inline"){const y=[];let k={type:"element",tagName:"span",properties:{class:"line"},children:[]};for(const _ of a.children)_.type==="element"&&_.tagName==="br"?(y.push(k),k={type:"element",tagName:"span",properties:{class:"line"},children:[]}):(_.type==="element"||_.type==="text")&&k.children.push(_);y.push(k);let x={type:"element",tagName:"code",properties:{},children:y};for(const _ of i)x=_?.code?.call(g,x)||x;a.children=[];for(let _=0;_<x.children.length;_++){_>0&&a.children.push({type:"element",tagName:"br",properties:{},children:[]});const E=x.children[_];E.type==="element"&&a.children.push(...E.children)}}let m=a;for(const y of i)m=y?.root?.call(g,m)||m;return n&&mt(m,n),m}function xs(t){return t.map(e=>{const r=[];let n="",i;return e.forEach((o,a)=>{const s=!(o.fontStyle&&(o.fontStyle&z.Underline||o.fontStyle&z.Strikethrough));s&&o.content.match(/^\s+$/)&&e[a+1]?(i===void 0&&(i=o.offset),n+=o.content):n?(s?r.push({...o,offset:i,content:n+o.content}):r.push({content:n,offset:i},o),i=void 0,n=""):r.push(o)}),r})}function ks(t){return t.map(e=>e.flatMap(r=>{if(r.content.match(/^\s+$/))return r;const n=r.content.match(/^(\s*)(.*?)(\s*)$/);if(!n)return r;const[,i,o,a]=n;if(!i&&!a)return r;const l=[{...r,offset:r.offset+i.length,content:o}];return i&&l.unshift({content:i,offset:r.offset}),a&&l.push({content:a,offset:r.offset+i.length+o.length}),l}))}function ws(t){return t.map(e=>{const r=[];for(const n of e){if(r.length===0){r.push({...n});continue}const i=r[r.length-1],o=Ft(i.htmlStyle||at(i)),a=Ft(n.htmlStyle||at(n)),l=i.fontStyle&&(i.fontStyle&z.Underline||i.fontStyle&z.Strikethrough),s=n.fontStyle&&(n.fontStyle&z.Underline||n.fontStyle&z.Strikethrough);!l&&!s&&o===a?i.content+=n.content:r.push({...n})}return r})}const Es=Fa;function Rs(t,e,r){const n={meta:{},options:r,codeToHast:(o,a)=>ct(t,o,a),codeToTokens:(o,a)=>lt(t,o,a)};let i=Es(ct(t,e,r,n));for(const o of st(r))i=o.postprocess?.call(n,i,r)||i;return i}const Br={light:"#333333",dark:"#bbbbbb"},jr={light:"#fffffe",dark:"#1e1e1e"},Gr="__shiki_resolved";function ur(t){if(t?.[Gr])return t;const e={...t};e.tokenColors&&!e.settings&&(e.settings=e.tokenColors,delete e.tokenColors),e.type||="dark",e.colorReplacements={...e.colorReplacements},e.settings||=[];let{bg:r,fg:n}=e;if(!r||!n){const l=e.settings?e.settings.find(s=>!s.name&&!s.scope):void 0;l?.settings?.foreground&&(n=l.settings.foreground),l?.settings?.background&&(r=l.settings.background),!n&&e?.colors?.["editor.foreground"]&&(n=e.colors["editor.foreground"]),!r&&e?.colors?.["editor.background"]&&(r=e.colors["editor.background"]),n||(n=e.type==="light"?Br.light:Br.dark),r||(r=e.type==="light"?jr.light:jr.dark),e.fg=n,e.bg=r}e.settings[0]&&e.settings[0].settings&&!e.settings[0].scope||e.settings.unshift({settings:{foreground:e.fg,background:e.bg}});let i=0;const o=new Map;function a(l){if(o.has(l))return o.get(l);i+=1;const s=`#${i.toString(16).padStart(8,"0").toLowerCase()}`;return e.colorReplacements?.[`#${s}`]?a(l):(o.set(l,s),s)}e.settings=e.settings.map(l=>{const s=l.settings?.foreground&&!l.settings.foreground.startsWith("#"),u=l.settings?.background&&!l.settings.background.startsWith("#");if(!s&&!u)return l;const d={...l,settings:{...l.settings}};if(s){const p=a(l.settings.foreground);e.colorReplacements[p]=l.settings.foreground,d.settings.foreground=p}if(u){const p=a(l.settings.background);e.colorReplacements[p]=l.settings.background,d.settings.background=p}return d});for(const l of Object.keys(e.colors||{}))if((l==="editor.foreground"||l==="editor.background"||l.startsWith("terminal.ansi"))&&!e.colors[l]?.startsWith("#")){const s=a(e.colors[l]);e.colorReplacements[s]=e.colors[l],e.colors[l]=s}return Object.defineProperty(e,Gr,{enumerable:!1,writable:!1,value:!0}),e}async function Bn(t){return Array.from(new Set((await Promise.all(t.filter(e=>!Dn(e)).map(async e=>await On(e).then(r=>Array.isArray(r)?r:[r])))).flat()))}async function jn(t){return(await Promise.all(t.map(async r=>$n(r)?null:ur(await On(r))))).filter(r=>!!r)}let Ps=3;function Ss(t,e=3){e>Ps||console.trace(`[SHIKI DEPRECATE]: ${t}`)}let be=class extends Error{constructor(e){super(e),this.name="ShikiError"}};function Gn(t,e){if(!e)return t;if(e[t]){const r=new Set([t]);for(;e[t];){if(t=e[t],r.has(t))throw new be(`Circular alias \`${Array.from(r).join(" -> ")} -> ${t}\``);r.add(t)}}return t}class Ts extends Lo{constructor(e,r,n,i={}){super(e),this._resolver=e,this._themes=r,this._langs=n,this._alias=i,this._themes.map(o=>this.loadTheme(o)),this.loadLanguages(this._langs)}_resolvedThemes=new Map;_resolvedGrammars=new Map;_langMap=new Map;_langGraph=new Map;_textmateThemeCache=new WeakMap;_loadedThemesCache=null;_loadedLanguagesCache=null;getTheme(e){return typeof e=="string"?this._resolvedThemes.get(e):this.loadTheme(e)}loadTheme(e){const r=ur(e);return r.name&&(this._resolvedThemes.set(r.name,r),this._loadedThemesCache=null),r}getLoadedThemes(){return this._loadedThemesCache||(this._loadedThemesCache=[...this._resolvedThemes.keys()]),this._loadedThemesCache}setTheme(e){let r=this._textmateThemeCache.get(e);r||(r=et.createFromRawTheme(e),this._textmateThemeCache.set(e,r)),this._syncRegistry.setTheme(r)}getGrammar(e){return e=Gn(e,this._alias),this._resolvedGrammars.get(e)}loadLanguage(e){if(this.getGrammar(e.name))return;const r=new Set([...this._langMap.values()].filter(o=>o.embeddedLangsLazy?.includes(e.name)));this._resolver.addLanguage(e);const n={balancedBracketSelectors:e.balancedBracketSelectors||["*"],unbalancedBracketSelectors:e.unbalancedBracketSelectors||[]};this._syncRegistry._rawGrammars.set(e.scopeName,e);const i=this.loadGrammarWithConfiguration(e.scopeName,1,n);if(i.name=e.name,this._resolvedGrammars.set(e.name,i),e.aliases&&e.aliases.forEach(o=>{this._alias[o]=e.name}),this._loadedLanguagesCache=null,r.size)for(const o of r)this._resolvedGrammars.delete(o.name),this._loadedLanguagesCache=null,this._syncRegistry?._injectionGrammars?.delete(o.scopeName),this._syncRegistry?._grammars?.delete(o.scopeName),this.loadLanguage(this._langMap.get(o.name))}dispose(){super.dispose(),this._resolvedThemes.clear(),this._resolvedGrammars.clear(),this._langMap.clear(),this._langGraph.clear(),this._loadedThemesCache=null}loadLanguages(e){for(const i of e)this.resolveEmbeddedLanguages(i);const r=Array.from(this._langGraph.entries()),n=r.filter(([i,o])=>!o);if(n.length){const i=r.filter(([o,a])=>a?(a.embeddedLanguages||a.embeddedLangs)?.some(s=>n.map(([u])=>u).includes(s)):!1).filter(o=>!n.includes(o));throw new be(`Missing languages ${n.map(([o])=>`\`${o}\``).join(", ")}, required by ${i.map(([o])=>`\`${o}\``).join(", ")}`)}for(const[i,o]of r)this._resolver.addLanguage(o);for(const[i,o]of r)this.loadLanguage(o)}getLoadedLanguages(){return this._loadedLanguagesCache||(this._loadedLanguagesCache=[...new Set([...this._resolvedGrammars.keys(),...Object.keys(this._alias)])]),this._loadedLanguagesCache}resolveEmbeddedLanguages(e){this._langMap.set(e.name,e),this._langGraph.set(e.name,e);const r=e.embeddedLanguages??e.embeddedLangs;if(r)for(const n of r)this._langGraph.set(n,this._langMap.get(n))}}class As{_langs=new Map;_scopeToLang=new Map;_injections=new Map;_onigLib;constructor(e,r){this._onigLib={createOnigScanner:n=>e.createScanner(n),createOnigString:n=>e.createString(n)},r.forEach(n=>this.addLanguage(n))}get onigLib(){return this._onigLib}getLangRegistration(e){return this._langs.get(e)}loadGrammar(e){return this._scopeToLang.get(e)}addLanguage(e){this._langs.set(e.name,e),e.aliases&&e.aliases.forEach(r=>{this._langs.set(r,e)}),this._scopeToLang.set(e.scopeName,e),e.injectTo&&e.injectTo.forEach(r=>{this._injections.get(r)||this._injections.set(r,[]),this._injections.get(r).push(e.scopeName)})}getInjections(e){const r=e.split(".");let n=[];for(let i=1;i<=r.length;i++){const o=r.slice(0,i).join(".");n=[...n,...this._injections.get(o)||[]]}return n}}let Te=0;function Ls(t){Te+=1,t.warnings!==!1&&Te>=10&&Te%10===0&&console.warn(`[Shiki] ${Te} instances have been created. Shiki is supposed to be used as a singleton, consider refactoring your code to cache your highlighter instance; Or call \`highlighter.dispose()\` to release unused instances.`);let e=!1;if(!t.engine)throw new be("`engine` option is required for synchronous mode");const r=(t.langs||[]).flat(1),n=(t.themes||[]).flat(1).map(ur),i=new As(t.engine,r),o=new Ts(i,n,r,t.langAlias);let a;function l(_){return Gn(_,t.langAlias)}function s(_){v();const E=o.getGrammar(typeof _=="string"?_:_.name);if(!E)throw new be(`Language \`${_}\` not found, you may need to load it first`);return E}function u(_){if(_==="none")return{bg:"",fg:"",name:"none",settings:[],type:"dark"};v();const E=o.getTheme(_);if(!E)throw new be(`Theme \`${_}\` not found, you may need to load it first`);return E}function d(_){v();const E=u(_);a!==_&&(o.setTheme(E),a=_);const T=o.getColorMap();return{theme:E,colorMap:T}}function p(){return v(),o.getLoadedThemes()}function h(){return v(),o.getLoadedLanguages()}function g(..._){v(),o.loadLanguages(_.flat(1))}async function m(..._){return g(await Bn(_))}function y(..._){v();for(const E of _.flat(1))o.loadTheme(E)}async function k(..._){return v(),y(await jn(_))}function v(){if(e)throw new be("Shiki instance has been disposed")}function x(){e||(e=!0,o.dispose(),Te-=1)}return{setTheme:d,getTheme:u,getLanguage:s,getLoadedThemes:p,getLoadedLanguages:h,resolveLangAlias:l,loadLanguage:m,loadLanguageSync:g,loadTheme:k,loadThemeSync:y,dispose:x,[Symbol.dispose]:x}}async function Is(t){t.engine||Ss("`engine` option is required. Use `createOnigurumaEngine` or `createJavaScriptRegexEngine` to create an engine.");const[e,r,n]=await Promise.all([jn(t.themes||[]),Bn(t.langs||[]),t.engine]);return Ls({...t,themes:e,langs:r,engine:n})}async function Cs(t){const e=await Is(t);return{getLastGrammarState:(...r)=>hs(e,...r),codeToTokensBase:(r,n)=>lr(e,r,n),codeToTokensWithThemes:(r,n)=>Mn(e,r,n),codeToTokens:(r,n)=>lt(e,r,n),codeToHast:(r,n)=>ct(e,r,n),codeToHtml:(r,n)=>Rs(e,r,n),getBundledLanguages:()=>({}),getBundledThemes:()=>({}),...e,getInternalContext:()=>e}}function Os(t){const e=t.langs,r=t.themes,n=t.engine;async function i(o){function a(p){if(typeof p=="string"){if(p=o.langAlias?.[p]||p,Dn(p))return[];const h=e[p];if(!h)throw new C(`Language \`${p}\` is not included in this bundle. You may want to load it from external source.`);return h}return p}function l(p){if($n(p))return"none";if(typeof p=="string"){const h=r[p];if(!h)throw new C(`Theme \`${p}\` is not included in this bundle. You may want to load it from external source.`);return h}return p}const s=(o.themes??[]).map(p=>l(p)),u=(o.langs??[]).map(p=>a(p)),d=await Cs({engine:o.engine??n(),...o,themes:s,langs:u});return{...d,loadLanguage(...p){return d.loadLanguage(...p.map(a))},loadTheme(...p){return d.loadTheme(...p.map(l))},getBundledLanguages(){return e},getBundledThemes(){return r}}}return i}const Un=[{id:"abap",name:"ABAP",import:(()=>c(()=>import("./abap-BdImnpbu.js"),[]))},{id:"actionscript-3",name:"ActionScript",import:(()=>c(()=>import("./actionscript-3-CoDkCxhg.js"),[]))},{id:"ada",name:"Ada",import:(()=>c(()=>import("./ada-bCR0ucgS.js"),[]))},{id:"angular-html",name:"Angular HTML",import:(()=>c(()=>import("./angular-html-CU67Zn6k.js").then(t=>t.f),__vite__mapDeps([0,1,2,3])))},{id:"angular-ts",name:"Angular TypeScript",import:(()=>c(()=>import("./angular-ts-BwZT4LLn.js"),__vite__mapDeps([4,0,1,2,3,5])))},{id:"apache",name:"Apache Conf",import:(()=>c(()=>import("./apache-Pmp26Uib.js"),[]))},{id:"apex",name:"Apex",import:(()=>c(()=>import("./apex-D8_7TLub.js"),[]))},{id:"apl",name:"APL",import:(()=>c(()=>import("./apl-dKokRX4l.js"),__vite__mapDeps([6,1,2,3,7,8,9])))},{id:"applescript",name:"AppleScript",import:(()=>c(()=>import("./applescript-Co6uUVPk.js"),[]))},{id:"ara",name:"Ara",import:(()=>c(()=>import("./ara-BRHolxvo.js"),[]))},{id:"asciidoc",name:"AsciiDoc",aliases:["adoc"],import:(()=>c(()=>import("./asciidoc-Dv7Oe6Be.js"),[]))},{id:"asm",name:"Assembly",import:(()=>c(()=>import("./asm-D_Q5rh1f.js"),[]))},{id:"astro",name:"Astro",import:(()=>c(()=>import("./astro-CbQHKStN.js"),__vite__mapDeps([10,9,2,11,3,12,13])))},{id:"awk",name:"AWK",import:(()=>c(()=>import("./awk-DMzUqQB5.js"),[]))},{id:"ballerina",name:"Ballerina",import:(()=>c(()=>import("./ballerina-BFfxhgS-.js"),[]))},{id:"bat",name:"Batch File",aliases:["batch"],import:(()=>c(()=>import("./bat-BkioyH1T.js"),[]))},{id:"beancount",name:"Beancount",import:(()=>c(()=>import("./beancount-k_qm7-4y.js"),[]))},{id:"berry",name:"Berry",aliases:["be"],import:(()=>c(()=>import("./berry-uYugtg8r.js"),[]))},{id:"bibtex",name:"BibTeX",import:(()=>c(()=>import("./bibtex-CHM0blh-.js"),[]))},{id:"bicep",name:"Bicep",import:(()=>c(()=>import("./bicep-Bmn6On1c.js"),[]))},{id:"blade",name:"Blade",import:(()=>c(()=>import("./blade-D4QpJJKB.js"),__vite__mapDeps([14,15,1,2,3,7,8,16,9])))},{id:"bsl",name:"1C (Enterprise)",aliases:["1c"],import:(()=>c(()=>import("./bsl-BO_Y6i37.js"),__vite__mapDeps([17,18])))},{id:"c",name:"C",import:(()=>c(()=>import("./c-BIGW1oBm.js"),[]))},{id:"c3",name:"C3",import:(()=>c(()=>import("./c3-VCDPK7BO.js"),[]))},{id:"cadence",name:"Cadence",aliases:["cdc"],import:(()=>c(()=>import("./cadence-Bv_4Rxtq.js"),[]))},{id:"cairo",name:"Cairo",import:(()=>c(()=>import("./cairo-KRGpt6FW.js"),__vite__mapDeps([19,20])))},{id:"clarity",name:"Clarity",import:(()=>c(()=>import("./clarity-D53aC0YG.js"),[]))},{id:"clojure",name:"Clojure",aliases:["clj"],import:(()=>c(()=>import("./clojure-P80f7IUj.js"),[]))},{id:"cmake",name:"CMake",import:(()=>c(()=>import("./cmake-D1j8_8rp.js"),[]))},{id:"cobol",name:"COBOL",import:(()=>c(()=>import("./cobol-nwyudZeR.js"),__vite__mapDeps([21,1,2,3,8])))},{id:"codeowners",name:"CODEOWNERS",import:(()=>c(()=>import("./codeowners-Bp6g37R7.js"),[]))},{id:"codeql",name:"CodeQL",aliases:["ql"],import:(()=>c(()=>import("./codeql-DsOJ9woJ.js"),[]))},{id:"coffee",name:"CoffeeScript",aliases:["coffeescript"],import:(()=>c(()=>import("./coffee-Ch7k5sss.js"),__vite__mapDeps([22,2])))},{id:"common-lisp",name:"Common Lisp",aliases:["lisp"],import:(()=>c(()=>import("./common-lisp-Cg-RD9OK.js"),[]))},{id:"coq",name:"Coq",import:(()=>c(()=>import("./coq-DkFqJrB1.js"),[]))},{id:"cpp",name:"C++",aliases:["c++"],import:(()=>c(()=>import("./cpp-CofmeUqb.js"),__vite__mapDeps([23,24,25,26,16])))},{id:"crystal",name:"Crystal",import:(()=>c(()=>import("./crystal-tKQVLTB8.js"),__vite__mapDeps([27,1,2,3,16,26,28])))},{id:"csharp",name:"C#",aliases:["c#","cs"],import:(()=>c(()=>import("./csharp-COcwbKMJ.js"),[]))},{id:"css",name:"CSS",import:(()=>c(()=>import("./css-DPfMkruS.js"),[]))},{id:"csv",name:"CSV",import:(()=>c(()=>import("./csv-fuZLfV_i.js"),[]))},{id:"cue",name:"CUE",import:(()=>c(()=>import("./cue-D82EKSYY.js"),[]))},{id:"cypher",name:"Cypher",aliases:["cql"],import:(()=>c(()=>import("./cypher-COkxafJQ.js"),[]))},{id:"d",name:"D",import:(()=>c(()=>import("./d-85-TOEBH.js"),[]))},{id:"dart",name:"Dart",import:(()=>c(()=>import("./dart-CF10PKvl.js"),[]))},{id:"dax",name:"DAX",import:(()=>c(()=>import("./dax-CEL-wOlO.js"),[]))},{id:"desktop",name:"Desktop",import:(()=>c(()=>import("./desktop-BmXAJ9_W.js"),[]))},{id:"diff",name:"Diff",import:(()=>c(()=>import("./diff-D97Zzqfu.js"),[]))},{id:"docker",name:"Dockerfile",aliases:["dockerfile"],import:(()=>c(()=>import("./docker-BcOcwvcX.js"),[]))},{id:"dotenv",name:"dotEnv",import:(()=>c(()=>import("./dotenv-Da5cRb03.js"),[]))},{id:"dream-maker",name:"Dream Maker",import:(()=>c(()=>import("./dream-maker-BtqSS_iP.js"),[]))},{id:"edge",name:"Edge",import:(()=>c(()=>import("./edge-BkV0erSs.js"),__vite__mapDeps([29,11,1,2,3,15])))},{id:"elixir",name:"Elixir",import:(()=>c(()=>import("./elixir-CDX3lj18.js"),__vite__mapDeps([30,1,2,3])))},{id:"elm",name:"Elm",import:(()=>c(()=>import("./elm-DbKCFpqz.js"),__vite__mapDeps([31,25,26])))},{id:"emacs-lisp",name:"Emacs Lisp",aliases:["elisp"],import:(()=>c(()=>import("./emacs-lisp-C9XAeP06.js"),[]))},{id:"erb",name:"ERB",import:(()=>c(()=>import("./erb-CgJxNhIT.js"),__vite__mapDeps([32,1,2,3,33,34,7,8,16,35,11,36,13,23,24,25,26,28,37,38])))},{id:"erlang",name:"Erlang",aliases:["erl"],import:(()=>c(()=>import("./erlang-DsQrWhSR.js"),__vite__mapDeps([39,40])))},{id:"fennel",name:"Fennel",import:(()=>c(()=>import("./fennel-BYunw83y.js"),[]))},{id:"fish",name:"Fish",import:(()=>c(()=>import("./fish-BvzEVeQv.js"),[]))},{id:"fluent",name:"Fluent",aliases:["ftl"],import:(()=>c(()=>import("./fluent-C4IJs8-o.js"),[]))},{id:"fortran-fixed-form",name:"Fortran (Fixed Form)",aliases:["f","for","f77"],import:(()=>c(()=>import("./fortran-fixed-form-CkoXwp7k.js"),__vite__mapDeps([41,42])))},{id:"fortran-free-form",name:"Fortran (Free Form)",aliases:["f90","f95","f03","f08","f18"],import:(()=>c(()=>import("./fortran-free-form-BxgE0vQu.js"),[]))},{id:"fsharp",name:"F#",aliases:["f#","fs"],import:(()=>c(()=>import("./fsharp-CXgrBDvD.js"),__vite__mapDeps([43,40])))},{id:"gdresource",name:"GDResource",aliases:["tscn","tres"],import:(()=>c(()=>import("./gdresource-BOOCDP_w.js"),__vite__mapDeps([44,45,46])))},{id:"gdscript",name:"GDScript",aliases:["gd"],import:(()=>c(()=>import("./gdscript-C5YyOfLZ.js"),[]))},{id:"gdshader",name:"GDShader",import:(()=>c(()=>import("./gdshader-DkwncUOv.js"),[]))},{id:"genie",name:"Genie",import:(()=>c(()=>import("./genie-D0YGMca9.js"),[]))},{id:"gherkin",name:"Gherkin",import:(()=>c(()=>import("./gherkin-DyxjwDmM.js"),[]))},{id:"git-commit",name:"Git Commit Message",import:(()=>c(()=>import("./git-commit-F4YmCXRG.js"),__vite__mapDeps([47,48])))},{id:"git-rebase",name:"Git Rebase Message",import:(()=>c(()=>import("./git-rebase-r7XF79zn.js"),__vite__mapDeps([49,28])))},{id:"gleam",name:"Gleam",import:(()=>c(()=>import("./gleam-BspZqrRM.js"),[]))},{id:"glimmer-js",name:"Glimmer JS",aliases:["gjs"],import:(()=>c(()=>import("./glimmer-js-Rg0-pVw9.js"),__vite__mapDeps([50,2,11,3,1])))},{id:"glimmer-ts",name:"Glimmer TS",aliases:["gts"],import:(()=>c(()=>import("./glimmer-ts-U6CK756n.js"),__vite__mapDeps([51,11,3,2,1])))},{id:"glsl",name:"GLSL",import:(()=>c(()=>import("./glsl-DplSGwfg.js"),__vite__mapDeps([25,26])))},{id:"gn",name:"GN",import:(()=>c(()=>import("./gn-n2N0HUVH.js"),[]))},{id:"gnuplot",name:"Gnuplot",import:(()=>c(()=>import("./gnuplot-DdkO51Og.js"),[]))},{id:"go",name:"Go",import:(()=>c(()=>import("./go-CxLEBnE3.js"),[]))},{id:"graphql",name:"GraphQL",aliases:["gql"],import:(()=>c(()=>import("./graphql-ChdNCCLP.js"),__vite__mapDeps([35,2,11,36,13])))},{id:"groovy",name:"Groovy",import:(()=>c(()=>import("./groovy-gcz8RCvz.js"),[]))},{id:"hack",name:"Hack",import:(()=>c(()=>import("./hack-CaT9iCJl.js"),__vite__mapDeps([52,1,2,3,16])))},{id:"haml",name:"Ruby Haml",import:(()=>c(()=>import("./haml-B8DHNrY2.js"),__vite__mapDeps([34,2,3])))},{id:"handlebars",name:"Handlebars",aliases:["hbs"],import:(()=>c(()=>import("./handlebars-BL8al0AC.js"),__vite__mapDeps([53,1,2,3,38])))},{id:"haskell",name:"Haskell",aliases:["hs"],import:(()=>c(()=>import("./haskell-Df6bDoY_.js"),[]))},{id:"haxe",name:"Haxe",import:(()=>c(()=>import("./haxe-CzTSHFRz.js"),[]))},{id:"hcl",name:"HashiCorp HCL",import:(()=>c(()=>import("./hcl-BWvSN4gD.js"),[]))},{id:"hjson",name:"Hjson",import:(()=>c(()=>import("./hjson-D5-asLiD.js"),[]))},{id:"hlsl",name:"HLSL",import:(()=>c(()=>import("./hlsl-D3lLCCz7.js"),[]))},{id:"html",name:"HTML",import:(()=>c(()=>import("./html-GMplVEZG.js"),__vite__mapDeps([1,2,3])))},{id:"html-derivative",name:"HTML (Derivative)",import:(()=>c(()=>import("./html-derivative-BFtXZ54Q.js"),__vite__mapDeps([15,1,2,3])))},{id:"http",name:"HTTP",import:(()=>c(()=>import("./http-jrhK8wxY.js"),__vite__mapDeps([54,28,9,7,8,35,2,11,36,13])))},{id:"hurl",name:"Hurl",import:(()=>c(()=>import("./hurl-irOxFIW8.js"),__vite__mapDeps([55,35,2,11,36,13,7,8,56])))},{id:"hxml",name:"HXML",import:(()=>c(()=>import("./hxml-Bvhsp5Yf.js"),__vite__mapDeps([57,58])))},{id:"hy",name:"Hy",import:(()=>c(()=>import("./hy-DFXneXwc.js"),[]))},{id:"imba",name:"Imba",import:(()=>c(()=>import("./imba-DGztddWO.js"),[]))},{id:"ini",name:"INI",aliases:["properties"],import:(()=>c(()=>import("./ini-BEwlwnbL.js"),[]))},{id:"java",name:"Java",import:(()=>c(()=>import("./java-CylS5w8V.js"),[]))},{id:"javascript",name:"JavaScript",aliases:["js","cjs","mjs"],import:(()=>c(()=>import("./javascript-wDzz0qaB.js"),[]))},{id:"jinja",name:"Jinja",import:(()=>c(()=>import("./jinja-4LBKfQ-Z.js"),__vite__mapDeps([59,1,2,3])))},{id:"jison",name:"Jison",import:(()=>c(()=>import("./jison-wvAkD_A8.js"),__vite__mapDeps([60,2])))},{id:"json",name:"JSON",import:(()=>c(()=>import("./json-Cp-IABpG.js"),[]))},{id:"json5",name:"JSON5",import:(()=>c(()=>import("./json5-C9tS-k6U.js"),[]))},{id:"jsonc",name:"JSON with Comments",import:(()=>c(()=>import("./jsonc-Des-eS-w.js"),[]))},{id:"jsonl",name:"JSON Lines",import:(()=>c(()=>import("./jsonl-DcaNXYhu.js"),[]))},{id:"jsonnet",name:"Jsonnet",import:(()=>c(()=>import("./jsonnet-DFQXde-d.js"),[]))},{id:"jssm",name:"JSSM",aliases:["fsl"],import:(()=>c(()=>import("./jssm-C2t-YnRu.js"),[]))},{id:"jsx",name:"JSX",import:(()=>c(()=>import("./jsx-g9-lgVsj.js"),[]))},{id:"julia",name:"Julia",aliases:["jl"],import:(()=>c(()=>import("./julia-CxzCAyBv.js"),__vite__mapDeps([61,23,24,25,26,16,20,2,62])))},{id:"kdl",name:"KDL",import:(()=>c(()=>import("./kdl-DV7GczEv.js"),[]))},{id:"kotlin",name:"Kotlin",aliases:["kt","kts"],import:(()=>c(()=>import("./kotlin-BdnUsdx6.js"),[]))},{id:"kusto",name:"Kusto",aliases:["kql"],import:(()=>c(()=>import("./kusto-DZf3V79B.js"),[]))},{id:"latex",name:"LaTeX",import:(()=>c(()=>import("./latex-DGMBWnxU.js"),__vite__mapDeps([63,64,62])))},{id:"lean",name:"Lean 4",aliases:["lean4"],import:(()=>c(()=>import("./lean-BZvkOJ9d.js"),[]))},{id:"less",name:"Less",import:(()=>c(()=>import("./less-B1dDrJ26.js"),[]))},{id:"liquid",name:"Liquid",import:(()=>c(()=>import("./liquid-DYVedYrR.js"),__vite__mapDeps([65,1,2,3,9])))},{id:"llvm",name:"LLVM IR",import:(()=>c(()=>import("./llvm-BtvRca6l.js"),[]))},{id:"log",name:"Log file",import:(()=>c(()=>import("./log-2UxHyX5q.js"),[]))},{id:"logo",name:"Logo",import:(()=>c(()=>import("./logo-BtOb2qkB.js"),[]))},{id:"lua",name:"Lua",import:(()=>c(()=>import("./lua-BaeVxFsk.js"),__vite__mapDeps([37,26])))},{id:"luau",name:"Luau",import:(()=>c(()=>import("./luau-C-HG3fhB.js"),[]))},{id:"make",name:"Makefile",aliases:["makefile"],import:(()=>c(()=>import("./make-CHLpvVh8.js"),[]))},{id:"markdown",name:"Markdown",aliases:["md"],import:(()=>c(()=>import("./markdown-Cvjx9yec.js"),[]))},{id:"marko",name:"Marko",import:(()=>c(()=>import("./marko-DZsq8hO1.js"),__vite__mapDeps([66,3,67,5,11])))},{id:"matlab",name:"MATLAB",import:(()=>c(()=>import("./matlab-D7o27uSR.js"),[]))},{id:"mdc",name:"MDC",import:(()=>c(()=>import("./mdc-DUICxH0z.js"),__vite__mapDeps([68,40,38,15,1,2,3])))},{id:"mdx",name:"MDX",import:(()=>c(()=>import("./mdx-Cmh6b_Ma.js"),[]))},{id:"mermaid",name:"Mermaid",aliases:["mmd"],import:(()=>c(()=>import("./mermaid-mWjccvbQ.js"),[]))},{id:"mipsasm",name:"MIPS Assembly",aliases:["mips"],import:(()=>c(()=>import("./mipsasm-CKIfxQSi.js"),[]))},{id:"mojo",name:"Mojo",import:(()=>c(()=>import("./mojo-B93PlW-d.js"),[]))},{id:"moonbit",name:"MoonBit",aliases:["mbt","mbti"],import:(()=>c(()=>import("./moonbit-Ba13S78F.js"),[]))},{id:"move",name:"Move",import:(()=>c(()=>import("./move-IF9eRakj.js"),[]))},{id:"narrat",name:"Narrat Language",aliases:["nar"],import:(()=>c(()=>import("./narrat-DRg8JJMk.js"),[]))},{id:"nextflow",name:"Nextflow",aliases:["nf"],import:(()=>c(()=>import("./nextflow-BrzmwbiE.js"),[]))},{id:"nginx",name:"Nginx",import:(()=>c(()=>import("./nginx-BpAMiNFr.js"),__vite__mapDeps([69,37,26])))},{id:"nim",name:"Nim",import:(()=>c(()=>import("./nim-CVrawwO9.js"),__vite__mapDeps([70,26,1,2,3,7,8,25,40])))},{id:"nix",name:"Nix",import:(()=>c(()=>import("./nix-CwoSXNpI.js"),[]))},{id:"nushell",name:"nushell",aliases:["nu"],import:(()=>c(()=>import("./nushell-C-sUppwS.js"),[]))},{id:"objective-c",name:"Objective-C",aliases:["objc"],import:(()=>c(()=>import("./objective-c-DXmwc3jG.js"),[]))},{id:"objective-cpp",name:"Objective-C++",import:(()=>c(()=>import("./objective-cpp-CLxacb5B.js"),[]))},{id:"ocaml",name:"OCaml",import:(()=>c(()=>import("./ocaml-C0hk2d4L.js"),[]))},{id:"odin",name:"Odin",import:(()=>c(()=>import("./odin-BBf5iR-q.js"),[]))},{id:"openscad",name:"OpenSCAD",aliases:["scad"],import:(()=>c(()=>import("./openscad-C4EeE6gA.js"),[]))},{id:"pascal",name:"Pascal",import:(()=>c(()=>import("./pascal-D93ZcfNL.js"),[]))},{id:"perl",name:"Perl",import:(()=>c(()=>import("./perl-C0TMdlhV.js"),__vite__mapDeps([71,1,2,3,7,8,16])))},{id:"php",name:"PHP",import:(()=>c(()=>import("./php-Dhbhpdrm.js"),__vite__mapDeps([72,1,2,3,7,8,16,9])))},{id:"pkl",name:"Pkl",import:(()=>c(()=>import("./pkl-u5AG7uiY.js"),[]))},{id:"plsql",name:"PL/SQL",import:(()=>c(()=>import("./plsql-ChMvpjG-.js"),[]))},{id:"po",name:"Gettext PO",aliases:["pot","potx"],import:(()=>c(()=>import("./po-BTJTHyun.js"),[]))},{id:"polar",name:"Polar",import:(()=>c(()=>import("./polar-C0HS_06l.js"),[]))},{id:"postcss",name:"PostCSS",import:(()=>c(()=>import("./postcss-CXtECtnM.js"),[]))},{id:"powerquery",name:"PowerQuery",import:(()=>c(()=>import("./powerquery-CEu0bR-o.js"),[]))},{id:"powershell",name:"PowerShell",aliases:["ps","ps1"],import:(()=>c(()=>import("./powershell-Dpen1YoG.js"),[]))},{id:"prisma",name:"Prisma",import:(()=>c(()=>import("./prisma-Dd19v3D-.js"),[]))},{id:"prolog",name:"Prolog",import:(()=>c(()=>import("./prolog-CbFg5uaA.js"),[]))},{id:"proto",name:"Protocol Buffer 3",aliases:["protobuf"],import:(()=>c(()=>import("./proto-C7zT0LnQ.js"),[]))},{id:"pug",name:"Pug",aliases:["jade"],import:(()=>c(()=>import("./pug-CGlum2m_.js"),__vite__mapDeps([73,2,3,1])))},{id:"puppet",name:"Puppet",import:(()=>c(()=>import("./puppet-BMWR74SV.js"),[]))},{id:"purescript",name:"PureScript",import:(()=>c(()=>import("./purescript-CklMAg4u.js"),[]))},{id:"python",name:"Python",aliases:["py"],import:(()=>c(()=>import("./python-B6aJPvgy.js"),[]))},{id:"qml",name:"QML",import:(()=>c(()=>import("./qml-3beO22l8.js"),__vite__mapDeps([74,2])))},{id:"qmldir",name:"QML Directory",import:(()=>c(()=>import("./qmldir-C8lEn-DE.js"),[]))},{id:"qss",name:"Qt Style Sheets",import:(()=>c(()=>import("./qss-IeuSbFQv.js"),[]))},{id:"r",name:"R",import:(()=>c(()=>import("./r-Dspwwk_N.js"),[]))},{id:"racket",name:"Racket",import:(()=>c(()=>import("./racket-BqYA7rlc.js"),[]))},{id:"raku",name:"Raku",aliases:["perl6"],import:(()=>c(()=>import("./raku-DXvB9xmW.js"),[]))},{id:"razor",name:"ASP.NET Razor",import:(()=>c(()=>import("./razor-Uh8Bk_45.js"),__vite__mapDeps([75,1,2,3,76])))},{id:"reg",name:"Windows Registry Script",import:(()=>c(()=>import("./reg-C-SQnVFl.js"),[]))},{id:"regexp",name:"RegExp",aliases:["regex"],import:(()=>c(()=>import("./regexp-CDVJQ6XC.js"),[]))},{id:"rel",name:"Rel",import:(()=>c(()=>import("./rel-C3B-1QV4.js"),[]))},{id:"riscv",name:"RISC-V",import:(()=>c(()=>import("./riscv-BM1_JUlF.js"),[]))},{id:"ron",name:"RON",import:(()=>c(()=>import("./ron-BhRPY-oY.js"),[]))},{id:"rosmsg",name:"ROS Interface",import:(()=>c(()=>import("./rosmsg-BJDFO7_C.js"),[]))},{id:"rst",name:"reStructuredText",import:(()=>c(()=>import("./rst-D5oM4XIm.js"),__vite__mapDeps([77,15,1,2,3,23,24,25,26,16,20,28,38,78,33,34,7,8,35,11,36,13,37])))},{id:"ruby",name:"Ruby",aliases:["rb"],import:(()=>c(()=>import("./ruby-Cw6WdidG.js"),__vite__mapDeps([33,1,2,3,34,7,8,16,35,11,36,13,23,24,25,26,28,37,38])))},{id:"rust",name:"Rust",aliases:["rs"],import:(()=>c(()=>import("./rust-B1yitclQ.js"),[]))},{id:"sas",name:"SAS",import:(()=>c(()=>import("./sas-cz2c8ADy.js"),__vite__mapDeps([79,16])))},{id:"sass",name:"Sass",import:(()=>c(()=>import("./sass-Cj5Yp3dK.js"),[]))},{id:"scala",name:"Scala",import:(()=>c(()=>import("./scala-C151Ov-r.js"),[]))},{id:"scheme",name:"Scheme",import:(()=>c(()=>import("./scheme-C98Dy4si.js"),[]))},{id:"scss",name:"SCSS",import:(()=>c(()=>import("./scss-OYdSNvt2.js"),__vite__mapDeps([5,3])))},{id:"sdbl",name:"1C (Query)",aliases:["1c-query"],import:(()=>c(()=>import("./sdbl-DVxCFoDh.js"),[]))},{id:"shaderlab",name:"ShaderLab",aliases:["shader"],import:(()=>c(()=>import("./shaderlab-Dg9Lc6iA.js"),__vite__mapDeps([80,81])))},{id:"shellscript",name:"Shell",aliases:["bash","sh","shell","zsh"],import:(()=>c(()=>import("./shellscript-Yzrsuije.js"),[]))},{id:"shellsession",name:"Shell Session",aliases:["console"],import:(()=>c(()=>import("./shellsession-BADoaaVG.js"),__vite__mapDeps([82,28])))},{id:"smalltalk",name:"Smalltalk",import:(()=>c(()=>import("./smalltalk-BERRCDM3.js"),[]))},{id:"solidity",name:"Solidity",import:(()=>c(()=>import("./solidity-rGO070M0.js"),[]))},{id:"soy",name:"Closure Templates",aliases:["closure-templates"],import:(()=>c(()=>import("./soy-Brmx7dQM.js"),__vite__mapDeps([83,1,2,3])))},{id:"sparql",name:"SPARQL",import:(()=>c(()=>import("./sparql-rVzFXLq3.js"),__vite__mapDeps([84,85])))},{id:"splunk",name:"Splunk Query Language",aliases:["spl"],import:(()=>c(()=>import("./splunk-BtCnVYZw.js"),[]))},{id:"sql",name:"SQL",import:(()=>c(()=>import("./sql-BLtJtn59.js"),[]))},{id:"ssh-config",name:"SSH Config",import:(()=>c(()=>import("./ssh-config-_ykCGR6B.js"),[]))},{id:"stata",name:"Stata",import:(()=>c(()=>import("./stata-BH5u7GGu.js"),__vite__mapDeps([86,16])))},{id:"stylus",name:"Stylus",aliases:["styl"],import:(()=>c(()=>import("./stylus-BEDo0Tqx.js"),[]))},{id:"surrealql",name:"SurrealQL",aliases:["surql"],import:(()=>c(()=>import("./surrealql-Bq5Q-fJD.js"),__vite__mapDeps([87,2])))},{id:"svelte",name:"Svelte",import:(()=>c(()=>import("./svelte-zxCyuUbr.js"),__vite__mapDeps([88,2,11,3,12])))},{id:"swift",name:"Swift",import:(()=>c(()=>import("./swift-Dg5xB15N.js"),[]))},{id:"system-verilog",name:"SystemVerilog",import:(()=>c(()=>import("./system-verilog-CnnmHF94.js"),[]))},{id:"systemd",name:"Systemd Units",import:(()=>c(()=>import("./systemd-4A_iFExJ.js"),[]))},{id:"talonscript",name:"TalonScript",aliases:["talon"],import:(()=>c(()=>import("./talonscript-CkByrt1z.js"),[]))},{id:"tasl",name:"Tasl",import:(()=>c(()=>import("./tasl-QIJgUcNo.js"),[]))},{id:"tcl",name:"Tcl",import:(()=>c(()=>import("./tcl-dwOrl1Do.js"),[]))},{id:"templ",name:"Templ",import:(()=>c(()=>import("./templ-P3uqSqPl.js"),__vite__mapDeps([89,90,2,3])))},{id:"terraform",name:"Terraform",aliases:["tf","tfvars"],import:(()=>c(()=>import("./terraform-BETggiCN.js"),[]))},{id:"tex",name:"TeX",import:(()=>c(()=>import("./tex-CvyZ59Mk.js"),__vite__mapDeps([64,62])))},{id:"toml",name:"TOML",import:(()=>c(()=>import("./toml-vGWfd6FD.js"),[]))},{id:"ts-tags",name:"TypeScript with Tags",aliases:["lit"],import:(()=>c(()=>import("./ts-tags-zn1MmPIZ.js"),__vite__mapDeps([91,11,3,2,25,26,1,16,7,8])))},{id:"tsv",name:"TSV",import:(()=>c(()=>import("./tsv-B_m7g4N7.js"),[]))},{id:"tsx",name:"TSX",import:(()=>c(()=>import("./tsx-COt5Ahok.js"),[]))},{id:"turtle",name:"Turtle",import:(()=>c(()=>import("./turtle-BsS91CYL.js"),[]))},{id:"twig",name:"Twig",import:(()=>c(()=>import("./twig-ChbOoGGc.js"),__vite__mapDeps([92,3,2,5,72,1,7,8,16,9,20,33,34,35,11,36,13,23,24,25,26,28,37,38])))},{id:"typescript",name:"TypeScript",aliases:["ts","cts","mts"],import:(()=>c(()=>import("./typescript-BPQ3VLAy.js"),[]))},{id:"typespec",name:"TypeSpec",aliases:["tsp"],import:(()=>c(()=>import("./typespec-BGHnOYBU.js"),[]))},{id:"typst",name:"Typst",aliases:["typ"],import:(()=>c(()=>import("./typst-DHCkPAjA.js"),[]))},{id:"v",name:"V",import:(()=>c(()=>import("./v-BcVCzyr7.js"),[]))},{id:"vala",name:"Vala",import:(()=>c(()=>import("./vala-CsfeWuGM.js"),[]))},{id:"vb",name:"Visual Basic",aliases:["cmd"],import:(()=>c(()=>import("./vb-D17OF-Vu.js"),[]))},{id:"verilog",name:"Verilog",import:(()=>c(()=>import("./verilog-BQ8w6xss.js"),[]))},{id:"vhdl",name:"VHDL",import:(()=>c(()=>import("./vhdl-CeAyd5Ju.js"),[]))},{id:"viml",name:"Vim Script",aliases:["vim","vimscript"],import:(()=>c(()=>import("./viml-CJc9bBzg.js"),[]))},{id:"vue",name:"Vue",import:(()=>c(()=>import("./vue-DN_0RTcg.js"),__vite__mapDeps([93,3,2,11,9,1,15])))},{id:"vue-html",name:"Vue HTML",import:(()=>c(()=>import("./vue-html-AaS7Mt5G.js"),__vite__mapDeps([94,2])))},{id:"vue-vine",name:"Vue Vine",import:(()=>c(()=>import("./vue-vine-CQOfvN7w.js"),__vite__mapDeps([95,3,5,67,96,12,2])))},{id:"vyper",name:"Vyper",aliases:["vy"],import:(()=>c(()=>import("./vyper-CDx5xZoG.js"),[]))},{id:"wasm",name:"WebAssembly",import:(()=>c(()=>import("./wasm-MzD3tlZU.js"),[]))},{id:"wenyan",name:"Wenyan",aliases:["文言"],import:(()=>c(()=>import("./wenyan-BV7otONQ.js"),[]))},{id:"wgsl",name:"WGSL",import:(()=>c(()=>import("./wgsl-Dx-B1_4e.js"),[]))},{id:"wikitext",name:"Wikitext",aliases:["mediawiki","wiki"],import:(()=>c(()=>import("./wikitext-BhOHFoWU.js"),[]))},{id:"wit",name:"WebAssembly Interface Types",import:(()=>c(()=>import("./wit-5i3qLPDT.js"),[]))},{id:"wolfram",name:"Wolfram",aliases:["wl"],import:(()=>c(()=>import("./wolfram-lXgVvXCa.js"),[]))},{id:"xml",name:"XML",import:(()=>c(()=>import("./xml-sdJ4AIDG.js"),__vite__mapDeps([7,8])))},{id:"xsl",name:"XSL",import:(()=>c(()=>import("./xsl-CtQFsRM5.js"),__vite__mapDeps([97,7,8])))},{id:"yaml",name:"YAML",aliases:["yml"],import:(()=>c(()=>import("./yaml-Buea-lGh.js"),[]))},{id:"zenscript",name:"ZenScript",import:(()=>c(()=>import("./zenscript-DVFEvuxE.js"),[]))},{id:"zig",name:"Zig",import:(()=>c(()=>import("./zig-VOosw3JB.js"),[]))}],Ds=Object.fromEntries(Un.map(t=>[t.id,t.import])),$s=Object.fromEntries(Un.flatMap(t=>t.aliases?.map(e=>[e,t.import])||[])),Ns={...Ds,...$s},Vs=[{id:"andromeeda",displayName:"Andromeeda",type:"dark",import:(()=>c(()=>import("./andromeeda-C4gqWexZ.js"),[]))},{id:"aurora-x",displayName:"Aurora X",type:"dark",import:(()=>c(()=>import("./aurora-x-D-2ljcwZ.js"),[]))},{id:"ayu-dark",displayName:"Ayu Dark",type:"dark",import:(()=>c(()=>import("./ayu-dark-CMjwMIkn.js"),[]))},{id:"ayu-light",displayName:"Ayu Light",type:"light",import:(()=>c(()=>import("./ayu-light-C47S-Tmv.js"),[]))},{id:"ayu-mirage",displayName:"Ayu Mirage",type:"dark",import:(()=>c(()=>import("./ayu-mirage-CjoLj4QM.js"),[]))},{id:"catppuccin-frappe",displayName:"Catppuccin Frappé",type:"dark",import:(()=>c(()=>import("./catppuccin-frappe-DFWUc33u.js"),[]))},{id:"catppuccin-latte",displayName:"Catppuccin Latte",type:"light",import:(()=>c(()=>import("./catppuccin-latte-C9dUb6Cb.js"),[]))},{id:"catppuccin-macchiato",displayName:"Catppuccin Macchiato",type:"dark",import:(()=>c(()=>import("./catppuccin-macchiato-DQyhUUbL.js"),[]))},{id:"catppuccin-mocha",displayName:"Catppuccin Mocha",type:"dark",import:(()=>c(()=>import("./catppuccin-mocha-D87Tk5Gz.js"),[]))},{id:"dark-plus",displayName:"Dark Plus",type:"dark",import:(()=>c(()=>import("./dark-plus-C3mMm8J8.js"),[]))},{id:"dracula",displayName:"Dracula Theme",type:"dark",import:(()=>c(()=>import("./dracula-BzJJZx-M.js"),[]))},{id:"dracula-soft",displayName:"Dracula Theme Soft",type:"dark",import:(()=>c(()=>import("./dracula-soft-BXkSAIEj.js"),[]))},{id:"everforest-dark",displayName:"Everforest Dark",type:"dark",import:(()=>c(()=>import("./everforest-dark-BgDCqdQA.js"),[]))},{id:"everforest-light",displayName:"Everforest Light",type:"light",import:(()=>c(()=>import("./everforest-light-C8M2exoo.js"),[]))},{id:"github-dark",displayName:"GitHub Dark",type:"dark",import:(()=>c(()=>import("./github-dark-DHJKELXO.js"),[]))},{id:"github-dark-default",displayName:"GitHub Dark Default",type:"dark",import:(()=>c(()=>import("./github-dark-default-Cuk6v7N8.js"),[]))},{id:"github-dark-dimmed",displayName:"GitHub Dark Dimmed",type:"dark",import:(()=>c(()=>import("./github-dark-dimmed-DH5Ifo-i.js"),[]))},{id:"github-dark-high-contrast",displayName:"GitHub Dark High Contrast",type:"dark",import:(()=>c(()=>import("./github-dark-high-contrast-E3gJ1_iC.js"),[]))},{id:"github-light",displayName:"GitHub Light",type:"light",import:(()=>c(()=>import("./github-light-DAi9KRSo.js"),[]))},{id:"github-light-default",displayName:"GitHub Light Default",type:"light",import:(()=>c(()=>import("./github-light-default-D7oLnXFd.js"),[]))},{id:"github-light-high-contrast",displayName:"GitHub Light High Contrast",type:"light",import:(()=>c(()=>import("./github-light-high-contrast-BfjtVDDH.js"),[]))},{id:"gruvbox-dark-hard",displayName:"Gruvbox Dark Hard",type:"dark",import:(()=>c(()=>import("./gruvbox-dark-hard-CFHQjOhq.js"),[]))},{id:"gruvbox-dark-medium",displayName:"Gruvbox Dark Medium",type:"dark",import:(()=>c(()=>import("./gruvbox-dark-medium-GsRaNv29.js"),[]))},{id:"gruvbox-dark-soft",displayName:"Gruvbox Dark Soft",type:"dark",import:(()=>c(()=>import("./gruvbox-dark-soft-CVdnzihN.js"),[]))},{id:"gruvbox-light-hard",displayName:"Gruvbox Light Hard",type:"light",import:(()=>c(()=>import("./gruvbox-light-hard-CH1njM8p.js"),[]))},{id:"gruvbox-light-medium",displayName:"Gruvbox Light Medium",type:"light",import:(()=>c(()=>import("./gruvbox-light-medium-DRw_LuNl.js"),[]))},{id:"gruvbox-light-soft",displayName:"Gruvbox Light Soft",type:"light",import:(()=>c(()=>import("./gruvbox-light-soft-hJgmCMqR.js"),[]))},{id:"horizon",displayName:"Horizon",type:"dark",import:(()=>c(()=>import("./horizon-BUw7H-hv.js"),[]))},{id:"houston",displayName:"Houston",type:"dark",import:(()=>c(()=>import("./houston-DnULxvSX.js"),[]))},{id:"kanagawa-dragon",displayName:"Kanagawa Dragon",type:"dark",import:(()=>c(()=>import("./kanagawa-dragon-CkXjmgJE.js"),[]))},{id:"kanagawa-lotus",displayName:"Kanagawa Lotus",type:"light",import:(()=>c(()=>import("./kanagawa-lotus-CfQXZHmo.js"),[]))},{id:"kanagawa-wave",displayName:"Kanagawa Wave",type:"dark",import:(()=>c(()=>import("./kanagawa-wave-DWedfzmr.js"),[]))},{id:"laserwave",displayName:"LaserWave",type:"dark",import:(()=>c(()=>import("./laserwave-DUszq2jm.js"),[]))},{id:"light-plus",displayName:"Light Plus",type:"light",import:(()=>c(()=>import("./light-plus-B7mTdjB0.js"),[]))},{id:"material-theme",displayName:"Material Theme",type:"dark",import:(()=>c(()=>import("./material-theme-D5KoaKCx.js"),[]))},{id:"material-theme-darker",displayName:"Material Theme Darker",type:"dark",import:(()=>c(()=>import("./material-theme-darker-BfHTSMKl.js"),[]))},{id:"material-theme-lighter",displayName:"Material Theme Lighter",type:"light",import:(()=>c(()=>import("./material-theme-lighter-B0m2ddpp.js"),[]))},{id:"material-theme-ocean",displayName:"Material Theme Ocean",type:"dark",import:(()=>c(()=>import("./material-theme-ocean-CyktbL80.js"),[]))},{id:"material-theme-palenight",displayName:"Material Theme Palenight",type:"dark",import:(()=>c(()=>import("./material-theme-palenight-Csfq5Kiy.js"),[]))},{id:"min-dark",displayName:"Min Dark",type:"dark",import:(()=>c(()=>import("./min-dark-CafNBF8u.js"),[]))},{id:"min-light",displayName:"Min Light",type:"light",import:(()=>c(()=>import("./min-light-CTRr51gU.js"),[]))},{id:"monokai",displayName:"Monokai",type:"dark",import:(()=>c(()=>import("./monokai-D4h5O-jR.js"),[]))},{id:"night-owl",displayName:"Night Owl",type:"dark",import:(()=>c(()=>import("./night-owl-C39BiMTA.js"),[]))},{id:"night-owl-light",displayName:"Night Owl Light",type:"light",import:(()=>c(()=>import("./night-owl-light-CMTm3GFP.js"),[]))},{id:"nord",displayName:"Nord",type:"dark",import:(()=>c(()=>import("./nord-Ddv68eIx.js"),[]))},{id:"one-dark-pro",displayName:"One Dark Pro",type:"dark",import:(()=>c(()=>import("./one-dark-pro-DVMEJ2y_.js"),[]))},{id:"one-light",displayName:"One Light",type:"light",import:(()=>c(()=>import("./one-light-C3Wv6jpd.js"),[]))},{id:"plastic",displayName:"Plastic",type:"dark",import:(()=>c(()=>import("./plastic-3e1v2bzS.js"),[]))},{id:"poimandres",displayName:"Poimandres",type:"dark",import:(()=>c(()=>import("./poimandres-CS3Unz2-.js"),[]))},{id:"red",displayName:"Red",type:"dark",import:(()=>c(()=>import("./red-bN70gL4F.js"),[]))},{id:"rose-pine",displayName:"Rosé Pine",type:"dark",import:(()=>c(()=>import("./rose-pine-qdsjHGoJ.js"),[]))},{id:"rose-pine-dawn",displayName:"Rosé Pine Dawn",type:"light",import:(()=>c(()=>import("./rose-pine-dawn-DHQR4-dF.js"),[]))},{id:"rose-pine-moon",displayName:"Rosé Pine Moon",type:"dark",import:(()=>c(()=>import("./rose-pine-moon-D4_iv3hh.js"),[]))},{id:"slack-dark",displayName:"Slack Dark",type:"dark",import:(()=>c(()=>import("./slack-dark-BthQWCQV.js"),[]))},{id:"slack-ochin",displayName:"Slack Ochin",type:"light",import:(()=>c(()=>import("./slack-ochin-DqwNpetd.js"),[]))},{id:"snazzy-light",displayName:"Snazzy Light",type:"light",import:(()=>c(()=>import("./snazzy-light-Bw305WKR.js"),[]))},{id:"solarized-dark",displayName:"Solarized Dark",type:"dark",import:(()=>c(()=>import("./solarized-dark-DXbdFlpD.js"),[]))},{id:"solarized-light",displayName:"Solarized Light",type:"light",import:(()=>c(()=>import("./solarized-light-L9t79GZl.js"),[]))},{id:"synthwave-84",displayName:"Synthwave '84",type:"dark",import:(()=>c(()=>import("./synthwave-84-CbfX1IO0.js"),[]))},{id:"tokyo-night",displayName:"Tokyo Night",type:"dark",import:(()=>c(()=>import("./tokyo-night-hegEt444.js"),[]))},{id:"vesper",displayName:"Vesper",type:"dark",import:(()=>c(()=>import("./vesper-DU1UobuO.js"),[]))},{id:"vitesse-black",displayName:"Vitesse Black",type:"dark",import:(()=>c(()=>import("./vitesse-black-Bkuqu6BP.js"),[]))},{id:"vitesse-dark",displayName:"Vitesse Dark",type:"dark",import:(()=>c(()=>import("./vitesse-dark-D0r3Knsf.js"),[]))},{id:"vitesse-light",displayName:"Vitesse Light",type:"light",import:(()=>c(()=>import("./vitesse-light-CVO1_9PV.js"),[]))}],zs=Object.fromEntries(Vs.map(t=>[t.id,t.import]));class dr extends Error{constructor(e){super(e),this.name="ShikiError"}}function Ms(){return 2147483648}function Bs(){return typeof performance<"u"?performance.now():Date.now()}const js=(t,e)=>t+(e-t%e)%e;async function Gs(t){let e,r;const n={};function i(g){r=g,n.HEAPU8=new Uint8Array(g),n.HEAPU32=new Uint32Array(g)}function o(g,m,y){n.HEAPU8.copyWithin(g,m,m+y)}function a(g){try{return e.grow(g-r.byteLength+65535>>>16),i(e.buffer),1}catch{}}function l(g){const m=n.HEAPU8.length;g=g>>>0;const y=Ms();if(g>y)return!1;for(let k=1;k<=4;k*=2){let v=m*(1+.2/k);v=Math.min(v,g+100663296);const x=Math.min(y,js(Math.max(g,v),65536));if(a(x))return!0}return!1}const s=typeof TextDecoder<"u"?new TextDecoder("utf8"):void 0;function u(g,m,y=1024){const k=m+y;let v=m;for(;g[v]&&!(v>=k);)++v;if(v-m>16&&g.buffer&&s)return s.decode(g.subarray(m,v));let x="";for(;m<v;){let _=g[m++];if(!(_&128)){x+=String.fromCharCode(_);continue}const E=g[m++]&63;if((_&224)===192){x+=String.fromCharCode((_&31)<<6|E);continue}const T=g[m++]&63;if((_&240)===224?_=(_&15)<<12|E<<6|T:_=(_&7)<<18|E<<12|T<<6|g[m++]&63,_<65536)x+=String.fromCharCode(_);else{const N=_-65536;x+=String.fromCharCode(55296|N>>10,56320|N&1023)}}return x}function d(g,m){return g?u(n.HEAPU8,g,m):""}const p={emscripten_get_now:Bs,emscripten_memcpy_big:o,emscripten_resize_heap:l,fd_write:()=>0};async function h(){const m=await t({env:p,wasi_snapshot_preview1:p});e=m.memory,i(e.buffer),Object.assign(n,m),n.UTF8ToString=d}return await h(),n}var Us=Object.defineProperty,Fs=(t,e,r)=>e in t?Us(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r,O=(t,e,r)=>Fs(t,typeof e!="symbol"?e+"":e,r);let $=null;function Hs(t){throw new dr(t.UTF8ToString(t.getLastOnigError()))}class ft{constructor(e){O(this,"utf16Length"),O(this,"utf8Length"),O(this,"utf16Value"),O(this,"utf8Value"),O(this,"utf16OffsetToUtf8"),O(this,"utf8OffsetToUtf16");const r=e.length,n=ft._utf8ByteLength(e),i=n!==r,o=i?new Uint32Array(r+1):null;i&&(o[r]=n);const a=i?new Uint32Array(n+1):null;i&&(a[n]=r);const l=new Uint8Array(n);let s=0;for(let u=0;u<r;u++){const d=e.charCodeAt(u);let p=d,h=!1;if(d>=55296&&d<=56319&&u+1<r){const g=e.charCodeAt(u+1);g>=56320&&g<=57343&&(p=(d-55296<<10)+65536|g-56320,h=!0)}i&&(o[u]=s,h&&(o[u+1]=s),p<=127?a[s+0]=u:p<=2047?(a[s+0]=u,a[s+1]=u):p<=65535?(a[s+0]=u,a[s+1]=u,a[s+2]=u):(a[s+0]=u,a[s+1]=u,a[s+2]=u,a[s+3]=u)),p<=127?l[s++]=p:p<=2047?(l[s++]=192|(p&1984)>>>6,l[s++]=128|(p&63)>>>0):p<=65535?(l[s++]=224|(p&61440)>>>12,l[s++]=128|(p&4032)>>>6,l[s++]=128|(p&63)>>>0):(l[s++]=240|(p&1835008)>>>18,l[s++]=128|(p&258048)>>>12,l[s++]=128|(p&4032)>>>6,l[s++]=128|(p&63)>>>0),h&&u++}this.utf16Length=r,this.utf8Length=n,this.utf16Value=e,this.utf8Value=l,this.utf16OffsetToUtf8=o,this.utf8OffsetToUtf16=a}static _utf8ByteLength(e){let r=0;for(let n=0,i=e.length;n<i;n++){const o=e.charCodeAt(n);let a=o,l=!1;if(o>=55296&&o<=56319&&n+1<i){const s=e.charCodeAt(n+1);s>=56320&&s<=57343&&(a=(o-55296<<10)+65536|s-56320,l=!0)}a<=127?r+=1:a<=2047?r+=2:a<=65535?r+=3:r+=4,l&&n++}return r}createString(e){const r=e.omalloc(this.utf8Length);return e.HEAPU8.set(this.utf8Value,r),r}}const _t=class J{constructor(e){if(O(this,"id",++J.LAST_ID),O(this,"_onigBinding"),O(this,"content"),O(this,"utf16Length"),O(this,"utf8Length"),O(this,"utf16OffsetToUtf8"),O(this,"utf8OffsetToUtf16"),O(this,"ptr"),!$)throw new dr("Must invoke loadWasm first.");this._onigBinding=$,this.content=e;const r=new ft(e);this.utf16Length=r.utf16Length,this.utf8Length=r.utf8Length,this.utf16OffsetToUtf8=r.utf16OffsetToUtf8,this.utf8OffsetToUtf16=r.utf8OffsetToUtf16,this.utf8Length<1e4&&!J._sharedPtrInUse?(J._sharedPtr||(J._sharedPtr=$.omalloc(1e4)),J._sharedPtrInUse=!0,$.HEAPU8.set(r.utf8Value,J._sharedPtr),this.ptr=J._sharedPtr):this.ptr=r.createString($)}convertUtf8OffsetToUtf16(e){return this.utf8OffsetToUtf16?e<0?0:e>this.utf8Length?this.utf16Length:this.utf8OffsetToUtf16[e]:e}convertUtf16OffsetToUtf8(e){return this.utf16OffsetToUtf8?e<0?0:e>this.utf16Length?this.utf8Length:this.utf16OffsetToUtf8[e]:e}dispose(){this.ptr===J._sharedPtr?J._sharedPtrInUse=!1:this._onigBinding.ofree(this.ptr)}};O(_t,"LAST_ID",0);O(_t,"_sharedPtr",0);O(_t,"_sharedPtrInUse",!1);let Fn=_t;class qs{constructor(e){if(O(this,"_onigBinding"),O(this,"_ptr"),!$)throw new dr("Must invoke loadWasm first.");const r=[],n=[];for(let l=0,s=e.length;l<s;l++){const u=new ft(e[l]);r[l]=u.createString($),n[l]=u.utf8Length}const i=$.omalloc(4*e.length);$.HEAPU32.set(r,i/4);const o=$.omalloc(4*e.length);$.HEAPU32.set(n,o/4);const a=$.createOnigScanner(i,o,e.length);for(let l=0,s=e.length;l<s;l++)$.ofree(r[l]);$.ofree(o),$.ofree(i),a===0&&Hs($),this._onigBinding=$,this._ptr=a}dispose(){this._onigBinding.freeOnigScanner(this._ptr)}findNextMatchSync(e,r,n){let i=0;if(typeof n=="number"&&(i=n),typeof e=="string"){e=new Fn(e);const o=this._findNextMatchSync(e,r,!1,i);return e.dispose(),o}return this._findNextMatchSync(e,r,!1,i)}_findNextMatchSync(e,r,n,i){const o=this._onigBinding,a=o.findNextOnigScannerMatch(this._ptr,e.id,e.ptr,e.utf8Length,e.convertUtf16OffsetToUtf8(r),i);if(a===0)return null;const l=o.HEAPU32;let s=a/4;const u=l[s++],d=l[s++],p=[];for(let h=0;h<d;h++){const g=e.convertUtf8OffsetToUtf16(l[s++]),m=e.convertUtf8OffsetToUtf16(l[s++]);p[h]={start:g,end:m,length:m-g}}return{index:u,captureIndices:p}}}function Ws(t){return typeof t.instantiator=="function"}function Ks(t){return typeof t.default=="function"}function Qs(t){return typeof t.data<"u"}function Xs(t){return typeof Response<"u"&&t instanceof Response}function Ys(t){return typeof ArrayBuffer<"u"&&(t instanceof ArrayBuffer||ArrayBuffer.isView(t))||typeof Buffer<"u"&&Buffer.isBuffer?.(t)||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer||typeof Uint32Array<"u"&&t instanceof Uint32Array}let We;function Zs(t){if(We)return We;async function e(){$=await Gs(async r=>{let n=t;return n=await n,typeof n=="function"&&(n=await n(r)),typeof n=="function"&&(n=await n(r)),Ws(n)?n=await n.instantiator(r):Ks(n)?n=await n.default(r):(Qs(n)&&(n=n.data),Xs(n)?typeof WebAssembly.instantiateStreaming=="function"?n=await Js(n)(r):n=await el(n)(r):Ys(n)?n=await St(n)(r):n instanceof WebAssembly.Module?n=await St(n)(r):"default"in n&&n.default instanceof WebAssembly.Module&&(n=await St(n.default)(r))),"instance"in n&&(n=n.instance),"exports"in n&&(n=n.exports),n})}return We=e(),We}function St(t){return e=>WebAssembly.instantiate(t,e)}function Js(t){return e=>WebAssembly.instantiateStreaming(t,e)}function el(t){return async e=>{const r=await t.arrayBuffer();return WebAssembly.instantiate(r,e)}}async function tl(t){return t&&await Zs(t),{createScanner(e){return new qs(e.map(r=>typeof r=="string"?r:r.source))},createString(e){return new Fn(e)}}}const rl=Os({langs:Ns,themes:zs,engine:()=>tl(c(()=>import("./wasm-CG6Dc4jp.js"),[]))});let Ke;async function nl(){if(Ke)return Ke;const t=await rl({themes:["plastic"],langs:["csharp","typescript"]});return Ke=new nn().use(Ui({highlight(e,r){const n=t.getLoadedLanguages().includes(r)?r:"text";return t.codeToHtml(e,{lang:n,theme:"plastic"})}})),Ke}var il=Object.defineProperty,ol=Object.getOwnPropertyDescriptor,fe=(t,e,r,n)=>{for(var i=n>1?void 0:n?ol(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&il(e,r,i),i};const al=["root","server","client"];function sl(t){return al.includes(t)}let te=class extends pe{constructor(){super(...arguments),this.name="",this.plugin=null,this.loading=!1,this.error=null,this.activeReadmeTab="root",this.renderedReadme=""}connectedCallback(){super.connectedCallback(),this.name&&this.loadPlugin()}willUpdate(t){t.has("name")&&this.name&&this.loadPlugin(),(t.has("activeReadmeTab")||t.has("plugin"))&&this.parseReadme()}async loadPlugin(){if(this.name){this.loading=!0,this.error=null,this.activeReadmeTab="root",this.renderedReadme="";try{this.plugin=await K.getPlugin(this.name)}catch(t){console.error("Failed to load plugin:",t),this.error=t instanceof Error?t.message:"Failed to load plugin details",this.plugin=null}finally{this.loading=!1}}}async parseReadme(){const t=this.readmeTabs,e=t.find(n=>n.key===this.activeReadmeTab)??t[0];if(!e){this.renderedReadme="";return}const r=await nl();this.renderedReadme=await r.parse(e.content)}async handleDownload(t,e){try{const r=await K.downloadPlugin(t,e),n=URL.createObjectURL(r),i=document.createElement("a");i.href=n,i.download=`${t}-${e}.pivotpkg`,i.click(),URL.revokeObjectURL(n)}catch(r){console.error("Failed to download plugin:",r),alert("Failed to download plugin")}}handleDownloadClick(t){const{pluginName:e,version:r}=le(t,"pluginName","version");e&&r&&this.handleDownload(e,r)}handleTabClick(t){const{tab:e}=le(t,"tab");e&&sl(e)&&(this.activeReadmeTab=e)}renderVersionsTable(){const t=this.plugin?.versions;return!t||t.length===0?b`<p>No versions available.</p>`:b`
		<table class="versions-table">
			<thead>
				<tr>
					<th>Version</th>
					<th>File Size</th>
					<th>Downloads</th>
					<th>Uploaded</th>
					<th>Dependencies</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${t.map(e=>b`
				<tr>
					<td><strong>${e.version}</strong></td>
					<td>${Fr(e.fileSize)}</td>
					<td>${e.downloadCount}</td>
					<td>${Hr(e.uploadedAt)}</td>
					<td>
					${L(e.dependencies.length>0,()=>b`
					${e.dependencies.map(r=>b`
						<span class="dependency-tag">
							${r.dependencyName} ${r.versionRange}
						</span>
					`)}
					`,()=>b`
					<span class="no-deps">None</span>
					`)}
					</td>
					<td>
						<button
							class="btn-small btn-primary"
							data-plugin-name=${this.plugin.name}
							data-version=${e.version}
							@click=${this.handleDownloadClick}
						>
							Download
						</button>
					</td>
				</tr>
				`)}
			</tbody>
		</table>
		`}renderTags(){const t=this.plugin?.tags;if(!(!t||t.length===0))return b`
		<div class="tags">
			${t.map(e=>b`<span class="tag">${e}</span>`)}
		</div>
		`}get readmeTabs(){const t=[];return this.plugin?.readme&&t.push({key:"root",label:"README",content:this.plugin.readme}),this.plugin?.serverReadme&&t.push({key:"server",label:"Server",content:this.plugin.serverReadme}),this.plugin?.clientReadme&&t.push({key:"client",label:"Client",content:this.plugin.clientReadme}),t}renderReadme(){const t=this.readmeTabs;if(t.length===0)return;const e=t.find(r=>r.key===this.activeReadmeTab)??t[0];return b`
		<div class="readme-section">
			${L(t.length>1,()=>b`
			<div class="readme-tabs">
				${t.map(r=>b`
				<button
					class="readme-tab ${r.key===e.key?"active":""}"
					data-tab=${r.key}
					@click=${this.handleTabClick}
				>
					${r.label}
				</button>
				`)}
			</div>
			`,()=>b`
			<h3>README</h3>
			`)}
			<div class="readme">${ai(this.renderedReadme)}</div>
		</div>
		`}render(){return this.loading?b`<div class="loading">Loading plugin details...</div>`:this.error?b`<div class="alert alert-error">${this.error}</div>`:this.plugin?b`
		<div class="plugin-header">
			<div class="plugin-title-row">
				<h2>${this.plugin.name}</h2>
				${L(this.plugin.latestVersion,()=>b`
				<span class="version-badge">v${this.plugin.latestVersion}</span>
				`)}
			</div>
			${L(this.plugin.author,()=>b`
			<p class="author">by ${this.plugin.author}</p>
			`)}
			${L(this.plugin.description,()=>b`
			<p class="description">${this.plugin.description}</p>
			`)}
			${this.renderTags()}
			<div class="meta-row">
				<span class="meta-item">
					${this.plugin.totalDownloads??0} total downloads
				</span>
				<span class="meta-item">
					${this.plugin.versionCount??this.plugin.versions?.length??0} versions
				</span>
			</div>
		</div>

		${this.renderReadme()}

		<h3>Versions</h3>
		${this.renderVersionsTable()}
		`:b`<div class="empty-state">No plugin selected.</div>`}};te.styles=de`
		:host {
			--color-text: #333;
			--color-text-dark: #222;
			--color-text-body: #444;
			--color-text-muted: #666;
			--color-text-light: #555;
			--color-text-placeholder: #999;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-primary-bg: #e8ebf7;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-border-tabs: #e0e0e0;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-bg-code: #f4f4f4;
			--color-bg-dep: #f0f0f0;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--spacing-xs: 2px;
			--spacing-sm: 4px;
			--spacing-md: 6px;
			--spacing-lg: 8px;
			--spacing-xl: 10px;
			--spacing-2xl: 12px;
			--spacing-3xl: 16px;
			--spacing-4xl: 20px;
			--spacing-5xl: 24px;
			--spacing-6xl: 32px;
			--spacing-7xl: 40px;
			--font-size-xs: 0.9em;
			--font-size-sm: 12px;
			--font-size-base: 13px;
			--font-size-md: 14px;
			--font-family-mono: 'Cascadia Code', 'Fira Code', monospace;
			--radius-xs: 3px;
			--radius-sm: 4px;
			--radius-md: 6px;
			--radius-lg: 8px;
			--radius-pill: 12px;
			--transition-speed: 0.3s;
			contain: strict;
			overflow: hidden;
			overflow-y: auto;
			display: grid;
			grid-auto-rows: max-content;
			padding: var(--spacing-4xl);
		}
		h2 {
			margin: 0;
			color: var(--color-text);
		}
		h3 {
			color: var(--color-text);
			margin: var(--spacing-5xl) 0 var(--spacing-2xl);
		}
		.plugin-header {
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl);
			border-radius: var(--radius-lg);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.plugin-title-row {
			display: flex;
			align-items: center;
			gap: var(--spacing-2xl);
		}
		.version-badge {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-sm) var(--spacing-xl);
			border-radius: var(--radius-pill);
			font-size: var(--font-size-base);
			font-weight: 500;
		}
		.author {
			margin: var(--spacing-sm) 0 0;
			color: var(--color-text-muted);
			font-size: var(--font-size-md);
		}
		.description {
			margin: var(--spacing-2xl) 0 0;
			color: var(--color-text-body);
			line-height: 1.5;
		}
		.tags {
			display: flex;
			gap: var(--spacing-md);
			flex-wrap: wrap;
			margin-top: var(--spacing-2xl);
		}
		.tag {
			background: var(--color-primary-bg);
			color: var(--color-primary);
			padding: var(--spacing-sm) var(--spacing-xl);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-sm);
			font-weight: 500;
		}
		.meta-row {
			display: flex;
			gap: var(--spacing-4xl);
			margin-top: var(--spacing-3xl);
			padding-top: var(--spacing-3xl);
			border-top: 1px solid var(--color-border-light);
		}
		.meta-item {
			font-size: var(--font-size-base);
			color: var(--color-text-muted);
		}
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-lg);
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-2xl);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-2xl);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.dependency-tag {
			display: inline-block;
			background: var(--color-bg-dep);
			padding: var(--spacing-xs) var(--spacing-lg);
			border-radius: var(--radius-xs);
			font-size: var(--font-size-sm);
			margin: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs) 0;
		}
		.no-deps {
			color: var(--color-text-placeholder);
			font-size: var(--font-size-base);
		}
		.loading {
			text-align: center;
			padding: var(--spacing-7xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-7xl);
			color: var(--color-text-placeholder);
		}
		.alert {
			padding: var(--spacing-3xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-4xl);
		}
		.alert-error {
			background: var(--color-alert-error-bg);
			color: var(--color-alert-error-text);
			border: 1px solid var(--color-alert-error-border);
		}
		.btn-small {
			padding: var(--spacing-md) var(--spacing-2xl);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
		}
		.readme-section {
			margin-top: var(--spacing-5xl);
		}
		.readme-tabs {
			display: flex;
			gap: 0;
			border-bottom: 2px solid var(--color-border-tabs);
			margin-bottom: 0;
		}
		.readme-tab {
			padding: var(--spacing-xl) var(--spacing-4xl);
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			margin-bottom: -2px;
			cursor: pointer;
			font-size: var(--font-size-md);
			font-weight: 500;
			color: var(--color-text-muted);
			transition: all 0.2s;
			&:hover {
				color: var(--color-text);
				background: var(--color-bg-muted);
			}
			&.active {
				color: var(--color-primary);
				border-bottom-color: var(--color-primary);
			}
		}
		.readme-tabs + .readme {
			border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		}
		.readme {
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl) var(--spacing-6xl);
			border-radius: var(--radius-lg);
			box-shadow: 0 2px 8px var(--color-shadow);
			line-height: 1.6;
			color: var(--color-text);
			word-wrap: break-word;
			overflow-wrap: break-word;
			& h1,
			& h2,
			& h3,
			& h4 {
				margin: 1.5em 0 0.5em;
				color: var(--color-text-dark);
			}
			& h1:first-child,
			& h2:first-child {
				margin-top: 0;
			}
			& p {
				margin: 0.75em 0;
			}
			& code {
				background: var(--color-bg-code);
				padding: var(--spacing-xs) var(--spacing-md);
				border-radius: var(--radius-xs);
				font-size: var(--font-size-xs);
				font-family: var(--font-family-mono);
			}
			& pre {
				padding: var(--spacing-3xl);
				border-radius: var(--radius-md);
				overflow-x: auto;
				font-size: var(--font-size-base);
				line-height: 1.5;
				& code {
					background: none;
					padding: 0;
					color: inherit;
				}
			}
			& .shiki {
				padding: var(--spacing-3xl);
				border-radius: var(--radius-md);
				overflow-x: auto;
				font-size: var(--font-size-base);
				line-height: 1.5;
				font-family: var(--font-family-mono);
			}
			& ul,
			& ol {
				padding-left: 1.5em;
			}
			& li {
				margin: 0.25em 0;
			}
			& blockquote {
				border-left: 3px solid var(--color-primary);
				margin: 1em 0;
				padding: 0.5em 1em;
				color: var(--color-text-light);
				background: var(--color-bg-muted);
				border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
			}
			& a {
				color: var(--color-primary);
				text-decoration: none;
				&:hover {
					text-decoration: underline;
				}
			}
			& table {
				width: 100%;
				border-collapse: collapse;
				margin: 1em 0;
			}
			& th,
			& td {
				border: 1px solid var(--color-border);
				padding: var(--spacing-lg) var(--spacing-2xl);
				text-align: left;
			}
			& th {
				background: var(--color-bg-muted);
				font-weight: 600;
			}
			& hr {
				border: none;
				border-top: 1px solid var(--color-border-light);
				margin: 1.5em 0;
			}
			& img {
				max-width: 100%;
				height: auto;
				border-radius: var(--radius-sm);
			}
		}
	`;fe([Ur({type:String})],te.prototype,"name",2);fe([P()],te.prototype,"plugin",2);fe([P()],te.prototype,"loading",2);fe([P()],te.prototype,"error",2);fe([P()],te.prototype,"activeReadmeTab",2);fe([P()],te.prototype,"renderedReadme",2);te=fe([he("plugin-detail")],te);var ll=Object.defineProperty,cl=Object.getOwnPropertyDescriptor,Ge=(t,e,r,n)=>{for(var i=n>1?void 0:n?cl(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&ll(e,r,i),i};let ue=class extends pe{constructor(){super(...arguments),this.name="",this.plugins=[],this.loading=!1,this.search="",this.previousName=""}connectedCallback(){super.connectedCallback(),this.previousName=this.name,this.initialize()}scheduleUpdate(){if(this.previousName&&this.name!==this.previousName){const t=this.shadowRoot?.querySelector(".detail-pane");if(t)return t.getAnimations().forEach(e=>e.cancel()),t.animate([{transform:"translateY(0)",opacity:1},{transform:"translateY(20px)",opacity:0}],{duration:180,easing:"ease-in",fill:"forwards"}).finished.then(()=>super.scheduleUpdate())}super.scheduleUpdate()}updated(t){if(!t.has("name")||t.get("name")===void 0&&!this.previousName)return;this.previousName=this.name;const r=this.shadowRoot?.querySelector(".detail-pane");r&&r.animate([{transform:"translateY(-12px)",opacity:0},{transform:"translateY(0)",opacity:1}],{duration:200,easing:"ease-out",fill:"forwards"})}async initialize(){await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const t=await K.getPlugins({search:this.search||void 0,pageSize:100});this.plugins=t.plugins}catch(t){console.error("Failed to load plugins:",t)}finally{this.loading=!1}}handleSearchInput(t){this.search=t.target.value}async handleSearch(t){t?.preventDefault(),await this.loadPlugins()}async selectPlugin(t){await B.navigate(`/explore/${encodeURIComponent(t)}`)}handleSelectPluginClick(t){const{pluginName:e}=le(t,"pluginName");e&&this.selectPlugin(e)}renderPluginList(){return this.loading?b`<div class="loading">Loading...</div>`:this.plugins.length===0?b`<div class="empty-state">No plugins found.</div>`:b`
		<ul class="plugin-list">
			${this.plugins.map(t=>b`
			<li
				class="plugin-list-item ${this.name===t.name?"selected":""}"
				data-plugin-name=${t.name}
				@click=${this.handleSelectPluginClick}
			>
				<div class="plugin-name">${t.name}</div>
				<div class="plugin-meta">
					${L(t.latestVersion,()=>b`
					<span class="plugin-version">v${t.latestVersion}</span>
					`)}
					${L(t.author,()=>b`
					<span class="plugin-author">${t.author}</span>
					`)}
				</div>
			</li>
			`)}
		</ul>
		`}render(){return b`
		<div class="header-bar">
			<h1>Plugin Explorer</h1>
		</div>

		<div class="explorer-layout">
			<div class="list-pane">
				<form class="search-bar" @submit=${this.handleSearch}>
					<input
						type="text"
						class="search-input"
						placeholder="Filter plugins..."
						.value=${this.search}
						@input=${this.handleSearchInput}
					/>
				</form>
				${this.renderPluginList()}
			</div>

			<div class="detail-pane">
				${L(this.name,()=>b`
				<plugin-detail .name=${this.name}></plugin-detail>
				`,()=>b`
				<div class="empty-detail">
					<p>Select a plugin from the list to view its details.</p>
				</div>
				`)}
			</div>
		</div>
		`}};ue.styles=de`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-text-light: #888;
			--color-text-placeholder: #999;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-primary-bg: #e8ebf7;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-border-subtle: #f0f0f0;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-2xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 14px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-rows: auto 1fr;
			padding: var(--spacing-md) var(--spacing-xl);
			max-width: 1400px;
		}
		h1 {
			margin: 0;
			color: var(--color-text);
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-xl);
		}
		.header-actions {
			display: flex;
			gap: var(--spacing-sm);
			align-items: center;
		}
		.explorer-layout {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--spacing-xl);
		}
		.list-pane {
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			overflow: hidden;
			display: flex;
			flex-direction: column;
			margin: var(--spacing-sm);
		}
		.search-bar {
			padding: var(--spacing-md);
			border-bottom: 1px solid var(--color-border-light);
		}
		.search-input {
			width: 100%;
			padding: var(--spacing-sm) var(--spacing-md);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-base);
			box-sizing: border-box;
			transition: border-color var(--transition-speed);
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}
		.plugin-list {
			list-style: none;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			flex: 1;
		}
		.plugin-list-item {
			padding: var(--spacing-md) var(--spacing-lg);
			border-bottom: 1px solid var(--color-border-subtle);
			cursor: pointer;
			transition: background 0.2s;
			&:hover {
				background: var(--color-bg-muted);
			}
			&.selected {
				background: var(--color-primary-bg);
				border-left: 3px solid var(--color-primary);
			}
		}
		.plugin-name {
			font-weight: 600;
			color: var(--color-text);
			margin-bottom: var(--spacing-xs);
		}
		.plugin-meta {
			display: flex;
			gap: var(--spacing-md);
			font-size: var(--font-size-sm);
			color: var(--color-text-light);
		}
		.plugin-version {
			color: var(--color-primary);
			font-weight: 500;
		}
		.detail-pane {
			display: grid;
			overflow-y: auto;
			margin: var(--spacing-sm);
			& plugin-detail {
				padding: 0;
				max-width: none;
				margin: 0;
			}
		}
		.loading {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.empty-detail {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			color: var(--color-text-placeholder);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-lg);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
			text-decoration: none;
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
		}
		.btn-secondary {
			background: var(--color-secondary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-secondary-hover);
			}
		}
	`;Ge([Ur({type:String})],ue.prototype,"name",2);Ge([P()],ue.prototype,"plugins",2);Ge([P()],ue.prototype,"loading",2);Ge([P()],ue.prototype,"search",2);ue=Ge([he("plugin-explorer")],ue);var ul=Object.defineProperty,dl=Object.getOwnPropertyDescriptor,ne=(t,e,r,n)=>{for(var i=n>1?void 0:n?dl(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&ul(e,r,i),i};const pl=["upload","storage"];function hl(t){return pl.includes(t)}let X=class extends pe{constructor(){super(...arguments),this.activeTab="upload",this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.accessMode="private",this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){const t=await dt.getConfig();this.accessMode=t.accessMode,this.currentUser=await j.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const t=await K.getPlugins();this.plugins=t.plugins}catch(t){console.error("Failed to load plugins:",t)}finally{this.loading=!1}}get isAuthenticated(){return!!this.currentUser}handleTabClick(t){const{tab:e}=le(t,"tab");e&&hl(e)&&(this.activeTab=e)}renderUploadTab(){return b`
		<h2>Upload Plugin Package</h2>

		${L(this.uploadStatus,()=>b`
		<div class="alert alert-success">${this.uploadStatus}</div>
		`)}
		${L(this.uploadError,()=>b`
		<div class="alert alert-error">${this.uploadError}</div>
		`)}

		<div class="upload-form">
			<div class="form-group">
				<label for="plugin-file">Select .pivotpkg file</label>
				<input
					type="file"
					id="plugin-file"
					accept=".pivotpkg"
					?disabled=${this.uploadProgress}
					@change=${this.handleFileSelect}
				/>
			</div>

			${L(this.uploadProgress,()=>b`
			<div class="upload-progress">Uploading...</div>
			`)}

			<div class="form-actions">
				<button
					class="btn btn-primary"
					@click=${this.handleUpload}
					?disabled=${this.uploadProgress}
				>
					Upload Plugin
				</button>
			</div>
		</div>
		`}handleFileSelect(t){const e=t.target;this.selectedFile=e.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const t=await K.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${t.plugin} v${t.version}`,this.selectedFile=null;const e=this.shadowRoot?.querySelector("#plugin-file");e&&(e.value=""),await this.loadPlugins()}catch(t){this.uploadError=t instanceof Error?t.message:"Upload failed"}finally{this.uploadProgress=!1}}renderStorageTab(){const t=this.plugins.length,e=this.plugins.reduce((n,i)=>n+(i.versionCount??0),0),r=this.plugins.reduce((n,i)=>n+(i.totalDownloads??0),0);return b`
		<h2>Storage Information</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<h3>Total Plugins</h3>
				<p class="stat-value">${t}</p>
			</div>
			<div class="stat-card">
				<h3>Total Versions</h3>
				<p class="stat-value">${e}</p>
			</div>
			<div class="stat-card">
				<h3>Total Downloads</h3>
				<p class="stat-value">${r}</p>
			</div>
		</div>
		`}render(){return b`
		<div class="header-bar">
			<h1>Registry Manager</h1>
		</div>

		<nav class="nav-cards">
			<router-link to="/browse" class="nav-card">
				<h3>Browse Plugins</h3>
				<p>Search and discover available plugins in the registry.</p>
			</router-link>
			<router-link to="/explore" class="nav-card">
				<h3>Plugin Explorer</h3>
				<p>Browse plugins with a side-by-side list and detail view.</p>
			</router-link>
			${L(this.isAuthenticated,()=>b`
			<router-link to="/admin" class="nav-card">
				<h3>Plugin Admin</h3>
				<p>Manage your plugins, upload new versions, and view statistics.</p>
			</router-link>
			`)}
		</nav>

		${L(this.isAuthenticated,()=>b`
		<div class="tabs">
			<button
				class=${this.activeTab==="upload"?"active":""}
				data-tab="upload"
				@click=${this.handleTabClick}
			>
				Upload Plugin
			</button>
			<button
				class=${this.activeTab==="storage"?"active":""}
				data-tab="storage"
				@click=${this.handleTabClick}
			>
				Storage Info
			</button>
		</div>

		<div class="tab-content">
			${L(this.activeTab==="upload",()=>this.renderUploadTab(),()=>this.renderStorageTab())}
		</div>
		`)}
		`}};X.styles=de`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-danger: #dc3545;
			--color-danger-hover: #c82333;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--color-shadow-hover: rgba(0, 0, 0, 0.15);
			--color-alert-success-bg: #d4edda;
			--color-alert-success-text: #155724;
			--color-alert-success-border: #c3e6cb;
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--color-alert-info-bg: #d1ecf1;
			--color-alert-info-text: #0c5460;
			--color-alert-info-border: #bee5eb;
			--spacing-sm: 8px;
			--spacing-md: 10px;
			--spacing-lg: 12px;
			--spacing-xl: 16px;
			--spacing-2xl: 20px;
			--spacing-3xl: 24px;
			--spacing-4xl: 30px;
			--spacing-5xl: 32px;
			--spacing-6xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 14px;
			--font-size-lg: 32px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-2xl);
			max-width: 1400px;
		}
		h1 {
			margin: 0 0 var(--spacing-2xl) 0;
			color: var(--color-text);
		}
		.tabs {
			display: flex;
			gap: var(--spacing-md);
			margin-bottom: var(--spacing-2xl);
			border-bottom: 2px solid var(--color-border-light);
			& button {
				padding: var(--spacing-lg) var(--spacing-3xl);
				border: none;
				background: none;
				cursor: pointer;
				font-size: var(--font-size-base);
				font-weight: 500;
				color: var(--color-text-muted);
				border-bottom: 3px solid transparent;
				transition: all var(--transition-speed);
				&:hover {
					color: var(--color-text);
				}
				&.active {
					color: var(--color-primary);
					border-bottom-color: var(--color-primary);
				}
			}
		}
		.nav-cards {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: var(--spacing-xl);
			margin-bottom: var(--spacing-5xl);
		}
		.nav-card {
			display: block;
			background: var(--color-bg-surface);
			padding: var(--spacing-3xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			text-decoration: none;
			color: inherit;
			transition: box-shadow var(--transition-speed), transform 0.2s;
			cursor: pointer;
			&:hover {
				box-shadow: 0 4px 16px var(--color-shadow-hover);
				transform: translateY(-2px);
			}
			& h3 {
				margin: 0 0 var(--spacing-sm);
				color: var(--color-primary);
			}
			& p {
				margin: 0;
				color: var(--color-text-muted);
				font-size: var(--font-size-base);
			}
		}
		.tab-content {
			padding: var(--spacing-2xl) 0;
		}
		.loading {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
		}
		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-md);
			overflow: hidden;
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-lg);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-lg);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.btn-small {
			padding: 6px var(--spacing-lg);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
		}
		.btn-danger {
			background: var(--color-danger);
			color: white;
			&:hover {
				background: var(--color-danger-hover);
			}
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--spacing-2xl);
			margin-top: var(--spacing-2xl);
		}
		.stat-card {
			background: var(--color-bg-surface);
			padding: var(--spacing-2xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			& h3 {
				margin: 0 0 var(--spacing-md) 0;
				font-size: var(--font-size-base);
				color: var(--color-text-muted);
				font-weight: 500;
			}
		}
		.stat-value {
			font-size: var(--font-size-lg);
			font-weight: 700;
			color: var(--color-primary);
			margin: 0;
		}
		.alert {
			padding: var(--spacing-xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-2xl);
		}
		.alert-info {
			background: var(--color-alert-info-bg);
			color: var(--color-alert-info-text);
			border: 1px solid var(--color-alert-info-border);
		}
		.alert-success {
			background: var(--color-alert-success-bg);
			color: var(--color-alert-success-text);
			border: 1px solid var(--color-alert-success-border);
		}
		.alert-error {
			background: var(--color-alert-error-bg);
			color: var(--color-alert-error-text);
			border: 1px solid var(--color-alert-error-border);
		}
		.upload-form {
			max-width: 600px;
			background: var(--color-bg-surface);
			padding: var(--spacing-4xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.form-group {
			margin-bottom: var(--spacing-2xl);
			& label {
				display: block;
				margin-bottom: var(--spacing-sm);
				font-weight: 500;
				color: var(--color-text);
			}
			& input[type='file'] {
				width: 100%;
				padding: var(--spacing-md);
				border: 2px dashed var(--color-border);
				border-radius: var(--radius-sm);
				cursor: pointer;
				transition: all var(--transition-speed);
				&:hover:not(:disabled) {
					border-color: var(--color-primary);
				}
				&:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
			}
		}
		.upload-progress {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-primary);
			font-weight: 500;
		}
		.form-actions {
			margin-top: var(--spacing-2xl);
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-lg) var(--spacing-3xl);
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-2xl);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-xl);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
		}
		.btn-secondary {
			background: var(--color-secondary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-secondary-hover);
			}
		}
	`;ne([P()],X.prototype,"activeTab",2);ne([P()],X.prototype,"plugins",2);ne([P()],X.prototype,"loading",2);ne([P()],X.prototype,"currentUser",2);ne([P()],X.prototype,"uploadStatus",2);ne([P()],X.prototype,"uploadError",2);ne([P()],X.prototype,"uploadProgress",2);ne([P()],X.prototype,"accessMode",2);X=ne([he("registry-manager")],X);const Ae={enter:t=>new Promise(e=>{const r=t.animate([{transform:"translateX(-30px)",opacity:0},{transform:"translateX(0)",opacity:1}],{duration:200,easing:"ease-out",fill:"forwards"});r.onfinish=()=>e()}),exit:t=>new Promise(e=>{const r=t.animate([{transform:"translateX(0)",opacity:1},{transform:"translateX(30px)",opacity:0}],{duration:150,easing:"ease-in"});r.onfinish=()=>e()})},gl=async()=>await dt.isPublic()||await j.isAuthenticated()?!0:(window.location.href="/login",!1),ml=async()=>await j.isAuthenticated()?!0:(window.location.href="/login",!1),fl=[{path:"/",name:"layout",template:()=>b`<app-layout></app-layout>`,beforeEnter:gl,children:[ve({path:"",name:"dashboard",template:()=>b`<registry-manager></registry-manager>`,animation:Ae}),ve({path:"browse",name:"browse",template:()=>b`<plugin-browse></plugin-browse>`,animation:Ae}),ve({path:"plugin/:name",name:"plugin-detail",template:t=>b`<plugin-detail .name=${t.name}></plugin-detail>`,animation:Ae}),ve({path:"explore/:name?",name:"explore",template:t=>b`<plugin-explorer .name=${t.name??""}></plugin-explorer>`,animation:Ae}),ve({path:"admin",name:"admin",template:()=>b`<plugin-admin></plugin-admin>`,beforeEnter:ml,animation:Ae}),ve({path:"(.*)",name:"fallback",redirect:"/"})]}];var _l=Object.defineProperty,vl=Object.getOwnPropertyDescriptor,Hn=(t,e,r,n)=>{for(var i=n>1?void 0:n?vl(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(i=(n?a(e,r,i):a(i))||i);return n&&i&&_l(e,r,i),i};let ut=class extends pe{constructor(){super(...arguments),this.isInitialized=!1}connectedCallback(){super.connectedCallback(),B.setRoutes(fl),j.onAuthenticationStateChanged(()=>this.handleAuthChange()),this.initialize()}async initialize(){await dt.getConfig(),this.isInitialized=!0,await B.navigate(window.location.pathname)}disconnectedCallback(){super.disconnectedCallback(),B.dispose()}async handleAuthChange(){if(!await j.isAuthenticated()){window.location.href="/login";return}await B.navigate(window.location.pathname)}render(){return this.isInitialized?b`<router-outlet></router-outlet>`:b`<div class="loading-screen">Loading...</div>`}};ut.styles=de`
		:host {
			--color-text-muted: #666;
			--font-size-lg: 18px;
			display: grid;
			min-height: 100vh;
		}
		.loading-screen {
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			font-size: var(--font-size-lg);
			color: var(--color-text-muted);
		}
	`;Hn([P()],ut.prototype,"isInitialized",2);ut=Hn([he("app-root")],ut);
