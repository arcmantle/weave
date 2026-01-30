(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const n of o.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function e(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(i){if(i.ep)return;i.ep=!0;const o=e(i);fetch(i.href,o)}})();const N=globalThis,q=N.ShadowRoot&&(N.ShadyCSS===void 0||N.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,K=Symbol(),tt=new WeakMap;let dt=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==K)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(q&&t===void 0){const s=e!==void 0&&e.length===1;s&&(t=tt.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&tt.set(e,t))}return t}toString(){return this.cssText}};const $t=r=>new dt(typeof r=="string"?r:r+"",void 0,K),J=(r,...t)=>{const e=r.length===1?r[0]:t.reduce((s,i,o)=>s+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+r[o+1],r[0]);return new dt(e,r,K)},bt=(r,t)=>{if(q)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const s=document.createElement("style"),i=N.litNonce;i!==void 0&&s.setAttribute("nonce",i),s.textContent=e.cssText,r.appendChild(s)}},et=q?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return $t(e)})(r):r;const{is:mt,defineProperty:yt,getOwnPropertyDescriptor:vt,getOwnPropertyNames:_t,getOwnPropertySymbols:wt,getPrototypeOf:At}=Object,j=globalThis,st=j.trustedTypes,xt=st?st.emptyScript:"",Pt=j.reactiveElementPolyfillSupport,O=(r,t)=>r,D={toAttribute(r,t){switch(t){case Boolean:r=r?xt:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Z=(r,t)=>!mt(r,t),it={attribute:!0,type:String,converter:D,reflect:!1,useDefault:!1,hasChanged:Z};Symbol.metadata??=Symbol("metadata"),j.litPropertyMetadata??=new WeakMap;let P=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=it){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);i!==void 0&&yt(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:o}=vt(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:i,set(n){const l=i?.call(this);o?.call(this,n),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??it}static _$Ei(){if(this.hasOwnProperty(O("elementProperties")))return;const t=At(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(O("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(O("properties"))){const e=this.properties,s=[..._t(e),...wt(e)];for(const i of s)this.createProperty(i,e[i])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[s,i]of e)this.elementProperties.set(s,i)}this._$Eh=new Map;for(const[e,s]of this.elementProperties){const i=this._$Eu(e,s);i!==void 0&&this._$Eh.set(i,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const i of s)e.unshift(et(i))}else t!==void 0&&e.push(et(t));return e}static _$Eu(t,e){const s=e.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return bt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(i!==void 0&&s.reflect===!0){const o=(s.converter?.toAttribute!==void 0?s.converter:D).toAttribute(e,s.type);this._$Em=t,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(i!==void 0&&this._$Em!==i){const o=s.getPropertyOptions(i),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:D;this._$Em=i;const l=n.fromAttribute(e,o.type);this[i]=l??this._$Ej?.get(i)??l,this._$Em=null}}requestUpdate(t,e,s,i=!1,o){if(t!==void 0){const n=this.constructor;if(i===!1&&(o=this[t]),s??=n.getPropertyOptions(t),!((s.hasChanged??Z)(o,e)||s.useDefault&&s.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,s))))return;this.C(t,e,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:o},n){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),o!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),i===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[i,o]of this._$Ep)this[i]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,o]of s){const{wrapped:n}=o,l=this[i];n!==!0||this._$AL.has(i)||l===void 0||this.C(i,void 0,o,l)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};P.elementStyles=[],P.shadowRootOptions={mode:"open"},P[O("elementProperties")]=new Map,P[O("finalized")]=new Map,Pt?.({ReactiveElement:P}),(j.reactiveElementVersions??=[]).push("2.1.2");const G=globalThis,rt=r=>r,H=G.trustedTypes,ot=H?H.createPolicy("lit-html",{createHTML:r=>r}):void 0,ut="$lit$",y=`lit$${Math.random().toFixed(9).slice(2)}$`,pt="?"+y,St=`<${pt}>`,x=document,k=()=>x.createComment(""),L=r=>r===null||typeof r!="object"&&typeof r!="function",Q=Array.isArray,Et=r=>Q(r)||typeof r?.[Symbol.iterator]=="function",V=`[ 	
\f\r]`,T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,nt=/-->/g,at=/>/g,_=RegExp(`>|${V}(?:([^\\s"'>=/]+)(${V}*=${V}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),lt=/'/g,ht=/"/g,gt=/^(?:script|style|textarea|title)$/i,Ct=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),p=Ct(1),S=Symbol.for("lit-noChange"),d=Symbol.for("lit-nothing"),ct=new WeakMap,w=x.createTreeWalker(x,129);function ft(r,t){if(!Q(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return ot!==void 0?ot.createHTML(t):t}const Ut=(r,t)=>{const e=r.length-1,s=[];let i,o=t===2?"<svg>":t===3?"<math>":"",n=T;for(let l=0;l<e;l++){const a=r[l];let c,u,h=-1,b=0;for(;b<a.length&&(n.lastIndex=b,u=n.exec(a),u!==null);)b=n.lastIndex,n===T?u[1]==="!--"?n=nt:u[1]!==void 0?n=at:u[2]!==void 0?(gt.test(u[2])&&(i=RegExp("</"+u[2],"g")),n=_):u[3]!==void 0&&(n=_):n===_?u[0]===">"?(n=i??T,h=-1):u[1]===void 0?h=-2:(h=n.lastIndex-u[2].length,c=u[1],n=u[3]===void 0?_:u[3]==='"'?ht:lt):n===ht||n===lt?n=_:n===nt||n===at?n=T:(n=_,i=void 0);const m=n===_&&r[l+1].startsWith("/>")?" ":"";o+=n===T?a+St:h>=0?(s.push(c),a.slice(0,h)+ut+a.slice(h)+y+m):a+y+(h===-2?l:m)}return[ft(r,o+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class M{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let o=0,n=0;const l=t.length-1,a=this.parts,[c,u]=Ut(t,e);if(this.el=M.createElement(c,s),w.currentNode=this.el.content,e===2||e===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(i=w.nextNode())!==null&&a.length<l;){if(i.nodeType===1){if(i.hasAttributes())for(const h of i.getAttributeNames())if(h.endsWith(ut)){const b=u[n++],m=i.getAttribute(h).split(y),z=/([.?@])?(.*)/.exec(b);a.push({type:1,index:o,name:z[2],strings:m,ctor:z[1]==="."?Ot:z[1]==="?"?kt:z[1]==="@"?Lt:I}),i.removeAttribute(h)}else h.startsWith(y)&&(a.push({type:6,index:o}),i.removeAttribute(h));if(gt.test(i.tagName)){const h=i.textContent.split(y),b=h.length-1;if(b>0){i.textContent=H?H.emptyScript:"";for(let m=0;m<b;m++)i.append(h[m],k()),w.nextNode(),a.push({type:2,index:++o});i.append(h[b],k())}}}else if(i.nodeType===8)if(i.data===pt)a.push({type:2,index:o});else{let h=-1;for(;(h=i.data.indexOf(y,h+1))!==-1;)a.push({type:7,index:o}),h+=y.length-1}o++}}static createElement(t,e){const s=x.createElement("template");return s.innerHTML=t,s}}function E(r,t,e=r,s){if(t===S)return t;let i=s!==void 0?e._$Co?.[s]:e._$Cl;const o=L(t)?void 0:t._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),o===void 0?i=void 0:(i=new o(r),i._$AT(r,e,s)),s!==void 0?(e._$Co??=[])[s]=i:e._$Cl=i),i!==void 0&&(t=E(r,i._$AS(r,t.values),i,s)),t}class Tt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??x).importNode(e,!0);w.currentNode=i;let o=w.nextNode(),n=0,l=0,a=s[0];for(;a!==void 0;){if(n===a.index){let c;a.type===2?c=new R(o,o.nextSibling,this,t):a.type===1?c=new a.ctor(o,a.name,a.strings,this,t):a.type===6&&(c=new Mt(o,this,t)),this._$AV.push(c),a=s[++l]}n!==a?.index&&(o=w.nextNode(),n++)}return w.currentNode=x,i}p(t){let e=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class R{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=d,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=E(this,t,e),L(t)?t===d||t==null||t===""?(this._$AH!==d&&this._$AR(),this._$AH=d):t!==this._$AH&&t!==S&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Et(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==d&&L(this._$AH)?this._$AA.nextSibling.data=t:this.T(x.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=M.createElement(ft(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const o=new Tt(i,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=ct.get(t.strings);return e===void 0&&ct.set(t.strings,e=new M(t)),e}k(t){Q(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const o of t)i===e.length?e.push(s=new R(this.O(k()),this.O(k()),this,this.options)):s=e[i],s._$AI(o),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const s=rt(t).nextSibling;rt(t).remove(),t=s}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class I{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,o){this.type=1,this._$AH=d,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=o,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=d}_$AI(t,e=this,s,i){const o=this.strings;let n=!1;if(o===void 0)t=E(this,t,e,0),n=!L(t)||t!==this._$AH&&t!==S,n&&(this._$AH=t);else{const l=t;let a,c;for(t=o[0],a=0;a<o.length-1;a++)c=E(this,l[s+a],e,a),c===S&&(c=this._$AH[a]),n||=!L(c)||c!==this._$AH[a],c===d?t=d:t!==d&&(t+=(c??"")+o[a+1]),this._$AH[a]=c}n&&!i&&this.j(t)}j(t){t===d?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Ot extends I{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===d?void 0:t}}class kt extends I{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==d)}}class Lt extends I{constructor(t,e,s,i,o){super(t,e,s,i,o),this.type=5}_$AI(t,e=this){if((t=E(this,t,e,0)??d)===S)return;const s=this._$AH,i=t===d&&s!==d||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,o=t!==d&&(s===d||i);i&&this.element.removeEventListener(this.name,this,s),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class Mt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){E(this,t)}}const Rt=G.litHtmlPolyfillSupport;Rt?.(M,R),(G.litHtmlVersions??=[]).push("3.3.2");const zt=(r,t,e)=>{const s=e?.renderBefore??t;let i=s._$litPart$;if(i===void 0){const o=e?.renderBefore??null;s._$litPart$=i=new R(t.insertBefore(k(),o),o,void 0,e??{})}return i._$AI(r),i};const X=globalThis;class A extends P{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=zt(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return S}}A._$litElement$=!0,A.finalized=!0,X.litElementHydrateSupport?.({LitElement:A});const Nt=X.litElementPolyfillSupport;Nt?.({LitElement:A});(X.litElementVersions??=[]).push("4.2.2");const Y=r=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(r,t)}):customElements.define(r,t)};const Dt={attribute:!0,type:String,converter:D,reflect:!1,hasChanged:Z},Ht=(r=Dt,t,e)=>{const{kind:s,metadata:i}=e;let o=globalThis.litPropertyMetadata.get(i);if(o===void 0&&globalThis.litPropertyMetadata.set(i,o=new Map),s==="setter"&&((r=Object.create(r)).wrapped=!0),o.set(e.name,r),s==="accessor"){const{name:n}=e;return{set(l){const a=t.get.call(this);t.set.call(this,l),this.requestUpdate(n,a,r,!0,l)},init(l){return l!==void 0&&this.C(n,void 0,r,l),l}}}if(s==="setter"){const{name:n}=e;return function(l){const a=this[n];t.call(this,l),this.requestUpdate(n,a,r,!0,l)}}throw Error("Unsupported decorator location: "+s)};function jt(r){return(t,e)=>typeof e=="object"?Ht(r,t,e):((s,i,o)=>{const n=i.hasOwnProperty(o);return i.constructor.createProperty(o,s),n?Object.getOwnPropertyDescriptor(i,o):void 0})(r,t,e)}function g(r){return jt({...r,state:!0,attribute:!1})}class It{constructor(){this.currentUser=null,this.listeners=new Set,this.isRefreshing=!1,this.refreshPromise=null}async getCurrentUser(){if(this.currentUser===null)try{const t=await fetch("/api/auth/me",{credentials:"include"});if(t.ok){const e=await t.json();this.currentUser=e.username}else this.currentUser=null}catch(t){console.error("[AuthService] Not authenticated (exception):",t),this.currentUser=null}return this.currentUser}async login(t){if(!t.trim())return{success:!1,error:"Username cannot be empty"};try{const e=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:t.trim()})});if(e.ok){const s=await e.json();return this.currentUser=s.username,this.notifyListeners(),{success:!0}}else return{success:!1,error:await e.text()}}catch(e){return{success:!1,error:e instanceof Error?e.message:"Unknown error"}}}async logout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"include"})}catch{}this.currentUser=null,this.notifyListeners()}async isAuthenticated(){return!!await this.getCurrentUser()}onAuthenticationStateChanged(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notifyListeners(){this.listeners.forEach(t=>t())}async refreshToken(){if(this.isRefreshing)return this.refreshPromise??!1;this.isRefreshing=!0,this.refreshPromise=this.performRefresh();try{return await this.refreshPromise}finally{this.isRefreshing=!1,this.refreshPromise=null}}async performRefresh(){try{const t=await fetch("/api/auth/refresh",{method:"POST",credentials:"include"});if(t.ok){const e=await t.json();return this.currentUser=e.username,this.notifyListeners(),!0}else return this.currentUser=null,this.notifyListeners(),!1}catch(t){return console.error("[AuthService] Token refresh failed:",t),this.currentUser=null,this.notifyListeners(),!1}}async fetchWithAuth(t,e={}){const s={...e,credentials:"include"};let i=await fetch(t,s);return i.status===401&&await this.refreshToken()&&(i=await fetch(t,s)),i}}const f=new It;var Ft=Object.defineProperty,Bt=Object.getOwnPropertyDescriptor,F=(r,t,e,s)=>{for(var i=s>1?void 0:s?Bt(t,e):t,o=r.length-1,n;o>=0;o--)(n=r[o])&&(i=(s?n(t,e,i):n(i))||i);return s&&i&&Ft(t,e,i),i};let C=class extends A{constructor(){super(...arguments),this.username="",this.errorMessage="",this.isLoggingIn=!1}async handleLogin(){if(this.errorMessage="",!this.username.trim()){this.errorMessage="Please enter a username";return}try{this.isLoggingIn=!0;const r=await f.login(this.username.trim());r.success?this.dispatchEvent(new CustomEvent("login-success",{bubbles:!0,composed:!0})):this.errorMessage=r.error??"Login failed"}catch(r){this.errorMessage=`Login failed: ${r instanceof Error?r.message:"Unknown error"}`}finally{this.isLoggingIn=!1}}handleKeyPress(r){r.key==="Enter"&&this.handleLogin()}render(){return p`
			<div class="login-container">
				<div class="login-box">
					<h1>Pivot Registry Login</h1>
					<p class="login-subtitle">Enter your username to continue</p>

					${this.errorMessage?p`<div class="alert alert-danger">${this.errorMessage}</div>`:""}

					<div class="login-form">
						<div class="form-group">
							<label for="username">Username</label>
							<input
								id="username"
								type="text"
								class="form-control"
								.value=${this.username}
								@input=${r=>{this.username=r.target.value}}
								@keypress=${this.handleKeyPress}
								placeholder="Enter your username"
								autofocus
							/>
						</div>

						<button
							class="btn btn-primary"
							@click=${this.handleLogin}
							?disabled=${this.isLoggingIn}
						>
							${this.isLoggingIn?"Logging in...":"Login"}
						</button>
					</div>
				</div>
			</div>
		`}};C.styles=J`
		:host {
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		}

		.login-container {
			width: 100%;
			max-width: 400px;
			padding: 20px;
		}

		.login-box {
			background: white;
			border-radius: 8px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
			padding: 40px;
		}

		h1 {
			margin: 0 0 10px 0;
			color: #333;
			font-size: 28px;
			text-align: center;
		}

		.login-subtitle {
			color: #666;
			text-align: center;
			margin-bottom: 30px;
			font-size: 14px;
		}

		.alert {
			padding: 12px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-danger {
			background-color: #fee;
			color: #c33;
			border: 1px solid #fcc;
		}

		.form-group {
			margin-bottom: 20px;
		}

		label {
			display: block;
			margin-bottom: 8px;
			color: #333;
			font-weight: 500;
		}

		.form-control {
			width: 100%;
			padding: 12px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			box-sizing: border-box;
			transition: border-color 0.3s;
		}

		.form-control:focus {
			outline: none;
			border-color: #667eea;
		}

		.btn {
			width: 100%;
			padding: 12px;
			border: none;
			border-radius: 4px;
			font-size: 16px;
			font-weight: 500;
			cursor: pointer;
			transition: background-color 0.3s;
		}

		.btn-primary {
			background-color: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background-color: #5568d3;
		}

		.btn:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`;F([g()],C.prototype,"username",2);F([g()],C.prototype,"errorMessage",2);F([g()],C.prototype,"isLoggingIn",2);C=F([Y("login-page")],C);class Vt{async getPlugins(t){const e=new URLSearchParams;t?.search&&e.set("search",t.search),t?.tag&&e.set("tag",t.tag),t?.page&&e.set("page",t.page.toString()),t?.pageSize&&e.set("pageSize",t.pageSize.toString());const s=`/api/plugins${e.toString()?"?"+e.toString():""}`,i=await f.fetchWithAuth(s);if(!i.ok)throw new Error(`Failed to fetch plugins: ${i.statusText}`);return await i.json()}async getPlugin(t){const e=await f.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}`);if(!e.ok)throw new Error(`Failed to fetch plugin: ${e.statusText}`);return await e.json()}async deleteVersion(t,e){const s=await f.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}/versions/${encodeURIComponent(e)}`,{method:"DELETE"});if(!s.ok)throw new Error(`Failed to delete plugin version: ${s.statusText}`)}async downloadPlugin(t,e){const s=await f.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}/versions/${encodeURIComponent(e)}/download`);if(!s.ok)throw new Error(`Failed to download plugin: ${s.statusText}`);return await s.blob()}async uploadPlugin(t){const e=new FormData;e.append("file",t);const s=await f.fetchWithAuth("/api/plugins/upload",{method:"POST",body:e});if(!s.ok){const i=await s.json();throw new Error(i.error||`Failed to upload plugin: ${s.statusText}`)}return await s.json()}}const W=new Vt;var Wt=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,v=(r,t,e,s)=>{for(var i=s>1?void 0:s?qt(t,e):t,o=r.length-1,n;o>=0;o--)(n=r[o])&&(i=(s?n(t,e,i):n(i))||i);return s&&i&&Wt(t,e,i),i};let $=class extends A{constructor(){super(...arguments),this.activeTab="browse",this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){this.currentUser=await f.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const r=await W.getPlugins();this.plugins=r.plugins}catch(r){console.error("Failed to load plugins:",r)}finally{this.loading=!1}}async deleteVersion(r,t){if(confirm(`Delete ${r} version ${t}?`))try{await W.deleteVersion(r,t),await this.loadPlugins()}catch(e){console.error("Failed to delete version:",e),alert("Failed to delete plugin version")}}formatFileSize(r){const t=["B","KB","MB","GB"];let e=r,s=0;for(;e>=1024&&s<t.length-1;)s++,e=e/1024;return`${e.toFixed(2)} ${t[s]}`}formatDate(r){return new Date(r).toLocaleString()}async handleLogout(){await f.logout(),this.dispatchEvent(new CustomEvent("logout",{bubbles:!0,composed:!0}))}renderBrowseTab(){return this.loading?p`<div class="loading">Loading...</div>`:this.plugins.length===0?p`<p>No plugins in registry.</p>`:p`
			<h2>Available Plugins</h2>
			<table class="plugins-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Latest Version</th>
						<th>Author</th>
						<th>Description</th>
						<th>Total Downloads</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					${this.plugins.map(r=>p`
							<tr>
								<td><strong>${r.name}</strong></td>
								<td>${r.latestVersion??"N/A"}</td>
								<td>${r.author??""}</td>
								<td>${r.description??""}</td>
								<td>${r.totalDownloads??0}</td>
								<td>
									<button
										class="btn-small btn-primary"
										@click=${()=>this.viewPluginDetails(r.name)}
									>
										View Details
									</button>
								</td>
							</tr>
						`)}
				</tbody>
			</table>
		`}async viewPluginDetails(r){console.log("View details for:",r)}renderUploadTab(){return p`
			<h2>Upload Plugin Package</h2>

			${this.uploadStatus?p`<div class="alert alert-success">${this.uploadStatus}</div>`:""}
			${this.uploadError?p`<div class="alert alert-error">${this.uploadError}</div>`:""}

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

				${this.uploadProgress?p`<div class="upload-progress">Uploading...</div>`:""}

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
		`}handleFileSelect(r){const t=r.target;this.selectedFile=t.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const r=await W.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${r.plugin} v${r.version}`,this.selectedFile=null;const t=this.shadowRoot?.querySelector("#plugin-file");t&&(t.value=""),await this.loadPlugins()}catch(r){this.uploadError=r instanceof Error?r.message:"Upload failed"}finally{this.uploadProgress=!1}}renderStorageTab(){const r=this.plugins.length,t=this.plugins.reduce((s,i)=>s+(i.versionCount??0),0),e=this.plugins.reduce((s,i)=>s+(i.totalDownloads??0),0);return p`
			<h2>Storage Information</h2>
			<div class="stats-grid">
				<div class="stat-card">
					<h3>Total Plugins</h3>
					<p class="stat-value">${r}</p>
				</div>
				<div class="stat-card">
					<h3>Total Versions</h3>
					<p class="stat-value">${t}</p>
				</div>
				<div class="stat-card">
					<h3>Total Downloads</h3>
					<p class="stat-value">${e}</p>
				</div>
			</div>
		`}render(){return p`
			<div class="header-bar">
				<h1>Registry Manager</h1>
				<button class="btn btn-secondary" @click=${this.handleLogout}>
					Logout (${this.currentUser})
				</button>
			</div>

			<div class="tabs">
				<button
					class=${this.activeTab==="browse"?"active":""}
					@click=${()=>this.activeTab="browse"}
				>
					Browse Plugins
				</button>
				<button
					class=${this.activeTab==="upload"?"active":""}
					@click=${()=>this.activeTab="upload"}
				>
					Upload Plugin
				</button>
				<button
					class=${this.activeTab==="storage"?"active":""}
					@click=${()=>this.activeTab="storage"}
				>
					Storage Info
				</button>
			</div>

			<div class="tab-content">
				${this.activeTab==="browse"?this.renderBrowseTab():this.activeTab==="upload"?this.renderUploadTab():this.renderStorageTab()}
			</div>
		`}};$.styles=J`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
			margin: 0 auto;
		}

		h1 {
			margin: 0 0 20px 0;
			color: #333;
		}

		.tabs {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
			border-bottom: 2px solid #eee;
		}

		.tabs button {
			padding: 12px 24px;
			border: none;
			background: none;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			color: #666;
			border-bottom: 3px solid transparent;
			transition: all 0.3s;
		}

		.tabs button:hover {
			color: #333;
		}

		.tabs button.active {
			color: #667eea;
			border-bottom-color: #667eea;
		}

		.tab-content {
			padding: 20px 0;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: white;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			border-radius: 8px;
			overflow: hidden;
		}

		.plugins-table thead {
			background: #f8f9fa;
		}

		.plugins-table th {
			padding: 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.plugins-table td {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.plugins-table tbody tr:hover {
			background: #f8f9fa;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.btn-danger {
			background: #dc3545;
			color: white;
		}

		.btn-danger:hover {
			background: #c82333;
		}

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-top: 20px;
		}

		.stat-card {
			background: white;
			padding: 20px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.stat-card h3 {
			margin: 0 0 10px 0;
			font-size: 14px;
			color: #666;
			font-weight: 500;
		}

		.stat-value {
			font-size: 32px;
			font-weight: 700;
			color: #667eea;
			margin: 0;
		}

		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-info {
			background: #d1ecf1;
			color: #0c5460;
			border: 1px solid #bee5eb;
		}

		.alert-success {
			background: #d4edda;
			color: #155724;
			border: 1px solid #c3e6cb;
		}

		.alert-error {
			background: #f8d7da;
			color: #721c24;
			border: 1px solid #f5c6cb;
		}

		.upload-form {
			max-width: 600px;
			background: white;
			padding: 30px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.form-group {
			margin-bottom: 20px;
		}

		.form-group label {
			display: block;
			margin-bottom: 8px;
			font-weight: 500;
			color: #333;
		}

		.form-group input[type='file'] {
			width: 100%;
			padding: 10px;
			border: 2px dashed #ddd;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.form-group input[type='file']:hover:not(:disabled) {
			border-color: #667eea;
		}

		.form-group input[type='file']:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.upload-progress {
			text-align: center;
			padding: 20px;
			color: #667eea;
			font-weight: 500;
		}

		.form-actions {
			margin-top: 20px;
		}

		.btn-primary {
			background: #667eea;
			color: white;
			padding: 12px 24px;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.btn-primary:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
		}

		.btn-secondary {
			background: #6c757d;
			color: white;
		}

		.btn-secondary:hover {
			background: #5a6268;
		}
	`;v([g()],$.prototype,"activeTab",2);v([g()],$.prototype,"plugins",2);v([g()],$.prototype,"loading",2);v([g()],$.prototype,"currentUser",2);v([g()],$.prototype,"uploadStatus",2);v([g()],$.prototype,"uploadError",2);v([g()],$.prototype,"uploadProgress",2);$=v([Y("registry-manager")],$);var Kt=Object.defineProperty,Jt=Object.getOwnPropertyDescriptor,B=(r,t,e,s)=>{for(var i=s>1?void 0:s?Jt(t,e):t,o=r.length-1,n;o>=0;o--)(n=r[o])&&(i=(s?n(t,e,i):n(i))||i);return s&&i&&Kt(t,e,i),i};let U=class extends A{constructor(){super(...arguments),this.isInitialized=!1,this.isAuthenticated=!1,this.currentPath="",this.handlePopState=()=>{this.currentPath=this.getPath()}}connectedCallback(){super.connectedCallback(),window.addEventListener("popstate",this.handlePopState),this.currentPath=this.getPath(),f.onAuthenticationStateChanged(()=>this.handleAuthChange()),this.initialize()}async initialize(){this.isAuthenticated=await f.isAuthenticated(),this.isInitialized=!0,!this.isAuthenticated&&this.currentPath!=="/login"&&this.navigate("/login")}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("popstate",this.handlePopState)}getPath(){return window.location.pathname}navigate(r){window.history.pushState({},"",r),this.currentPath=r}async handleAuthChange(){this.isAuthenticated=await f.isAuthenticated(),!this.isAuthenticated&&this.currentPath!=="/login"&&this.navigate("/login")}handleLoginSuccess(){this.isAuthenticated=!0,this.navigate("/")}handleLogout(){this.isAuthenticated=!1,this.navigate("/login")}render(){return this.isInitialized?!this.isAuthenticated||this.currentPath==="/login"?p`<login-page @login-success=${this.handleLoginSuccess}></login-page>`:p`<registry-manager @logout=${this.handleLogout}></registry-manager>`:p`<div class="loading-screen">Loading...</div>`}};U.styles=J`
		:host {
			display: block;
			min-height: 100vh;
		}

		.loading-screen {
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			font-size: 18px;
			color: #666;
		}
	`;B([g()],U.prototype,"isInitialized",2);B([g()],U.prototype,"isAuthenticated",2);B([g()],U.prototype,"currentPath",2);U=B([Y("app-root")],U);
