(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const n of r)if(n.type==="childList")for(const o of n.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const n={};return r.integrity&&(n.integrity=r.integrity),r.referrerPolicy&&(n.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?n.credentials="include":r.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function s(r){if(r.ep)return;r.ep=!0;const n=t(r);fetch(r.href,n)}})();function m(i,e,t,s){var r=arguments.length,n=r<3?e:s===null?s=Object.getOwnPropertyDescriptor(e,t):s,o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(i,e,t,s);else for(var a=i.length-1;a>=0;a--)(o=i[a])&&(n=(r<3?o(n):r>3?o(e,t,n):o(e,t))||n);return r>3&&n&&Object.defineProperty(e,t,n),n}function b(i,e){if(typeof Reflect=="object"&&typeof Reflect.metadata=="function")return Reflect.metadata(i,e)}const T=globalThis,I=T.ShadowRoot&&(T.ShadyCSS===void 0||T.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,D=Symbol(),K=new WeakMap;let ae=class{constructor(e,t,s){if(this._$cssResult$=!0,s!==D)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(I&&e===void 0){const s=t!==void 0&&t.length===1;s&&(e=K.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),s&&K.set(t,e))}return e}toString(){return this.cssText}};const ue=i=>new ae(typeof i=="string"?i:i+"",void 0,D),pe=(i,...e)=>{const t=i.length===1?i[0]:e.reduce((s,r,n)=>s+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+i[n+1],i[0]);return new ae(t,i,D)},fe=(i,e)=>{if(I)i.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const t of e){const s=document.createElement("style"),r=T.litNonce;r!==void 0&&s.setAttribute("nonce",r),s.textContent=t.cssText,i.appendChild(s)}},J=I?i=>i:i=>i instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return ue(t)})(i):i;const{is:ge,defineProperty:$e,getOwnPropertyDescriptor:me,getOwnPropertyNames:ye,getOwnPropertySymbols:_e,getPrototypeOf:ve}=Object,k=globalThis,Z=k.trustedTypes,be=Z?Z.emptyScript:"",Ae=k.reactiveElementPolyfillSupport,x=(i,e)=>i,N={toAttribute(i,e){switch(e){case Boolean:i=i?be:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,e){let t=i;switch(e){case Boolean:t=i!==null;break;case Number:t=i===null?null:Number(i);break;case Object:case Array:try{t=JSON.parse(i)}catch{t=null}}return t}},B=(i,e)=>!ge(i,e),G={attribute:!0,type:String,converter:N,reflect:!1,useDefault:!1,hasChanged:B};Symbol.metadata??=Symbol("metadata"),k.litPropertyMetadata??=new WeakMap;let E=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=G){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(e,s,t);r!==void 0&&$e(this.prototype,e,r)}}static getPropertyDescriptor(e,t,s){const{get:r,set:n}=me(this.prototype,e)??{get(){return this[t]},set(o){this[t]=o}};return{get:r,set(o){const a=r?.call(this);n?.call(this,o),this.requestUpdate(e,a,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??G}static _$Ei(){if(this.hasOwnProperty(x("elementProperties")))return;const e=ve(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(x("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(x("properties"))){const t=this.properties,s=[...ye(t),..._e(t)];for(const r of s)this.createProperty(r,t[r])}const e=this[Symbol.metadata];if(e!==null){const t=litPropertyMetadata.get(e);if(t!==void 0)for(const[s,r]of t)this.elementProperties.set(s,r)}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const r=this._$Eu(t,s);r!==void 0&&this._$Eh.set(r,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const r of s)t.unshift(J(r))}else e!==void 0&&t.push(J(e));return t}static _$Eu(e,t){const s=t.attribute;return s===!1?void 0:typeof s=="string"?s:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return fe(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,s);if(r!==void 0&&s.reflect===!0){const n=(s.converter?.toAttribute!==void 0?s.converter:N).toAttribute(t,s.type);this._$Em=e,n==null?this.removeAttribute(r):this.setAttribute(r,n),this._$Em=null}}_$AK(e,t){const s=this.constructor,r=s._$Eh.get(e);if(r!==void 0&&this._$Em!==r){const n=s.getPropertyOptions(r),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:N;this._$Em=r;const a=o.fromAttribute(t,n.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(e,t,s,r=!1,n){if(e!==void 0){const o=this.constructor;if(r===!1&&(n=this[e]),s??=o.getPropertyOptions(e),!((s.hasChanged??B)(n,t)||s.useDefault&&s.reflect&&n===this._$Ej?.get(e)&&!this.hasAttribute(o._$Eu(e,s))))return;this.C(e,t,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:r,wrapped:n},o){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,o??t??this[e]),n!==!0||o!==void 0)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),r===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[r,n]of this._$Ep)this[r]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[r,n]of s){const{wrapped:o}=n,a=this[r];o!==!0||this._$AL.has(r)||a===void 0||this.C(r,void 0,n,a)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(t)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};E.elementStyles=[],E.shadowRootOptions={mode:"open"},E[x("elementProperties")]=new Map,E[x("finalized")]=new Map,Ae?.({ReactiveElement:E}),(k.reactiveElementVersions??=[]).push("2.1.2");const F=globalThis,Q=i=>i,H=F.trustedTypes,X=H?H.createPolicy("lit-html",{createHTML:i=>i}):void 0,le="$lit$",$=`lit$${Math.random().toFixed(9).slice(2)}$`,ce="?"+$,Ee=`<${ce}>`,v=document,C=()=>v.createComment(""),O=i=>i===null||typeof i!="object"&&typeof i!="function",q=Array.isArray,Se=i=>q(i)||typeof i?.[Symbol.iterator]=="function",z=`[ 	
\f\r]`,P=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Y=/-->/g,ee=/>/g,y=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),te=/'/g,se=/"/g,he=/^(?:script|style|textarea|title)$/i,we=i=>(e,...t)=>({_$litType$:i,strings:e,values:t}),re=we(1),S=Symbol.for("lit-noChange"),p=Symbol.for("lit-nothing"),ie=new WeakMap,_=v.createTreeWalker(v,129);function de(i,e){if(!q(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return X!==void 0?X.createHTML(e):e}const Pe=(i,e)=>{const t=i.length-1,s=[];let r,n=e===2?"<svg>":e===3?"<math>":"",o=P;for(let a=0;a<t;a++){const l=i[a];let h,d,c=-1,u=0;for(;u<l.length&&(o.lastIndex=u,d=o.exec(l),d!==null);)u=o.lastIndex,o===P?d[1]==="!--"?o=Y:d[1]!==void 0?o=ee:d[2]!==void 0?(he.test(d[2])&&(r=RegExp("</"+d[2],"g")),o=y):d[3]!==void 0&&(o=y):o===y?d[0]===">"?(o=r??P,c=-1):d[1]===void 0?c=-2:(c=o.lastIndex-d[2].length,h=d[1],o=d[3]===void 0?y:d[3]==='"'?se:te):o===se||o===te?o=y:o===Y||o===ee?o=P:(o=y,r=void 0);const f=o===y&&i[a+1].startsWith("/>")?" ":"";n+=o===P?l+Ee:c>=0?(s.push(h),l.slice(0,c)+le+l.slice(c)+$+f):l+$+(c===-2?a:f)}return[de(i,n+(i[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),s]};class R{constructor({strings:e,_$litType$:t},s){let r;this.parts=[];let n=0,o=0;const a=e.length-1,l=this.parts,[h,d]=Pe(e,t);if(this.el=R.createElement(h,s),_.currentNode=this.el.content,t===2||t===3){const c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(r=_.nextNode())!==null&&l.length<a;){if(r.nodeType===1){if(r.hasAttributes())for(const c of r.getAttributeNames())if(c.endsWith(le)){const u=d[o++],f=r.getAttribute(c).split($),A=/([.?@])?(.*)/.exec(u);l.push({type:1,index:n,name:A[2],strings:f,ctor:A[1]==="."?Ue:A[1]==="?"?Ce:A[1]==="@"?Oe:j}),r.removeAttribute(c)}else c.startsWith($)&&(l.push({type:6,index:n}),r.removeAttribute(c));if(he.test(r.tagName)){const c=r.textContent.split($),u=c.length-1;if(u>0){r.textContent=H?H.emptyScript:"";for(let f=0;f<u;f++)r.append(c[f],C()),_.nextNode(),l.push({type:2,index:++n});r.append(c[u],C())}}}else if(r.nodeType===8)if(r.data===ce)l.push({type:2,index:n});else{let c=-1;for(;(c=r.data.indexOf($,c+1))!==-1;)l.push({type:7,index:n}),c+=$.length-1}n++}}static createElement(e,t){const s=v.createElement("template");return s.innerHTML=e,s}}function w(i,e,t=i,s){if(e===S)return e;let r=s!==void 0?t._$Co?.[s]:t._$Cl;const n=O(e)?void 0:e._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),n===void 0?r=void 0:(r=new n(i),r._$AT(i,t,s)),s!==void 0?(t._$Co??=[])[s]=r:t._$Cl=r),r!==void 0&&(e=w(i,r._$AS(i,e.values),r,s)),e}class xe{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,r=(e?.creationScope??v).importNode(t,!0);_.currentNode=r;let n=_.nextNode(),o=0,a=0,l=s[0];for(;l!==void 0;){if(o===l.index){let h;l.type===2?h=new L(n,n.nextSibling,this,e):l.type===1?h=new l.ctor(n,l.name,l.strings,this,e):l.type===6&&(h=new Re(n,this,e)),this._$AV.push(h),l=s[++a]}o!==l?.index&&(n=_.nextNode(),o++)}return _.currentNode=v,r}p(e){let t=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class L{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,r){this.type=2,this._$AH=p,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=w(this,e,t),O(e)?e===p||e==null||e===""?(this._$AH!==p&&this._$AR(),this._$AH=p):e!==this._$AH&&e!==S&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Se(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==p&&O(this._$AH)?this._$AA.nextSibling.data=e:this.T(v.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,r=typeof s=="number"?this._$AC(e):(s.el===void 0&&(s.el=R.createElement(de(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===r)this._$AH.p(t);else{const n=new xe(r,this),o=n.u(this.options);n.p(t),this.T(o),this._$AH=n}}_$AC(e){let t=ie.get(e.strings);return t===void 0&&ie.set(e.strings,t=new R(e)),t}k(e){q(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,r=0;for(const n of e)r===t.length?t.push(s=new L(this.O(C()),this.O(C()),this,this.options)):s=t[r],s._$AI(n),r++;r<t.length&&(this._$AR(s&&s._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const s=Q(e).nextSibling;Q(e).remove(),e=s}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}}class j{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,r,n){this.type=1,this._$AH=p,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=n,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=p}_$AI(e,t=this,s,r){const n=this.strings;let o=!1;if(n===void 0)e=w(this,e,t,0),o=!O(e)||e!==this._$AH&&e!==S,o&&(this._$AH=e);else{const a=e;let l,h;for(e=n[0],l=0;l<n.length-1;l++)h=w(this,a[s+l],t,l),h===S&&(h=this._$AH[l]),o||=!O(h)||h!==this._$AH[l],h===p?e=p:e!==p&&(e+=(h??"")+n[l+1]),this._$AH[l]=h}o&&!r&&this.j(e)}j(e){e===p?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class Ue extends j{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===p?void 0:e}}class Ce extends j{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==p)}}class Oe extends j{constructor(e,t,s,r,n){super(e,t,s,r,n),this.type=5}_$AI(e,t=this){if((e=w(this,e,t,0)??p)===S)return;const s=this._$AH,r=e===p&&s!==p||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,n=e!==p&&(s===p||r);r&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class Re{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){w(this,e)}}const Le=F.litHtmlPolyfillSupport;Le?.(R,L),(F.litHtmlVersions??=[]).push("3.3.2");const Me=(i,e,t)=>{const s=t?.renderBefore??e;let r=s._$litPart$;if(r===void 0){const n=t?.renderBefore??null;s._$litPart$=r=new L(e.insertBefore(C(),n),n,void 0,t??{})}return r._$AI(i),r};const W=globalThis;class U extends E{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Me(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return S}}U._$litElement$=!0,U.finalized=!0,W.litElementHydrateSupport?.({LitElement:U});const Te=W.litElementPolyfillSupport;Te?.({LitElement:U});(W.litElementVersions??=[]).push("4.2.2");const Ne=i=>(e,t)=>{t!==void 0?t.addInitializer(()=>{customElements.define(i,e)}):customElements.define(i,e)};const He={attribute:!0,type:String,converter:N,reflect:!1,hasChanged:B},ke=(i=He,e,t)=>{const{kind:s,metadata:r}=t;let n=globalThis.litPropertyMetadata.get(r);if(n===void 0&&globalThis.litPropertyMetadata.set(r,n=new Map),s==="setter"&&((i=Object.create(i)).wrapped=!0),n.set(t.name,i),s==="accessor"){const{name:o}=t;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(o,l,i,!0,a)},init(a){return a!==void 0&&this.C(o,void 0,i,a),a}}}if(s==="setter"){const{name:o}=t;return function(a){const l=this[o];e.call(this,a),this.requestUpdate(o,l,i,!0,a)}}throw Error("Unsupported decorator location: "+s)};function M(i){return(e,t)=>typeof t=="object"?ke(i,e,t):((s,r,n)=>{const o=r.hasOwnProperty(n);return r.constructor.createProperty(n,s),o?Object.getOwnPropertyDescriptor(r,n):void 0})(i,e,t)}function V(i){return M({...i,state:!0,attribute:!1})}function ne(i,e,t){return i?e(i):t?.(i)}class je{constructor(){this.currentUser=null,this.hasFetched=!1,this.listeners=new Set,this.isRefreshing=!1,this.refreshPromise=null}async getCurrentUser(){if(!this.hasFetched){try{const e=await fetch("/api/auth/me",{credentials:"include"});if(e.ok){const t=await e.json();this.currentUser=t.username}else this.currentUser=null}catch(e){console.error("[AuthService] Not authenticated (exception):",e),this.currentUser=null}this.hasFetched=!0}return this.currentUser}async login(e){if(!e.trim())return{success:!1,error:"Username cannot be empty"};try{const t=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:e.trim()})});if(t.ok){const s=await t.json();return this.currentUser=s.username,this.hasFetched=!0,this.notifyListeners(),{success:!0}}else return{success:!1,error:await t.text()}}catch(t){return{success:!1,error:t instanceof Error?t.message:"Unknown error"}}}async logout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"include"})}catch{}this.currentUser=null,this.hasFetched=!1,this.notifyListeners()}async isAuthenticated(){return!!await this.getCurrentUser()}onAuthenticationStateChanged(e){return this.listeners.add(e),()=>this.listeners.delete(e)}notifyListeners(){this.listeners.forEach(e=>e())}async refreshToken(){if(this.isRefreshing)return this.refreshPromise??!1;this.isRefreshing=!0,this.refreshPromise=this.performRefresh();try{return await this.refreshPromise}finally{this.isRefreshing=!1,this.refreshPromise=null}}async performRefresh(){try{const e=await fetch("/api/auth/refresh",{method:"POST",credentials:"include"});if(e.ok){const t=await e.json();return this.currentUser=t.username,this.hasFetched=!0,this.notifyListeners(),!0}else return this.currentUser=null,this.hasFetched=!1,this.notifyListeners(),!1}catch(e){return console.error("[AuthService] Token refresh failed:",e),this.currentUser=null,this.hasFetched=!1,this.notifyListeners(),!1}}async fetchWithAuth(e,t={}){const s={...t,credentials:"include"};let r=await fetch(e,s);return r.status===401&&await this.refreshToken()&&(r=await fetch(e,s)),r}}const ze=new je,Ie="modulepreload",De=function(i){return"/"+i},oe={},Be=function(e,t,s){let r=Promise.resolve();if(t&&t.length>0){let l=function(h){return Promise.all(h.map(d=>Promise.resolve(d).then(c=>({status:"fulfilled",value:c}),c=>({status:"rejected",reason:c}))))};document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),a=o?.nonce||o?.getAttribute("nonce");r=l(t.map(h=>{if(h=De(h),h in oe)return;oe[h]=!0;const d=h.endsWith(".css"),c=d?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${h}"]${c}`))return;const u=document.createElement("link");if(u.rel=d?"stylesheet":Ie,d||(u.as="script"),u.crossOrigin="",u.href=h,a&&u.setAttribute("nonce",a),document.head.appendChild(u),d)return new Promise((f,A)=>{u.addEventListener("load",f),u.addEventListener("error",()=>A(new Error(`Unable to preload CSS for ${h}`)))})}))}function n(o){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=o,window.dispatchEvent(a),!a.defaultPrevented)throw o}return r.then(o=>{for(const a of o||[])a.status==="rejected"&&n(a.reason);return e().catch(n)})};let g=class extends U{constructor(){super(...arguments),this.username="",this.errorMessage="",this.isLoggingIn=!1,this.pageTitle="Pivot Login",this.subtitle="Enter your username to continue",this.redirectPath="/",this.useFullRedirect=!1}async handleLogin(){if(this.errorMessage="",!this.username.trim()){this.errorMessage="Please enter a username";return}try{this.isLoggingIn=!0;const e=await ze.login(this.username.trim());if(e.success)if(this.useFullRedirect)window.location.href=this.redirectPath;else{const{router:t}=await Be(async()=>{const{router:s}=await import("./index-CDqOEMXw.js");return{router:s}},[]);await t.navigate(this.redirectPath)}else this.errorMessage=e.error??"Login failed"}catch(e){this.errorMessage=`Login failed: ${e instanceof Error?e.message:"Unknown error"}`}finally{this.isLoggingIn=!1}}handleKeyPress(e){e.key==="Enter"&&this.handleLogin()}handleUsernameInput(e){this.username=e.target.value}render(){return re`
		<div class="login-container">
			<div class="login-box">
				<h1>${this.pageTitle}</h1>
				<p class="login-subtitle">${this.subtitle}</p>

				${ne(this.errorMessage,()=>re`
				<div class="alert alert-danger">${this.errorMessage}</div>
				`)}

				<div class="login-form">
					<div class="form-group">
						<label for="username">Username</label>
						<input
							id="username"
							type="text"
							class="form-control"
							.value=${this.username}
							@input=${this.handleUsernameInput}
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
						${ne(this.isLoggingIn,()=>"Logging in...",()=>"Login")}
					</button>
				</div>
			</div>
		</div>
		`}static{this.styles=pe`
		:host {
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-primary-alt: #764ba2;
			--color-text: #333;
			--color-text-muted: #666;
			--color-danger: #c33;
			--color-danger-bg: #fee;
			--color-danger-border: #fcc;
			--color-border: #ddd;
			--font-size-sm: 14px;
			--font-size-md: 16px;
			--font-size-lg: 28px;
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 20px;
			--spacing-xl: 30px;
			--spacing-2xl: 40px;
			--radius: 4px;
			--radius-lg: 8px;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%);
		}
		.login-container {
			width: 100%;
			max-width: 400px;
			padding: var(--spacing-lg);
		}
		.login-box {
			padding: var(--spacing-2xl);
			background: white;
			border-radius: var(--radius-lg);
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
		}
		h1 {
			margin: 0 0 10px 0;
			font-size: var(--font-size-lg);
			color: var(--color-text);
			text-align: center;
		}
		.login-subtitle {
			margin-bottom: var(--spacing-xl);
			font-size: var(--font-size-sm);
			color: var(--color-text-muted);
			text-align: center;
		}
		.alert {
			padding: var(--spacing-md);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius);
		}
		.alert-danger {
			background-color: var(--color-danger-bg);
			color: var(--color-danger);
			border: 1px solid var(--color-danger-border);
		}
		.form-group {
			margin-bottom: var(--spacing-lg);

			label {
				display: block;
				margin-bottom: var(--spacing-sm);
				font-weight: 500;
				color: var(--color-text);
			}
		}
		.form-control {
			width: 100%;
			padding: var(--spacing-md);
			border: 1px solid var(--color-border);
			border-radius: var(--radius);
			font-size: var(--font-size-sm);
			box-sizing: border-box;
			transition: border-color 0.3s;

			&:focus {
				border-color: var(--color-primary);
				outline: none;
			}
		}
		.btn {
			width: 100%;
			padding: var(--spacing-md);
			border: none;
			border-radius: var(--radius);
			font-size: var(--font-size-md);
			font-weight: 500;
			cursor: pointer;
			transition: background-color 0.3s;

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-primary {
			background-color: var(--color-primary);
			color: white;

			&:hover:not(:disabled) {
				background-color: var(--color-primary-hover);
			}
		}
	`}};m([V(),b("design:type",Object)],g.prototype,"username",void 0);m([V(),b("design:type",Object)],g.prototype,"errorMessage",void 0);m([V(),b("design:type",Object)],g.prototype,"isLoggingIn",void 0);m([M({type:String}),b("design:type",String)],g.prototype,"pageTitle",void 0);m([M({type:String}),b("design:type",String)],g.prototype,"subtitle",void 0);m([M({type:String}),b("design:type",String)],g.prototype,"redirectPath",void 0);m([M({type:Boolean}),b("design:type",Boolean)],g.prototype,"useFullRedirect",void 0);g=m([Ne("login-page")],g);export{p as A,S as E,Be as _,U as a,ze as b,re as c,M as d,m as e,b as f,pe as i,ne as n,V as r,Ne as t};
