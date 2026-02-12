(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const a of r)if(a.type==="childList")for(const n of a.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function t(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?a.credentials="include":r.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(r){if(r.ep)return;r.ep=!0;const a=t(r);fetch(r.href,a)}})();let zt=class extends Event{constructor(e,t,i,r){super("context-request",{bubbles:!0,composed:!0}),this.context=e,this.contextTarget=t,this.callback=i,this.subscribe=r??!1}};let ut=class{constructor(e,t,i,r){if(this.subscribe=!1,this.provided=!1,this.value=void 0,this.t=(a,n)=>{this.unsubscribe&&(this.unsubscribe!==n&&(this.provided=!1,this.unsubscribe()),this.subscribe||this.unsubscribe()),this.value=a,this.host.requestUpdate(),this.provided&&!this.subscribe||(this.provided=!0,this.callback&&this.callback(a,n)),this.unsubscribe=n},this.host=e,t.context!==void 0){const a=t;this.context=a.context,this.callback=a.callback,this.subscribe=a.subscribe??!1}else this.context=t,this.callback=i,this.subscribe=r??!1;this.host.addController(this)}hostConnected(){this.dispatchRequest()}hostDisconnected(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=void 0)}dispatchRequest(){this.host.dispatchEvent(new zt(this.context,this.host,this.t,this.subscribe))}};let or=class{get value(){return this.o}set value(e){this.setValue(e)}setValue(e,t=!1){const i=t||!Object.is(e,this.o);this.o=e,i&&this.updateObservers()}constructor(e){this.subscriptions=new Map,this.updateObservers=()=>{for(const[t,{disposer:i}]of this.subscriptions)t(this.o,i)},e!==void 0&&(this.value=e)}addCallback(e,t,i){if(!i)return void e(this.value);this.subscriptions.has(e)||this.subscriptions.set(e,{disposer:()=>{this.subscriptions.delete(e)},consumerHost:t});const{disposer:r}=this.subscriptions.get(e);e(this.value,r)}clearCallbacks(){this.subscriptions.clear()}};let lr=class extends Event{constructor(e,t){super("context-provider",{bubbles:!0,composed:!0}),this.context=e,this.contextTarget=t}},gt=class extends or{constructor(e,t,i){super(t.context!==void 0?t.initialValue:i),this.onContextRequest=r=>{if(r.context!==this.context)return;const a=r.contextTarget??r.composedPath()[0];a!==this.host&&(r.stopPropagation(),this.addCallback(r.callback,a,r.subscribe))},this.onProviderRequest=r=>{if(r.context!==this.context||(r.contextTarget??r.composedPath()[0])===this.host)return;const a=new Set;for(const[n,{consumerHost:l}]of this.subscriptions)a.has(n)||(a.add(n),l.dispatchEvent(new zt(this.context,l,n,!0)));r.stopPropagation()},this.host=e,t.context!==void 0?this.context=t.context:this.context=t,this.attachListeners(),this.host.addController?.(this)}attachListeners(){this.host.addEventListener("context-request",this.onContextRequest),this.host.addEventListener("context-provider",this.onProviderRequest)}hostConnected(){this.host.dispatchEvent(new lr(this.context,this.host))}};function Ut({context:s}){return(e,t)=>{const i=new WeakMap;if(typeof t=="object")return{get(){return e.get.call(this)},set(r){return i.get(this).setValue(r),e.set.call(this,r)},init(r){return i.set(this,new gt(this,{context:s,initialValue:r})),r}};{e.constructor.addInitializer((n=>{i.set(n,new gt(n,{context:s}))}));const r=Object.getOwnPropertyDescriptor(e,t);let a;if(r===void 0){const n=new WeakMap;a={get(){return n.get(this)},set(l){i.get(this).setValue(l),n.set(this,l)},configurable:!0,enumerable:!0}}else{const n=r.set;a={...r,set(l){i.get(this).setValue(l),n?.call(this,l)}}}return void Object.defineProperty(e,t,a)}}}function Ge({context:s,subscribe:e}){return(t,i)=>{typeof i=="object"?i.addInitializer((function(){new ut(this,{context:s,callback:r=>{t.set.call(this,r)},subscribe:e})})):t.constructor.addInitializer((r=>{new ut(r,{context:s,callback:a=>{r[i]=a},subscribe:e})}))}}const ke=globalThis,Ke=ke.ShadowRoot&&(ke.ShadyCSS===void 0||ke.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Xe=Symbol(),ft=new WeakMap;let Mt=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==Xe)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const t=this.t;if(Ke&&e===void 0){const i=t!==void 0&&t.length===1;i&&(e=ft.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&ft.set(t,e))}return e}toString(){return this.cssText}};const cr=s=>new Mt(typeof s=="string"?s:s+"",void 0,Xe),D=(s,...e)=>{const t=s.length===1?s[0]:e.reduce((i,r,a)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+s[a+1],s[0]);return new Mt(t,s,Xe)},hr=(s,e)=>{if(Ke)s.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const t of e){const i=document.createElement("style"),r=ke.litNonce;r!==void 0&&i.setAttribute("nonce",r),i.textContent=t.cssText,s.appendChild(i)}},bt=Ke?s=>s:s=>s instanceof CSSStyleSheet?(e=>{let t="";for(const i of e.cssRules)t+=i.cssText;return cr(t)})(s):s;const{is:pr,defineProperty:dr,getOwnPropertyDescriptor:ur,getOwnPropertyNames:gr,getOwnPropertySymbols:fr,getPrototypeOf:br}=Object,Ce=globalThis,mt=Ce.trustedTypes,mr=mt?mt.emptyScript:"",xr=Ce.reactiveElementPolyfillSupport,ue=(s,e)=>s,$e={toAttribute(s,e){switch(e){case Boolean:s=s?mr:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,e){let t=s;switch(e){case Boolean:t=s!==null;break;case Number:t=s===null?null:Number(s);break;case Object:case Array:try{t=JSON.parse(s)}catch{t=null}}return t}},Qe=(s,e)=>!pr(s,e),xt={attribute:!0,type:String,converter:$e,reflect:!1,useDefault:!1,hasChanged:Qe};Symbol.metadata??=Symbol("metadata"),Ce.litPropertyMetadata??=new WeakMap;let J=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=xt){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const i=Symbol(),r=this.getPropertyDescriptor(e,i,t);r!==void 0&&dr(this.prototype,e,r)}}static getPropertyDescriptor(e,t,i){const{get:r,set:a}=ur(this.prototype,e)??{get(){return this[t]},set(n){this[t]=n}};return{get:r,set(n){const l=r?.call(this);a?.call(this,n),this.requestUpdate(e,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??xt}static _$Ei(){if(this.hasOwnProperty(ue("elementProperties")))return;const e=br(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(ue("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ue("properties"))){const t=this.properties,i=[...gr(t),...fr(t)];for(const r of i)this.createProperty(r,t[r])}const e=this[Symbol.metadata];if(e!==null){const t=litPropertyMetadata.get(e);if(t!==void 0)for(const[i,r]of t)this.elementProperties.set(i,r)}this._$Eh=new Map;for(const[t,i]of this.elementProperties){const r=this._$Eu(t,i);r!==void 0&&this._$Eh.set(r,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const r of i)t.unshift(bt(r))}else e!==void 0&&t.push(bt(e));return t}static _$Eu(e,t){const i=t.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const i of t.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return hr(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,i){this._$AK(e,i)}_$ET(e,t){const i=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,i);if(r!==void 0&&i.reflect===!0){const a=(i.converter?.toAttribute!==void 0?i.converter:$e).toAttribute(t,i.type);this._$Em=e,a==null?this.removeAttribute(r):this.setAttribute(r,a),this._$Em=null}}_$AK(e,t){const i=this.constructor,r=i._$Eh.get(e);if(r!==void 0&&this._$Em!==r){const a=i.getPropertyOptions(r),n=typeof a.converter=="function"?{fromAttribute:a.converter}:a.converter?.fromAttribute!==void 0?a.converter:$e;this._$Em=r;const l=n.fromAttribute(t,a.type);this[r]=l??this._$Ej?.get(r)??l,this._$Em=null}}requestUpdate(e,t,i,r=!1,a){if(e!==void 0){const n=this.constructor;if(r===!1&&(a=this[e]),i??=n.getPropertyOptions(e),!((i.hasChanged??Qe)(a,t)||i.useDefault&&i.reflect&&a===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,i))))return;this.C(e,t,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:i,reflect:r,wrapped:a},n){i&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,n??t??this[e]),a!==!0||n!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(t=void 0),this._$AL.set(e,t)),r===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[r,a]of this._$Ep)this[r]=a;this._$Ep=void 0}const i=this.constructor.elementProperties;if(i.size>0)for(const[r,a]of i){const{wrapped:n}=a,l=this[r];n!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,a,l)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(t)):this._$EM()}catch(i){throw e=!1,this._$EM(),i}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};J.elementStyles=[],J.shadowRootOptions={mode:"open"},J[ue("elementProperties")]=new Map,J[ue("finalized")]=new Map,xr?.({ReactiveElement:J}),(Ce.reactiveElementVersions??=[]).push("2.1.2");const Ye=globalThis,wt=s=>s,Pe=Ye.trustedTypes,yt=Pe?Pe.createPolicy("lit-html",{createHTML:s=>s}):void 0,Ot="$lit$",B=`lit$${Math.random().toFixed(9).slice(2)}$`,Dt="?"+B,wr=`<${Dt}>`,G=document,fe=()=>G.createComment(""),be=s=>s===null||typeof s!="object"&&typeof s!="function",Je=Array.isArray,yr=s=>Je(s)||typeof s?.[Symbol.iterator]=="function",je=`[ 	
\f\r]`,le=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,vt=/-->/g,kt=/>/g,W=RegExp(`>|${je}(?:([^\\s"'>=/]+)(${je}*=${je}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),$t=/'/g,Pt=/"/g,Nt=/^(?:script|style|textarea|title)$/i,vr=s=>(e,...t)=>({_$litType$:s,strings:e,values:t}),d=vr(1),K=Symbol.for("lit-noChange"),y=Symbol.for("lit-nothing"),St=new WeakMap,Z=G.createTreeWalker(G,129);function It(s,e){if(!Je(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return yt!==void 0?yt.createHTML(e):e}const kr=(s,e)=>{const t=s.length-1,i=[];let r,a=e===2?"<svg>":e===3?"<math>":"",n=le;for(let l=0;l<t;l++){const o=s[l];let h,c,p=-1,u=0;for(;u<o.length&&(n.lastIndex=u,c=n.exec(o),c!==null);)u=n.lastIndex,n===le?c[1]==="!--"?n=vt:c[1]!==void 0?n=kt:c[2]!==void 0?(Nt.test(c[2])&&(r=RegExp("</"+c[2],"g")),n=W):c[3]!==void 0&&(n=W):n===W?c[0]===">"?(n=r??le,p=-1):c[1]===void 0?p=-2:(p=n.lastIndex-c[2].length,h=c[1],n=c[3]===void 0?W:c[3]==='"'?Pt:$t):n===Pt||n===$t?n=W:n===vt||n===kt?n=le:(n=W,r=void 0);const f=n===W&&s[l+1].startsWith("/>")?" ":"";a+=n===le?o+wr:p>=0?(i.push(h),o.slice(0,p)+Ot+o.slice(p)+B+f):o+B+(p===-2?l:f)}return[It(s,a+(s[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]};let qe=class Bt{constructor({strings:e,_$litType$:t},i){let r;this.parts=[];let a=0,n=0;const l=e.length-1,o=this.parts,[h,c]=kr(e,t);if(this.el=Bt.createElement(h,i),Z.currentNode=this.el.content,t===2||t===3){const p=this.el.content.firstChild;p.replaceWith(...p.childNodes)}for(;(r=Z.nextNode())!==null&&o.length<l;){if(r.nodeType===1){if(r.hasAttributes())for(const p of r.getAttributeNames())if(p.endsWith(Ot)){const u=c[n++],f=r.getAttribute(p).split(B),m=/([.?@])?(.*)/.exec(u);o.push({type:1,index:a,name:m[2],strings:f,ctor:m[1]==="."?Pr:m[1]==="?"?Sr:m[1]==="@"?Ar:Ee}),r.removeAttribute(p)}else p.startsWith(B)&&(o.push({type:6,index:a}),r.removeAttribute(p));if(Nt.test(r.tagName)){const p=r.textContent.split(B),u=p.length-1;if(u>0){r.textContent=Pe?Pe.emptyScript:"";for(let f=0;f<u;f++)r.append(p[f],fe()),Z.nextNode(),o.push({type:2,index:++a});r.append(p[u],fe())}}}else if(r.nodeType===8)if(r.data===Dt)o.push({type:2,index:a});else{let p=-1;for(;(p=r.data.indexOf(B,p+1))!==-1;)o.push({type:7,index:a}),p+=B.length-1}a++}}static createElement(e,t){const i=G.createElement("template");return i.innerHTML=e,i}};function ee(s,e,t=s,i){if(e===K)return e;let r=i!==void 0?t._$Co?.[i]:t._$Cl;const a=be(e)?void 0:e._$litDirective$;return r?.constructor!==a&&(r?._$AO?.(!1),a===void 0?r=void 0:(r=new a(s),r._$AT(s,t,i)),i!==void 0?(t._$Co??=[])[i]=r:t._$Cl=r),r!==void 0&&(e=ee(s,r._$AS(s,e.values),r,i)),e}class $r{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:i}=this._$AD,r=(e?.creationScope??G).importNode(t,!0);Z.currentNode=r;let a=Z.nextNode(),n=0,l=0,o=i[0];for(;o!==void 0;){if(n===o.index){let h;o.type===2?h=new et(a,a.nextSibling,this,e):o.type===1?h=new o.ctor(a,o.name,o.strings,this,e):o.type===6&&(h=new _r(a,this,e)),this._$AV.push(h),o=i[++l]}n!==o?.index&&(a=Z.nextNode(),n++)}return Z.currentNode=G,r}p(e){let t=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,t),t+=i.strings.length-2):i._$AI(e[t])),t++}}let et=class jt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,i,r){this.type=2,this._$AH=y,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=ee(this,e,t),be(e)?e===y||e==null||e===""?(this._$AH!==y&&this._$AR(),this._$AH=y):e!==this._$AH&&e!==K&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):yr(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==y&&be(this._$AH)?this._$AA.nextSibling.data=e:this.T(G.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:i}=e,r=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=qe.createElement(It(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(t);else{const a=new $r(r,this),n=a.u(this.options);a.p(t),this.T(n),this._$AH=a}}_$AC(e){let t=St.get(e.strings);return t===void 0&&St.set(e.strings,t=new qe(e)),t}k(e){Je(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let i,r=0;for(const a of e)r===t.length?t.push(i=new jt(this.O(fe()),this.O(fe()),this,this.options)):i=t[r],i._$AI(a),r++;r<t.length&&(this._$AR(i&&i._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const i=wt(e).nextSibling;wt(e).remove(),e=i}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}};class Ee{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,i,r,a){this.type=1,this._$AH=y,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=a,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=y}_$AI(e,t=this,i,r){const a=this.strings;let n=!1;if(a===void 0)e=ee(this,e,t,0),n=!be(e)||e!==this._$AH&&e!==K,n&&(this._$AH=e);else{const l=e;let o,h;for(e=a[0],o=0;o<a.length-1;o++)h=ee(this,l[i+o],t,o),h===K&&(h=this._$AH[o]),n||=!be(h)||h!==this._$AH[o],h===y?e=y:e!==y&&(e+=(h??"")+a[o+1]),this._$AH[o]=h}n&&!r&&this.j(e)}j(e){e===y?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}let Pr=class extends Ee{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===y?void 0:e}},Sr=class extends Ee{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==y)}},Ar=class extends Ee{constructor(e,t,i,r,a){super(e,t,i,r,a),this.type=5}_$AI(e,t=this){if((e=ee(this,e,t,0)??y)===K)return;const i=this._$AH,r=e===y&&i!==y||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,a=e!==y&&(i===y||r);r&&this.element.removeEventListener(this.name,this,i),a&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}};class _r{constructor(e,t,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){ee(this,e)}}const Rr=Ye.litHtmlPolyfillSupport;Rr?.(qe,et),(Ye.litHtmlVersions??=[]).push("3.3.2");const Cr=(s,e,t)=>{const i=t?.renderBefore??e;let r=i._$litPart$;if(r===void 0){const a=t?.renderBefore??null;i._$litPart$=r=new et(e.insertBefore(fe(),a),a,void 0,t??{})}return r._$AI(s),r};const tt=globalThis;let _=class extends J{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Cr(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}};_._$litElement$=!0,_.finalized=!0,tt.litElementHydrateSupport?.({LitElement:_});const Er=tt.litElementPolyfillSupport;Er?.({LitElement:_});(tt.litElementVersions??=[]).push("4.2.2");const U=s=>(e,t)=>{t!==void 0?t.addInitializer(()=>{customElements.define(s,e)}):customElements.define(s,e)};const Tr={attribute:!0,type:String,converter:$e,reflect:!1,hasChanged:Qe},Lr=(s=Tr,e,t)=>{const{kind:i,metadata:r}=t;let a=globalThis.litPropertyMetadata.get(r);if(a===void 0&&globalThis.litPropertyMetadata.set(r,a=new Map),i==="setter"&&((s=Object.create(s)).wrapped=!0),a.set(t.name,s),i==="accessor"){const{name:n}=t;return{set(l){const o=e.get.call(this);e.set.call(this,l),this.requestUpdate(n,o,s,!0,l)},init(l){return l!==void 0&&this.C(n,void 0,s,l),l}}}if(i==="setter"){const{name:n}=t;return function(l){const o=this[n];e.call(this,l),this.requestUpdate(n,o,s,!0,l)}}throw Error("Unsupported decorator location: "+i)};function R(s){return(e,t)=>typeof t=="object"?Lr(s,e,t):((i,r,a)=>{const n=r.hasOwnProperty(a);return r.constructor.createProperty(a,i),n?Object.getOwnPropertyDescriptor(r,a):void 0})(s,e,t)}function g(s){return R({...s,state:!0,attribute:!1})}class zr{constructor(){this.popStateListeners=[],this.clickListeners=[],this.boundPopState=()=>{this.popStateListeners.forEach(e=>e())},this.boundClick=e=>{this.clickListeners.forEach(t=>t(e))},window.addEventListener("popstate",this.boundPopState),document.addEventListener("click",this.boundClick)}get origin(){return window.location.origin}getCurrentPath(){return window.location.pathname}getCurrentURL(){return window.location.href}getScrollPosition(){return{x:window.scrollX,y:window.scrollY}}pushState(e,t){window.history.pushState(e,"",t)}replaceState(e,t){window.history.replaceState(e,"",t)}back(){window.history.back()}forward(){window.history.forward()}onPopState(e){return this.popStateListeners.push(e),()=>{const t=this.popStateListeners.indexOf(e);t>-1&&this.popStateListeners.splice(t,1)}}onLinkClick(e){return this.clickListeners.push(e),()=>{const t=this.clickListeners.indexOf(e);t>-1&&this.clickListeners.splice(t,1)}}scrollTo(e,t){window.scrollTo(e,t)}scrollIntoView(e){const t=document.getElementById(e);t&&t.scrollIntoView({behavior:"smooth"})}dispose(){window.removeEventListener("popstate",this.boundPopState),document.removeEventListener("click",this.boundClick),this.popStateListeners=[],this.clickListeners=[]}}const rt=Symbol("router"),Ur=new Set(["path","name","reuseFrom","pattern","fullPath","priority","parentRoute"]);class At{constructor(e=100){this.cache=new Map,this.maxSize=e}get(e){const t=this.cache.get(e);return t!==void 0&&(this.cache.delete(e),this.cache.set(e,t)),t}set(e,t){if(this.cache.has(e)&&this.cache.delete(e),this.cache.size>=this.maxSize){const i=this.cache.keys().next().value;i!==void 0&&this.cache.delete(i)}this.cache.set(e,t)}has(e){return this.cache.get(e)!==void 0}clear(){this.cache.clear()}get size(){return this.cache.size}values(){return this.cache.values()}}class qt{constructor(e={}){this.routes=[],this.compiledRoutes=[],this.namedRoutes=new Map,this.controllers=new Set,this.basePath="",this.lazyCache=new WeakMap,this.currentMatch=null,this.pendingPath=null,this.scrollPositions=new Map,this.scrollRestoration=!0,this.viewTransition=!1,this.redirectCount=0,this.MAX_REDIRECTS=10,this.navigationDepth=0,this.MAX_NAVIGATION_DEPTH=10,this.enableMetrics=!0,this.prefetchCache=new WeakMap,this.beforeNavigateStartListeners=[],this.afterNavigateStartListeners=[],this.beforeNavigateEndListeners=[],this.afterNavigateEndListeners=[],this.navigateErrorListeners=[],this.historyAdapter=e.history??new zr,this.baseUrl=this.historyAdapter.origin,this.basePath=e.basePath||"",this.scrollRestoration=e.scrollRestoration??!0,this.viewTransition=e.viewTransition??!1,this.fallbackRoute=e.fallbackRoute,this.routeTree=this.createNode(""),this.enableMetrics=e.enableMetrics??!0,this.reportPerformance=e.reportPerformance,this.analyticsEndpoint=e.analyticsEndpoint,this.timings=new At(e.maxMetricsEntries??100),this.routeStats=new At(e.maxMetricsEntries??100),this.prefetchConfig=e.prefetch,this.prefetchConfig&&this.setupPrefetching(),this.cleanupLinkClick=this.historyAdapter.onLinkClick(this.handleClick.bind(this)),this.cleanupPopState=this.historyAdapter.onPopState(this.handlePopState.bind(this))}handleClick(e){let t=null;for(const r of e.composedPath()){if(r instanceof HTMLAnchorElement){t=r;break}if(!(r instanceof HTMLElement))break}if(!t||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0||t.target==="_blank"||t.hasAttribute("download")||t.getAttribute("rel")==="external")return;const i=t.getAttribute("href");i&&(i.startsWith("http")||i.startsWith("//")||(e.preventDefault(),this.navigate(i)))}handlePopState(){if(this.scrollRestoration){const t=this.historyAdapter.getCurrentPath(),i=this.scrollPositions.get(t);i&&this.historyAdapter.scrollTo(i.x,i.y)}const e=new URL(this.historyAdapter.getCurrentPath(),this.baseUrl);this.currentMatch=this.matchURL(e),this.notifyControllers()}setRoutes(e){this.routes=e,this.compiledRoutes=this.compileRoutes(e),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes)}onBeforeNavigateStart(e){return this.beforeNavigateStartListeners.push(e),()=>{const t=this.beforeNavigateStartListeners.indexOf(e);t>-1&&this.beforeNavigateStartListeners.splice(t,1)}}onAfterNavigateStart(e){return this.afterNavigateStartListeners.push(e),()=>{const t=this.afterNavigateStartListeners.indexOf(e);t>-1&&this.afterNavigateStartListeners.splice(t,1)}}onBeforeNavigateEnd(e){return this.beforeNavigateEndListeners.push(e),()=>{const t=this.beforeNavigateEndListeners.indexOf(e);t>-1&&this.beforeNavigateEndListeners.splice(t,1)}}onAfterNavigateEnd(e){return this.afterNavigateEndListeners.push(e),()=>{const t=this.afterNavigateEndListeners.indexOf(e);t>-1&&this.afterNavigateEndListeners.splice(t,1)}}onNavigateError(e){return this.navigateErrorListeners.push(e),()=>{const t=this.navigateErrorListeners.indexOf(e);t>-1&&this.navigateErrorListeners.splice(t,1)}}async emitBeforeNavigateStart(e){return!(await Promise.all(this.beforeNavigateStartListeners.map(i=>i(e)))).includes(!1)}async emitAfterNavigateStart(e){return!(await Promise.all(this.afterNavigateStartListeners.map(i=>i(e)))).includes(!1)}async emitBeforeNavigateEnd(e){return!(await Promise.all(this.beforeNavigateEndListeners.map(i=>i(e)))).includes(!1)}async emitAfterNavigateEnd(e){return!(await Promise.all(this.afterNavigateEndListeners.map(i=>i(e)))).includes(!1)}emitNavigateError(e){this.navigateErrorListeners.forEach(t=>t(e))}compileRoutes(e,t="",i){const r=[];for(const a of e){const n=this.joinPaths(t,a.path),l=this.basePath+n;try{const o=new URLPattern({pathname:l}),h=a.children?-1:this.calculateRoutePriority(a.path),c={...a,pattern:o,fullPath:n,priority:h,parentRoute:i};if(a.children){const p=this.compileRoutes(a.children,n,c);r.push(...p)}r.push(c)}catch(o){console.error(`Failed to compile route pattern: ${l}`,o)}}return this.resolveReuseFrom(r),r.sort((a,n)=>n.priority-a.priority)}calculateRoutePriority(e){if(e==="/"||e==="")return 100;let t=0;const i=e.split("/").filter(Boolean);for(const r of i)r==="*"||r==="**"||/^\(.*\)$/.test(r)?t+=1:r.startsWith(":")?t+=10:t+=100;return t}createNode(e){return{segment:e,routes:[],children:new Map}}buildRouteTree(e){this.routeTree=this.createNode("");for(const t of e){const i=t.fullPath.split("/").filter(Boolean);let r=this.routeTree;for(const a of i)a==="*"||a==="**"?(r.wildcardChild||(r.wildcardChild=this.createNode(a)),r=r.wildcardChild):a.startsWith(":")?(r.paramChild||(r.paramChild=this.createNode(a)),r=r.paramChild):(r.children.has(a)||r.children.set(a,this.createNode(a)),r=r.children.get(a));r.routes.push(t)}}resolveReuseFrom(e){const t=new Map;for(const n of e)n.name&&t.set(n.name,n);const i=new Set,r=new Set,a=n=>{if(i.has(n)||!n.reuseFrom)return;if(r.has(n)){console.warn(`[Router] Circular reuseFrom detected on route '${n.path}'. Inheritance chain aborted.`);return}r.add(n);const l=n.reuseFrom;if(typeof l=="string"){const o=t.get(l);if(!o)console.warn(`[Router] reuseFrom '${l}' on route '${n.path}' references a route name that does not exist.`);else{a(o);for(const h of Object.keys(o)){if(Ur.has(h))continue;const c=h;n[c]===void 0&&o[c]!==void 0&&(n[c]=o[c])}}}else{const o=Array.isArray(l)?l:[l];for(const h of o){const c=t.get(h.name);if(!c){console.warn(`[Router] reuseFrom '${h.name}' on route '${n.path}' references a route name that does not exist.`);continue}a(c);for(const p of h.properties)n[p]===void 0&&c[p]!==void 0&&(n[p]=c[p])}}r.delete(n),i.add(n)};for(const n of e)a(n)}buildNamedRoutesMap(e){this.namedRoutes.clear();for(const t of e)t.name&&this.namedRoutes.set(t.name,t)}normalizePath(e){return e=e.startsWith("/")?e:"/"+e,e==="/"?e:e.replace(/\/$/,"")}joinPaths(e,t){if(!e)return this.normalizePath(t);if(t.startsWith("/"))return this.normalizePath(t);const i=e.endsWith("/")?e:e+"/";return this.normalizePath(i+t)}async navigate(e,t={}){const i=Date.now(),r=performance.now();let a=0,n=0,l=0,o=0,h=0;try{if(this.navigationDepth++,this.navigationDepth>this.MAX_NAVIGATION_DEPTH)return console.error(`Maximum navigation depth (${this.MAX_NAVIGATION_DEPTH}) exceeded. Possible infinite redirect loop.`),this.navigationDepth=0,!1;this.scrollRestoration&&this.currentMatch&&this.scrollPositions.set(this.currentMatch.path,this.historyAdapter.getScrollPosition());let c;try{c=new URL(e,this.baseUrl)}catch{c=new URL(this.baseUrl+this.basePath+e)}t.query&&Object.entries(t.query).forEach(([$,P])=>{c.searchParams.set($,P)}),t.hash&&(c.hash=t.hash);let p=this.matchURL(c);if(!p&&this.fallbackRoute){const $=new URL(this.basePath+this.fallbackRoute.path,this.baseUrl);p=this.matchURL($)}if(!p)return console.warn(`No route found for ${c.pathname}`),!1;const u=c.pathname+c.search+c.hash,f=new URL(this.historyAdapter.getCurrentPath(),this.baseUrl),m=f.pathname+f.search+f.hash;if(this.currentMatch&&u===m&&!t.replace)return!0;this.pendingPath=this.stripBasePath(c.pathname);const v={from:this.currentMatch,to:p,timestamp:i};if(!await this.emitBeforeNavigateStart(v))return!1;const ne=performance.now();if(!t.skipGuards&&this.currentMatch){for(const $ of[...this.currentMatch.chain].reverse())if($.canDeactivate&&!await $.canDeactivate(p,this.currentMatch))return!1}if(!t.skipGuards){for(const $ of p.chain)if($.beforeEnter&&!await $.beforeEnter(p,this.currentMatch))return!1}if(a=performance.now()-ne,p.redirect){const $=performance.now();if(this.redirectCount++,this.redirectCount>this.MAX_REDIRECTS)return console.error("Maximum redirect limit reached"),this.redirectCount=0,!1;const P=await this.navigate(p.redirect,{...t,replace:!0});return h=performance.now()-$,P}if(this.redirectCount=0,!await this.emitAfterNavigateStart(v))return!1;const ye=performance.now(),ae=c.pathname+c.search+c.hash;t.replace?this.historyAdapter.replaceState(t.state||null,ae):this.historyAdapter.pushState(t.state||null,ae);const Ne=performance.now(),oe=this.currentMatch?`${this.currentMatch.path}:${this.currentMatch.name??""}`:null,H=`${p.path}:${p.name??""}`;if(oe!==H&&this.currentMatch?.animation?.exit){const $=[];this.controllers.forEach(P=>{P.onBeforeMatchChange&&$.push(P.onBeforeMatchChange())}),await Promise.all($)}const Ie=this.resolveViewTransition(p),Be=async()=>{this.currentMatch=p,await this.notifyControllers()};if(Ie&&"startViewTransition"in document){const $=document,P=typeof Ie=="object"?Ie:void 0;let V;P?.types?.length?V=$.startViewTransition({update:Be,types:P.types}):V=$.startViewTransition(Be),P?.onReady&&V.ready.then(()=>P.onReady(V)).catch(()=>{}),await V.finished}else await Be();l=performance.now()-Ne,n=performance.now()-ye-l;const ar=performance.now();if(this.scrollRestoration&&(c.hash?this.historyAdapter.scrollIntoView(c.hash.slice(1)):t.replace||this.historyAdapter.scrollTo(0,0)),o=performance.now()-ar,!await this.emitBeforeNavigateEnd(v))return!1;if(this.enableMetrics){const P={total:performance.now()-r,guards:a,templateRender:n,animations:l,scrollRestoration:o,redirect:h,path:p.path,timestamp:i};if(this.timings.set(p.path,P),this.reportPerformance&&this.reportPerformance(P),this.analyticsEndpoint&&"sendBeacon"in navigator){const V=JSON.stringify({type:"navigation",...P});navigator.sendBeacon(this.analyticsEndpoint,V)}}return await this.emitAfterNavigateEnd(v),this.navigationDepth=0,!0}catch(c){if(this.navigationDepth=0,await this.handleRouteError(c,e,t))return!0;const u={from:this.currentMatch,to:{path:e,params:{},query:new URLSearchParams,hash:"",chain:[]},timestamp:i,error:c};throw this.emitNavigateError(u),c}finally{this.navigationDepth=Math.max(0,this.navigationDepth-1),this.pendingPath=null}}navigateByName(e,t={}){const i=this.namedRoutes.get(e);return i?this.navigate(i.fullPath,t):(console.warn(`No route found with name: ${e}`),Promise.resolve(!1))}findRouteByPath(e){return this.compiledRoutes.find(t=>t.fullPath===e)}match(e){if(e){const i=new URL(e,this.baseUrl);return this.matchURL(i)}const t=new URL(this.historyAdapter.getCurrentURL());return this.matchURL(t)}matchAtDepth(e,t){const i=this.match(t);return i&&i.chain[e]||null}matchURL(e){const t=this.stripBasePath(e.pathname),i=[];for(const r of this.compiledRoutes){const a=r.pattern.exec(e);if(a){const n={};a.pathname.groups&&Object.assign(n,a.pathname.groups);const l={path:r.fullPath,params:n,query:e.searchParams,hash:e.hash,template:r.template,component:r.component,name:r.name,metadata:r.metadata,animation:r.animation,viewTransition:r.viewTransition,beforeEnter:r.beforeEnter,canDeactivate:r.canDeactivate,redirect:r.redirect,chain:[]};if(this.buildChain(i,l,t),l.chain=i,r.lazy){const o=this.lazyCache.get(r),h=this.hasMatchingChildRoute(t,r);if(o&&!(o instanceof Promise)){if(this.enableMetrics){const u=Date.now();this.routeStats.set(`${u}:${r.path}`,{path:r.path,loadTime:0,cacheHit:!0,timestamp:u})}return l}if(h)return l;if(o instanceof Promise)return o.then(()=>this.notifyControllers()).catch(()=>this.notifyControllers()),l.loading=!0,l;const c=performance.now(),p=r.lazy().then(u=>{const f=performance.now()-c;if(this.lazyCache.set(r,u),this.enableMetrics){const v=Date.now();this.routeStats.set(`${v}:${r.path}`,{path:r.path,loadTime:f,cacheHit:!1,timestamp:v})}const m=this.compileRoutes(u,r.fullPath);return this.compiledRoutes.push(...m),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes),u}).catch(u=>{throw this.lazyCache.delete(r),u});return this.lazyCache.set(r,p),p.then(()=>this.notifyControllers()).catch(()=>this.notifyControllers()),l.loading=!0,l}return l}}return null}hasMatchingChildRoute(e,t){return this.compiledRoutes.some(i=>i.fullPath.startsWith(t.fullPath)&&i.fullPath!==t.fullPath)}buildChain(e,t,i){const r=this.compiledRoutes.find(o=>o.fullPath===t.path&&o.name===t.name);if(!r){e.push(t);return}const a=[];let n=r.parentRoute;for(;n;)a.push(n),n=n.parentRoute;a.reverse();const l=new URL(i,this.baseUrl);for(const o of a){const h=o.pattern.exec(l),c={};h?.pathname.groups&&Object.assign(c,h.pathname.groups),e.push({path:o.fullPath,params:c,query:t.query,hash:t.hash,template:o.template,component:o.component,name:o.name,metadata:o.metadata,animation:o.animation,viewTransition:o.viewTransition,beforeEnter:o.beforeEnter,canDeactivate:o.canDeactivate,redirect:o.redirect,chain:[]})}e.push(t)}resolveViewTransition(e){if(e.viewTransition!==void 0)return e.viewTransition;for(let t=e.chain.length-1;t>=0;t--){const i=e.chain[t];if(i.viewTransition!==void 0)return i.viewTransition}return this.viewTransition}stripBasePath(e){return this.basePath&&e.startsWith(this.basePath)?e.slice(this.basePath.length)||"/":e}getCurrentPath(){return this.historyAdapter.getCurrentPath()}isActive(e){const t=this.pendingPath??this.stripBasePath(this.historyAdapter.getCurrentPath());return e==="/"?t==="/":t===e||t.startsWith(e+"/")}getHistoryAdapter(){return this.historyAdapter}dispose(){this.cleanupPopState?.(),this.cleanupLinkClick?.(),this.historyAdapter.dispose()}addController(e){this.controllers.add(e)}removeController(e){this.controllers.delete(e)}async notifyControllers(){const e=[];this.controllers.forEach(t=>e.push(t.routeChanged())),await Promise.all(e)}setupPrefetching(){if(!this.prefetchConfig)return;const{strategy:e,delay:t=50,threshold:i=.1}=this.prefetchConfig,r=typeof document<"u";if(e==="hover"&&r)document.addEventListener("mouseover",a=>{const n=a.target.closest("a");if(!n||!n.href)return;const l=new URL(n.href);l.origin===this.historyAdapter.origin&&setTimeout(()=>{this.preload(l.pathname).catch(()=>{})},t)},{passive:!0});else if(e==="visible"&&r){const a=new IntersectionObserver(o=>{o.forEach(h=>{if(h.isIntersecting){const c=h.target;if(!c.href)return;const p=new URL(c.href);p.origin===this.historyAdapter.origin&&this.preload(p.pathname).catch(()=>{})}})},{threshold:i}),n=()=>{document.querySelectorAll("a[href]").forEach(o=>{a.observe(o)})};n(),new MutationObserver(n).observe(document.body,{childList:!0,subtree:!0})}else if(e==="idle")if(typeof window<"u"&&"requestIdleCallback"in window){const a=()=>{this.preloadAll().catch(()=>{})};window.requestIdleCallback(a,{timeout:2e3})}else setTimeout(()=>this.preloadAll().catch(()=>{}),1e3)}async preload(e){const t=new URL(e,this.baseUrl),i=this.matchURL(t);if(i)for(const r of i.chain){const a=this.findRouteByPath(r.path);if(a&&a.lazy&&!this.lazyCache.has(a)){const n=performance.now(),l=this.prefetchCache.has(a);try{if(l){const h=await this.prefetchCache.get(a);this.lazyCache.set(a,h)}else{const h=a.lazy();this.prefetchCache.set(a,h);const c=await h;this.lazyCache.set(a,c);const p=performance.now()-n;this.routeStats.set(a.path,{path:a.path,loadTime:p,cacheHit:!1,timestamp:Date.now()})}const o=this.lazyCache.get(a);if(Array.isArray(o)){const h=this.compileRoutes(o,a.path);this.compiledRoutes.push(...h),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes)}}catch(o){console.warn(`Failed to preload route ${a.path}:`,o)}}}}async preloadAll(){const e=this.compiledRoutes.filter(t=>t.lazy);await Promise.all(e.map(t=>this.preload(t.fullPath)))}async handleRouteError(e,t,i){const r=new URL(t,this.baseUrl),a=this.matchURL(r);if(!a)return!1;const n=this.findErrorBoundary(a.chain);if(!n)return!1;n.onError&&n.onError(e,a);const l=i._retryCount??0,o=n.maxRetries??3;if(l<o){const c={...i,_retryCount:l+1};n.retrySkipGuards&&(c.skipGuards=!0);try{return await this.navigate(t,c)}catch{}}const h={...a,template:n.fallback,error:e};return this.currentMatch=h,this.notifyControllers(),!0}findErrorBoundary(e){for(let t=e.length-1;t>=0;t--){const i=e[t],r=this.findRouteByPath(i.path);if(r?.errorBoundary)return r.errorBoundary}}getTimings(){return Array.from(this.timings.values())}getLastTiming(){const e=Array.from(this.timings.values());return e[e.length-1]}clearTimings(){this.timings.clear()}getRouteStats(){return Array.from(this.routeStats.values())}getStats(e){return Array.from(this.routeStats.values()).filter(t=>t.path===e).sort((t,i)=>i.timestamp-t.timestamp)[0]}clearStats(){this.routeStats.clear()}getAggregatedStats(){const e=this.getRouteStats(),t=e.length,i=e.filter(n=>n.cacheHit).length,r=e.filter(n=>!n.cacheHit).map(n=>n.loadTime),a=r.length>0?r.reduce((n,l)=>n+l,0)/r.length:0;return{totalLoads:t,cacheHits:i,averageLoadTime:a}}}class Ft{constructor(e,t,i=0){this.host=e,this.router=t,this.depth=i,e.addController(this)}hostConnected(){this.router.addController(this)}hostDisconnected(){this.router.removeController(this)}routeChanged(){return this.host.requestUpdate(),this.host.updateComplete}navigate(e,t){return this.router.navigate(e,t)}navigateByName(e,t){return this.router.navigateByName(e,t)}match(e){return this.router.matchAtDepth(this.depth,e)}getCurrentPath(){return this.router.getCurrentPath()}isActive(e){return this.router.isActive(e)}getDepth(){return this.depth}}const k=new qt;var Mr=Object.defineProperty,Or=Object.getOwnPropertyDescriptor,Te=(s,e,t,i)=>{for(var r=i>1?void 0:i?Or(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Mr(e,t,r),r};const Ht=Symbol("router-depth");let te=class extends _{constructor(){super(...arguments),this.parentDepth=-1,this.routerInstance=k,this.currentDepth=0}connectedCallback(){super.connectedCallback(),this.currentDepth=this.parentDepth+1,this.routerController=new Ft(this,this.routerInstance,this.currentDepth),this.routerController.onBeforeMatchChange=()=>this.playExitAnimation()}async updated(){const s=this.routerController?.match();if(!s?.animation?.enter)return;const e=`${s.path}:${s.name??""}`;if(e===this.previousMatchPath)return;this.previousMatchPath=e;const t=this.shadowRoot?.querySelector(".route-content");t&&(t.getAnimations().forEach(i=>i.cancel()),await s.animation.enter(t))}async playExitAnimation(){const s=this.routerController?.match();if(!s?.animation?.exit)return;const e=this.shadowRoot?.querySelector(".route-content");e&&await s.animation.exit(e)}render(){if(!this.routerController)return d`<slot></slot>`;const s=this.routerController.match();if(!s)return d`<slot></slot>`;if(s.loading)return d`<div class="loading">Loading...</div>`;if(s.error)return d`
			<div class="error">
				<strong>Error:</strong> ${s.error.message}
			</div>
			`;if(s.template)return d`<div class="route-content">${s.template(s.params)}</div>`;if(s.component){const e=document.createElement(s.component);return Object.entries(s.params).forEach(([t,i])=>{e[t]=i}),d`<div class="route-content">${e}</div>`}return d`<slot></slot>`}};te.styles=D`
		:host {
			display: contents;
		}
		.route-content {
			contain: strict;
			display: grid;
			will-change: transform, opacity;
		}
		.loading {
			padding: 20px;
			text-align: center;
			color: #666;
		}
		.error {
			padding: 20px;
			color: #d32f2f;
			background: #ffebee;
			border-radius: 4px;
		}
	`;Te([Ge({context:Ht,subscribe:!0}),R({type:Number})],te.prototype,"parentDepth",2);Te([Ge({context:rt,subscribe:!0}),R({attribute:!1})],te.prototype,"routerInstance",2);Te([Ut({context:Ht}),R({type:Number})],te.prototype,"currentDepth",2);te=Te([U("router-outlet")],te);var Dr=Object.defineProperty,Nr=Object.getOwnPropertyDescriptor,F=(s,e,t,i)=>{for(var r=i>1?void 0:i?Nr(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Dr(e,t,r),r};let O=class extends _{constructor(){super(...arguments),this.to="",this.name="",this.replace=!1,this.activeClass="active",this.routerInstance=k}connectedCallback(){super.connectedCallback(),this.routerController=new Ft(this,this.routerInstance)}async handleClick(s){if(s.preventDefault(),!this.routerController)return;const e={replace:this.replace,query:this.query,hash:this.hash};this.name?await this.routerController.navigateByName(this.name,e):await this.routerController.navigate(this.to,e)}render(){if(!this.routerController)return d`<slot></slot>`;const s=this.routerController.getCurrentPath(),e=this.name?"#":this.to,i=s===this.to?this.activeClass:"";return d`
			<a href="${e}" class="${i}" @click="${this.handleClick}">
				<slot></slot>
			</a>
		`}};O.styles=D`
		:host {
			display: inline;
		}
		a {
			color: inherit;
			text-decoration: inherit;
		}
		a.active {
			font-weight: bold;
		}
	`;F([R({type:String})],O.prototype,"to",2);F([R({type:String})],O.prototype,"name",2);F([R({type:Boolean})],O.prototype,"replace",2);F([R({type:String})],O.prototype,"activeClass",2);F([R({type:Object})],O.prototype,"query",2);F([R({type:String})],O.prototype,"hash",2);F([Ge({context:rt,subscribe:!0}),R({attribute:!1})],O.prototype,"routerInstance",2);O=F([U("router-link")],O);var Ir=Object.defineProperty,Br=Object.getOwnPropertyDescriptor,Vt=(s,e,t,i)=>{for(var r=i>1?void 0:i?Br(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Ir(e,t,r),r};let Fe=class extends _{constructor(s){super(),this.router=new qt(s)}render(){return d`<slot></slot>`}};Vt([Ut({context:rt}),R({attribute:!1})],Fe.prototype,"router",2);Fe=Vt([U("router-provider")],Fe);function w(s,e,t){return s?e(s):t?.(s)}class jr{constructor(){this.currentUser=null,this.hasFetched=!1,this.listeners=new Set,this.isRefreshing=!1,this.refreshPromise=null}async getCurrentUser(){if(!this.hasFetched){try{const e=await fetch("/api/auth/me",{credentials:"include"});if(e.ok){const t=await e.json();this.currentUser=t.username}else this.currentUser=null}catch(e){console.error("[AuthService] Not authenticated (exception):",e),this.currentUser=null}this.hasFetched=!0}return this.currentUser}async login(e){if(!e.trim())return{success:!1,error:"Username cannot be empty"};try{const t=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:e.trim()})});if(t.ok){const i=await t.json();return this.currentUser=i.username,this.hasFetched=!0,this.notifyListeners(),{success:!0}}else return{success:!1,error:await t.text()}}catch(t){return{success:!1,error:t instanceof Error?t.message:"Unknown error"}}}async logout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"include"})}catch{}this.currentUser=null,this.hasFetched=!1,this.notifyListeners()}async isAuthenticated(){return!!await this.getCurrentUser()}onAuthenticationStateChanged(e){return this.listeners.add(e),()=>this.listeners.delete(e)}notifyListeners(){this.listeners.forEach(e=>e())}async refreshToken(){if(this.isRefreshing)return this.refreshPromise??!1;this.isRefreshing=!0,this.refreshPromise=this.performRefresh();try{return await this.refreshPromise}finally{this.isRefreshing=!1,this.refreshPromise=null}}async performRefresh(){try{const e=await fetch("/api/auth/refresh",{method:"POST",credentials:"include"});if(e.ok){const t=await e.json();return this.currentUser=t.username,this.hasFetched=!0,this.notifyListeners(),!0}else return this.currentUser=null,this.hasFetched=!1,this.notifyListeners(),!1}catch(e){return console.error("[AuthService] Token refresh failed:",e),this.currentUser=null,this.hasFetched=!1,this.notifyListeners(),!1}}async fetchWithAuth(e,t={}){const i={...t,credentials:"include"};let r=await fetch(e,i);return r.status===401&&await this.refreshToken()&&(r=await fetch(e,i)),r}}const S=new jr;class qr{constructor(){this.config=null}async getConfig(){if(!this.config){const e=await fetch("/api/config");if(!e.ok)throw new Error(`Failed to fetch registry config: ${e.statusText}`);this.config=await e.json()}return this.config}async isPublic(){return(await this.getConfig()).accessMode==="public"}}const Le=new qr;var Fr=Object.defineProperty,Hr=Object.getOwnPropertyDescriptor,st=(s,e,t,i)=>{for(var r=i>1?void 0:i?Hr(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Fr(e,t,r),r};let me=class extends _{constructor(){super(...arguments),this.currentUser=null,this.accessMode="private"}connectedCallback(){super.connectedCallback(),this.initialize(),k.onAfterNavigateStart(()=>{this.requestUpdate()})}async initialize(){const s=await Le.getConfig();this.accessMode=s.accessMode,this.currentUser=await S.getCurrentUser()}async handleLogout(){await S.logout(),await k.navigate("/login")}render(){return d`
		<header>
			<div class="header-left">
				<span class="logo" @click=${()=>k.navigate("/")}>
					Pivot Registry
				</span>

				<nav>
					<a ?data-active=${k.isActive("/")}        href="/">Dashboard</a>
					<a ?data-active=${k.isActive("/browse")}  href="/browse">Browse</a>
					<a ?data-active=${k.isActive("/explore")} href="/explore">Explorer</a>
					${w(this.currentUser,()=>d`
					<a ?data-active=${k.isActive("/admin")} href="/admin">Admin</a>
					`)}
				</nav>
			</div>

			<div class="header-right">
				${w(this.currentUser,()=>d`
				<span class="user-info">${this.currentUser}</span>
				<button class="logout-btn" @click=${this.handleLogout}>
					Logout
				</button>
				`,()=>d`
				<a class="login-btn" href="/login">Login</a>
				`)}
			</div>
		</header>

		<main>
			<router-outlet></router-outlet>
		</main>
		`}};me.styles=D`
		:host {
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 24px;
			height: 56px;
			background: #1a1a2e;
			color: #fff;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
			z-index: 10;
		}

		.header-left {
			display: flex;
			align-items: center;
			gap: 24px;
		}

		.logo {
			font-size: 18px;
			font-weight: 700;
			letter-spacing: 0.5px;
			cursor: pointer;
			user-select: none;
		}

		nav {
			display: flex;
			gap: 4px;
		}

		nav a {
			color: rgba(255, 255, 255, 0.7);
			text-decoration: none;
			padding: 8px 14px;
			border-radius: 6px;
			font-size: 14px;
			font-weight: 500;
			transition: color 0.15s, background 0.15s;
			cursor: pointer;
		}

		nav a:hover {
			color: #fff;
			background: rgba(255, 255, 255, 0.1);
		}

		nav a[data-active] {
			color: #fff;
			background: rgba(255, 255, 255, 0.15);
		}

		.header-right {
			display: flex;
			align-items: center;
			gap: 16px;
		}

		.user-info {
			font-size: 13px;
			color: rgba(255, 255, 255, 0.7);
		}

		.logout-btn {
			background: none;
			border: 1px solid rgba(255, 255, 255, 0.3);
			color: rgba(255, 255, 255, 0.8);
			padding: 6px 14px;
			border-radius: 6px;
			font-size: 13px;
			cursor: pointer;
			transition: border-color 0.15s, color 0.15s;
		}

		.logout-btn:hover {
			border-color: rgba(255, 255, 255, 0.6);
			color: #fff;
		}

		.login-btn {
			border: 1px solid rgba(255, 255, 255, 0.3);
			color: rgba(255, 255, 255, 0.8);
			padding: 6px 14px;
			border-radius: 6px;
			font-size: 13px;
			text-decoration: none;
			cursor: pointer;
			transition: border-color 0.15s, color 0.15s, background 0.15s;
		}

		.login-btn:hover {
			border-color: rgba(255, 255, 255, 0.6);
			color: #fff;
			background: rgba(255, 255, 255, 0.1);
		}

		main {
			flex: 1;
			display: grid;
		}
	`;st([g()],me.prototype,"currentUser",2);st([g()],me.prototype,"accessMode",2);me=st([U("app-layout")],me);var Vr=Object.defineProperty,Wr=Object.getOwnPropertyDescriptor,ze=(s,e,t,i)=>{for(var r=i>1?void 0:i?Wr(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Vr(e,t,r),r};let re=class extends _{constructor(){super(...arguments),this.username="",this.errorMessage="",this.isLoggingIn=!1}async handleLogin(){if(this.errorMessage="",!this.username.trim()){this.errorMessage="Please enter a username";return}try{this.isLoggingIn=!0;const s=await S.login(this.username.trim());s.success?await k.navigate("/"):this.errorMessage=s.error??"Login failed"}catch(s){this.errorMessage=`Login failed: ${s instanceof Error?s.message:"Unknown error"}`}finally{this.isLoggingIn=!1}}handleKeyPress(s){s.key==="Enter"&&this.handleLogin()}render(){return d`
			<div class="login-container">
				<div class="login-box">
					<h1>Pivot Registry Login</h1>
					<p class="login-subtitle">Enter your username to continue</p>

					${this.errorMessage?d`<div class="alert alert-danger">${this.errorMessage}</div>`:""}

					<div class="login-form">
						<div class="form-group">
							<label for="username">Username</label>
							<input
								id="username"
								type="text"
								class="form-control"
								.value=${this.username}
								@input=${s=>{this.username=s.target.value}}
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
		`}};re.styles=D`
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
	`;ze([g()],re.prototype,"username",2);ze([g()],re.prototype,"errorMessage",2);ze([g()],re.prototype,"isLoggingIn",2);re=ze([U("login-page")],re);class Zr{async getPlugins(e){const t=new URLSearchParams;e?.search&&t.set("search",e.search),e?.tag&&t.set("tag",e.tag),e?.page&&t.set("page",e.page.toString()),e?.pageSize&&t.set("pageSize",e.pageSize.toString());const i=`/api/plugins${t.toString()?"?"+t.toString():""}`,r=await S.fetchWithAuth(i);if(!r.ok)throw new Error(`Failed to fetch plugins: ${r.statusText}`);return await r.json()}async getPlugin(e){const t=await S.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}`);if(!t.ok)throw new Error(`Failed to fetch plugin: ${t.statusText}`);return await t.json()}async deleteVersion(e,t){const i=await S.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}/versions/${encodeURIComponent(t)}`,{method:"DELETE"});if(!i.ok)throw new Error(`Failed to delete plugin version: ${i.statusText}`)}async downloadPlugin(e,t){const i=await S.fetchWithAuth(`/api/plugins/${encodeURIComponent(e)}/versions/${encodeURIComponent(t)}/download`);if(!i.ok)throw new Error(`Failed to download plugin: ${i.statusText}`);return await i.blob()}async uploadPlugin(e){const t=new FormData;t.append("file",e);const i=await S.fetchWithAuth("/api/plugins/upload",{method:"POST",body:t});if(!i.ok){const r=await i.json();throw new Error(r.error||`Failed to upload plugin: ${i.statusText}`)}return await i.json()}}const T=new Zr,Wt=s=>{const e=["B","KB","MB","GB"];let t=s,i=0;for(;t>=1024&&i<e.length-1;)i++,t=t/1024;return`${t.toFixed(2)} ${e[i]}`},Zt=s=>new Date(s).toLocaleString();var Gr=Object.defineProperty,Kr=Object.getOwnPropertyDescriptor,N=(s,e,t,i)=>{for(var r=i>1?void 0:i?Kr(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Gr(e,t,r),r};let L=class extends _{constructor(){super(...arguments),this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.expandedPlugin=null,this.pluginDetails=new Map,this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){this.currentUser=await S.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const s=await T.getPlugins({pageSize:100});this.plugins=s.plugins.filter(e=>e.author===this.currentUser)}catch(s){console.error("Failed to load plugins:",s)}finally{this.loading=!1}}async toggleExpand(s){if(this.expandedPlugin===s){this.expandedPlugin=null;return}if(this.expandedPlugin=s,!this.pluginDetails.has(s))try{const e=await T.getPlugin(s);this.pluginDetails=new Map(this.pluginDetails).set(s,e)}catch(e){console.error("Failed to load plugin details:",e)}}async deleteVersion(s,e){if(confirm(`Delete ${s} version ${e}?`))try{await T.deleteVersion(s,e);const t=await T.getPlugin(s);this.pluginDetails=new Map(this.pluginDetails).set(s,t),await this.loadPlugins()}catch(t){console.error("Failed to delete version:",t),alert("Failed to delete plugin version")}}async handleLogout(){await S.logout(),await k.navigate("/login")}handleFileSelect(s){const e=s.target;this.selectedFile=e.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const s=await T.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${s.plugin} v${s.version}`,this.selectedFile=null;const e=this.shadowRoot?.querySelector("#plugin-file");e&&(e.value=""),await this.loadPlugins()}catch(s){this.uploadError=s instanceof Error?s.message:"Upload failed"}finally{this.uploadProgress=!1}}renderUploadSection(){return d`
			<section class="section">
				<h2>Upload Plugin Package</h2>

				${w(this.uploadStatus,()=>d`
				<div class="alert alert-success">${this.uploadStatus}</div>
				`)}
				${w(this.uploadError,()=>d`
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

					${w(this.uploadProgress,()=>d`
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
		`}renderVersionsForPlugin(s){const e=this.pluginDetails.get(s);if(!e)return d`<div class="loading">Loading versions...</div>`;const t=e.versions;return!t||t.length===0?d`<p>No versions.</p>`:d`
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
					${t.map(i=>d`
					<tr>
						<td>${i.version}</td>
						<td>${Wt(i.fileSize)}</td>
						<td>${i.downloadCount}</td>
						<td>${Zt(i.uploadedAt)}</td>
						<td>
							<button
								class="btn-small btn-danger"
								@click=${()=>this.deleteVersion(s,i.version)}
							>
								Delete
							</button>
						</td>
					</tr>
					`)}
				</tbody>
			</table>
		`}renderPluginList(){return this.loading?d`<div class="loading">Loading...</div>`:this.plugins.length===0?d`
			<div class="empty-state">
				<p>You have no plugins to manage. Upload a plugin to get started.</p>
			</div>
			`:this.plugins.map(s=>d`
		<div class="admin-plugin-card">
			<div
				class="admin-plugin-header"
				@click=${()=>this.toggleExpand(s.name)}
			>
				<div class="admin-plugin-info">
					<strong>${s.name}</strong>
					<span class="plugin-meta">
						v${s.latestVersion??"N/A"}
						· ${s.versionCount??0} versions
						· ${s.totalDownloads??0} downloads
					</span>
				</div>
				<span class="expand-icon">
					${w(this.expandedPlugin===s.name,()=>"▼",()=>"▶")}
				</span>
			</div>
			${w(this.expandedPlugin===s.name,()=>d`
				<div class="admin-plugin-body">
					${this.renderVersionsForPlugin(s.name)}
				</div>
			`)}
		</div>
	`)}renderStats(){const s=this.plugins.length,e=this.plugins.reduce((i,r)=>i+(r.versionCount??0),0),t=this.plugins.reduce((i,r)=>i+(r.totalDownloads??0),0);return d`
			<div class="stats-grid">
				<div class="stat-card">
					<h3>Your Plugins</h3>
					<p class="stat-value">${s}</p>
				</div>
				<div class="stat-card">
					<h3>Total Versions</h3>
					<p class="stat-value">${e}</p>
				</div>
				<div class="stat-card">
					<h3>Total Downloads</h3>
					<p class="stat-value">${t}</p>
				</div>
			</div>
		`}render(){return d`
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
		`}};L.styles=D`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
			margin: 0 auto;
		}

		h1 {
			margin: 0;
			color: #333;
		}

		h2 {
			color: #333;
			margin: 0 0 16px;
		}

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.header-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.section {
			margin-top: 24px;
		}

		/* Stats */
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-bottom: 24px;
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

		/* Plugin cards */
		.admin-plugin-card {
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			margin-bottom: 12px;
			overflow: hidden;
		}

		.admin-plugin-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 20px;
			cursor: pointer;
			transition: background 0.2s;
		}

		.admin-plugin-header:hover {
			background: #f8f9fa;
		}

		.admin-plugin-info {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.plugin-meta {
			font-size: 13px;
			color: #888;
		}

		.expand-icon {
			color: #667eea;
			font-size: 12px;
		}

		.admin-plugin-body {
			padding: 0 20px 20px;
			border-top: 1px solid #eee;
		}

		/* Upload */
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

		/* Versions table */
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 16px;
		}

		.versions-table thead {
			background: #f8f9fa;
		}

		.versions-table th {
			padding: 10px 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.versions-table td {
			padding: 10px 12px;
			border-bottom: 1px solid #eee;
		}

		.versions-table tbody tr:hover {
			background: #f8f9fa;
		}

		/* Alerts */
		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
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

		/* Buttons */
		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
			text-decoration: none;
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

		.btn-secondary {
			background: #6c757d;
			color: white;
		}

		.btn-secondary:hover {
			background: #5a6268;
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

		/* States */
		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #666;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}
	`;N([g()],L.prototype,"plugins",2);N([g()],L.prototype,"loading",2);N([g()],L.prototype,"currentUser",2);N([g()],L.prototype,"uploadStatus",2);N([g()],L.prototype,"uploadError",2);N([g()],L.prototype,"uploadProgress",2);N([g()],L.prototype,"expandedPlugin",2);N([g()],L.prototype,"pluginDetails",2);L=N([U("plugin-admin")],L);var Xr=Object.defineProperty,Qr=Object.getOwnPropertyDescriptor,se=(s,e,t,i)=>{for(var r=i>1?void 0:i?Qr(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Xr(e,t,r),r};let j=class extends _{constructor(){super(...arguments),this.plugins=[],this.loading=!1,this.search="",this.page=1,this.totalPages=1}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const s=await T.getPlugins({search:this.search||void 0,page:this.page,pageSize:20});this.plugins=s.plugins,this.totalPages=s.totalPages}catch(s){console.error("Failed to load plugins:",s)}finally{this.loading=!1}}handleSearchInput(s){this.search=s.target.value}async handleSearch(s){s?.preventDefault(),this.page=1,await this.loadPlugins()}async handlePageChange(s){this.page=s,await this.loadPlugins()}async viewPluginDetails(s){await k.navigate(`/plugin/${encodeURIComponent(s)}`)}renderPagination(){return this.totalPages<=1?y:d`
			<div class="pagination">
				<button
					class="btn btn-secondary btn-small"
					?disabled=${this.page<=1}
					@click=${()=>this.handlePageChange(this.page-1)}
				>
					Previous
				</button>
				<span class="page-info">Page ${this.page} of ${this.totalPages}</span>
				<button
					class="btn btn-secondary btn-small"
					?disabled=${this.page>=this.totalPages}
					@click=${()=>this.handlePageChange(this.page+1)}
				>
					Next
				</button>
			</div>
		`}render(){return d`
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

			${w(this.loading,()=>d`
				<div class="loading">Loading...</div>
			`,()=>w(this.plugins.length===0,()=>d`
				<p class="empty-state">No plugins found.</p>
			`,()=>d`
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
						${this.plugins.map(s=>d`
							<tr>
								<td><strong>${s.name}</strong></td>
								<td>${s.latestVersion??"N/A"}</td>
								<td>${s.author??""}</td>
								<td>${s.description??""}</td>
								<td>${s.totalDownloads??0}</td>
								<td>
									<button
										class="btn-small btn-primary"
										@click=${()=>this.viewPluginDetails(s.name)}
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
		`}};j.styles=D`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
		}

		h1 {
			margin: 0;
			color: #333;
		}

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.header-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.search-bar {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		}

		.search-input {
			flex: 1;
			padding: 10px 16px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			transition: border-color 0.3s;
		}

		.search-input:focus {
			outline: none;
			border-color: #667eea;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
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

		.pagination {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 16px;
			margin-top: 20px;
			padding: 16px 0;
		}

		.page-info {
			font-size: 14px;
			color: #666;
		}

		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
			text-decoration: none;
		}

		.btn-primary {
			background: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.btn-secondary {
			background: #6c757d;
			color: white;
		}

		.btn-secondary:hover {
			background: #5a6268;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.btn:disabled,
		.btn-small:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`;se([g()],j.prototype,"plugins",2);se([g()],j.prototype,"loading",2);se([g()],j.prototype,"search",2);se([g()],j.prototype,"page",2);se([g()],j.prototype,"totalPages",2);j=se([U("plugin-browse")],j);const Yr={CHILD:2},Jr=s=>(...e)=>({_$litDirective$:s,values:e});class es{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,i){this._$Ct=e,this._$AM=t,this._$Ci=i}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}}class He extends es{constructor(e){if(super(e),this.it=y,e.type!==Yr.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===y||e==null)return this._t=void 0,this.it=e;if(e===K)return e;if(typeof e!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const t=[e];return t.raw=t,this._t={_$litType$:this.constructor.resultType,strings:t,values:[]}}}He.directiveName="unsafeHTML",He.resultType=1;const ts=Jr(He);function it(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Y=it();function Gt(s){Y=s}var ge={exec:()=>null};function b(s,e=""){let t=typeof s=="string"?s:s.source,i={replace:(r,a)=>{let n=typeof a=="string"?a:a.source;return n=n.replace(A.caret,"$1"),t=t.replace(r,n),i},getRegex:()=>new RegExp(t,e)};return i}var rs=(()=>{try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}})(),A={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:s=>new RegExp(`^( {0,3}${s})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:s=>new RegExp(`^ {0,${Math.min(3,s-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:s=>new RegExp(`^ {0,${Math.min(3,s-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:s=>new RegExp(`^ {0,${Math.min(3,s-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:s=>new RegExp(`^ {0,${Math.min(3,s-1)}}#`),htmlBeginRegex:s=>new RegExp(`^ {0,${Math.min(3,s-1)}}<(?:[a-z].*>|!--)`,"i")},ss=/^(?:[ \t]*(?:\n|$))+/,is=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ns=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,xe=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,as=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,nt=/(?:[*+-]|\d{1,9}[.)])/,Kt=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,Xt=b(Kt).replace(/bull/g,nt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),os=b(Kt).replace(/bull/g,nt).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),at=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,ls=/^[^\n]+/,ot=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,cs=b(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",ot).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),hs=b(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,nt).getRegex(),Ue="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",lt=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,ps=b("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",lt).replace("tag",Ue).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Qt=b(at).replace("hr",xe).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ue).getRegex(),ds=b(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Qt).getRegex(),ct={blockquote:ds,code:is,def:cs,fences:ns,heading:as,hr:xe,html:ps,lheading:Xt,list:hs,newline:ss,paragraph:Qt,table:ge,text:ls},_t=b("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",xe).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ue).getRegex(),us={...ct,lheading:os,table:_t,paragraph:b(at).replace("hr",xe).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",_t).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ue).getRegex()},gs={...ct,html:b(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",lt).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:ge,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:b(at).replace("hr",xe).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Xt).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},fs=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,bs=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Yt=/^( {2,}|\\)\n(?!\s*$)/,ms=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Me=/[\p{P}\p{S}]/u,ht=/[\s\p{P}\p{S}]/u,Jt=/[^\s\p{P}\p{S}]/u,xs=b(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,ht).getRegex(),er=/(?!~)[\p{P}\p{S}]/u,ws=/(?!~)[\s\p{P}\p{S}]/u,ys=/(?:[^\s\p{P}\p{S}]|~)/u,vs=b(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",rs?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),tr=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,ks=b(tr,"u").replace(/punct/g,Me).getRegex(),$s=b(tr,"u").replace(/punct/g,er).getRegex(),rr="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Ps=b(rr,"gu").replace(/notPunctSpace/g,Jt).replace(/punctSpace/g,ht).replace(/punct/g,Me).getRegex(),Ss=b(rr,"gu").replace(/notPunctSpace/g,ys).replace(/punctSpace/g,ws).replace(/punct/g,er).getRegex(),As=b("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Jt).replace(/punctSpace/g,ht).replace(/punct/g,Me).getRegex(),_s=b(/\\(punct)/,"gu").replace(/punct/g,Me).getRegex(),Rs=b(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Cs=b(lt).replace("(?:-->|$)","-->").getRegex(),Es=b("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Cs).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Se=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,Ts=b(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",Se).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),sr=b(/^!?\[(label)\]\[(ref)\]/).replace("label",Se).replace("ref",ot).getRegex(),ir=b(/^!?\[(ref)\](?:\[\])?/).replace("ref",ot).getRegex(),Ls=b("reflink|nolink(?!\\()","g").replace("reflink",sr).replace("nolink",ir).getRegex(),Rt=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,pt={_backpedal:ge,anyPunctuation:_s,autolink:Rs,blockSkip:vs,br:Yt,code:bs,del:ge,emStrongLDelim:ks,emStrongRDelimAst:Ps,emStrongRDelimUnd:As,escape:fs,link:Ts,nolink:ir,punctuation:xs,reflink:sr,reflinkSearch:Ls,tag:Es,text:ms,url:ge},zs={...pt,link:b(/^!?\[(label)\]\((.*?)\)/).replace("label",Se).getRegex(),reflink:b(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Se).getRegex()},Ve={...pt,emStrongRDelimAst:Ss,emStrongLDelim:$s,url:b(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",Rt).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:b(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",Rt).getRegex()},Us={...Ve,br:b(Yt).replace("{2,}","*").getRegex(),text:b(Ve.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},ve={normal:ct,gfm:us,pedantic:gs},ce={normal:pt,gfm:Ve,breaks:Us,pedantic:zs},Ms={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Ct=s=>Ms[s];function M(s,e){if(e){if(A.escapeTest.test(s))return s.replace(A.escapeReplace,Ct)}else if(A.escapeTestNoEncode.test(s))return s.replace(A.escapeReplaceNoEncode,Ct);return s}function Et(s){try{s=encodeURI(s).replace(A.percentDecode,"%")}catch{return null}return s}function Tt(s,e){let t=s.replace(A.findPipe,(a,n,l)=>{let o=!1,h=n;for(;--h>=0&&l[h]==="\\";)o=!o;return o?"|":" |"}),i=t.split(A.splitPipe),r=0;if(i[0].trim()||i.shift(),i.length>0&&!i.at(-1)?.trim()&&i.pop(),e)if(i.length>e)i.splice(e);else for(;i.length<e;)i.push("");for(;r<i.length;r++)i[r]=i[r].trim().replace(A.slashPipe,"|");return i}function he(s,e,t){let i=s.length;if(i===0)return"";let r=0;for(;r<i&&s.charAt(i-r-1)===e;)r++;return s.slice(0,i-r)}function Os(s,e){if(s.indexOf(e[1])===-1)return-1;let t=0;for(let i=0;i<s.length;i++)if(s[i]==="\\")i++;else if(s[i]===e[0])t++;else if(s[i]===e[1]&&(t--,t<0))return i;return t>0?-2:-1}function Lt(s,e,t,i,r){let a=e.href,n=e.title||null,l=s[1].replace(r.other.outputLinkReplace,"$1");i.state.inLink=!0;let o={type:s[0].charAt(0)==="!"?"image":"link",raw:t,href:a,title:n,text:l,tokens:i.inlineTokens(l)};return i.state.inLink=!1,o}function Ds(s,e,t){let i=s.match(t.other.indentCodeCompensation);if(i===null)return e;let r=i[1];return e.split(`
`).map(a=>{let n=a.match(t.other.beginningSpace);if(n===null)return a;let[l]=n;return l.length>=r.length?a.slice(r.length):a}).join(`
`)}var Ae=class{options;rules;lexer;constructor(s){this.options=s||Y}space(s){let e=this.rules.block.newline.exec(s);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(s){let e=this.rules.block.code.exec(s);if(e){let t=e[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:e[0],codeBlockStyle:"indented",text:this.options.pedantic?t:he(t,`
`)}}}fences(s){let e=this.rules.block.fences.exec(s);if(e){let t=e[0],i=Ds(t,e[3]||"",this.rules);return{type:"code",raw:t,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:i}}}heading(s){let e=this.rules.block.heading.exec(s);if(e){let t=e[2].trim();if(this.rules.other.endingHash.test(t)){let i=he(t,"#");(this.options.pedantic||!i||this.rules.other.endingSpaceChar.test(i))&&(t=i.trim())}return{type:"heading",raw:e[0],depth:e[1].length,text:t,tokens:this.lexer.inline(t)}}}hr(s){let e=this.rules.block.hr.exec(s);if(e)return{type:"hr",raw:he(e[0],`
`)}}blockquote(s){let e=this.rules.block.blockquote.exec(s);if(e){let t=he(e[0],`
`).split(`
`),i="",r="",a=[];for(;t.length>0;){let n=!1,l=[],o;for(o=0;o<t.length;o++)if(this.rules.other.blockquoteStart.test(t[o]))l.push(t[o]),n=!0;else if(!n)l.push(t[o]);else break;t=t.slice(o);let h=l.join(`
`),c=h.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");i=i?`${i}
${h}`:h,r=r?`${r}
${c}`:c;let p=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(c,a,!0),this.lexer.state.top=p,t.length===0)break;let u=a.at(-1);if(u?.type==="code")break;if(u?.type==="blockquote"){let f=u,m=f.raw+`
`+t.join(`
`),v=this.blockquote(m);a[a.length-1]=v,i=i.substring(0,i.length-f.raw.length)+v.raw,r=r.substring(0,r.length-f.text.length)+v.text;break}else if(u?.type==="list"){let f=u,m=f.raw+`
`+t.join(`
`),v=this.list(m);a[a.length-1]=v,i=i.substring(0,i.length-u.raw.length)+v.raw,r=r.substring(0,r.length-f.raw.length)+v.raw,t=m.substring(a.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:i,tokens:a,text:r}}}list(s){let e=this.rules.block.list.exec(s);if(e){let t=e[1].trim(),i=t.length>1,r={type:"list",raw:"",ordered:i,start:i?+t.slice(0,-1):"",loose:!1,items:[]};t=i?`\\d{1,9}\\${t.slice(-1)}`:`\\${t}`,this.options.pedantic&&(t=i?t:"[*+-]");let a=this.rules.other.listItemRegex(t),n=!1;for(;s;){let o=!1,h="",c="";if(!(e=a.exec(s))||this.rules.block.hr.test(s))break;h=e[0],s=s.substring(h.length);let p=e[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,ne=>" ".repeat(3*ne.length)),u=s.split(`
`,1)[0],f=!p.trim(),m=0;if(this.options.pedantic?(m=2,c=p.trimStart()):f?m=e[1].length+1:(m=e[2].search(this.rules.other.nonSpaceChar),m=m>4?1:m,c=p.slice(m),m+=e[1].length),f&&this.rules.other.blankLine.test(u)&&(h+=u+`
`,s=s.substring(u.length+1),o=!0),!o){let ne=this.rules.other.nextBulletRegex(m),De=this.rules.other.hrRegex(m),ye=this.rules.other.fencesBeginRegex(m),ae=this.rules.other.headingBeginRegex(m),Ne=this.rules.other.htmlBeginRegex(m);for(;s;){let oe=s.split(`
`,1)[0],H;if(u=oe,this.options.pedantic?(u=u.replace(this.rules.other.listReplaceNesting,"  "),H=u):H=u.replace(this.rules.other.tabCharGlobal,"    "),ye.test(u)||ae.test(u)||Ne.test(u)||ne.test(u)||De.test(u))break;if(H.search(this.rules.other.nonSpaceChar)>=m||!u.trim())c+=`
`+H.slice(m);else{if(f||p.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||ye.test(p)||ae.test(p)||De.test(p))break;c+=`
`+u}!f&&!u.trim()&&(f=!0),h+=oe+`
`,s=s.substring(oe.length+1),p=H.slice(m)}}r.loose||(n?r.loose=!0:this.rules.other.doubleBlankLine.test(h)&&(n=!0));let v=null,Oe;this.options.gfm&&(v=this.rules.other.listIsTask.exec(c),v&&(Oe=v[0]!=="[ ] ",c=c.replace(this.rules.other.listReplaceTask,""))),r.items.push({type:"list_item",raw:h,task:!!v,checked:Oe,loose:!1,text:c,tokens:[]}),r.raw+=h}let l=r.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;r.raw=r.raw.trimEnd();for(let o=0;o<r.items.length;o++)if(this.lexer.state.top=!1,r.items[o].tokens=this.lexer.blockTokens(r.items[o].text,[]),!r.loose){let h=r.items[o].tokens.filter(p=>p.type==="space"),c=h.length>0&&h.some(p=>this.rules.other.anyLine.test(p.raw));r.loose=c}if(r.loose)for(let o=0;o<r.items.length;o++)r.items[o].loose=!0;return r}}html(s){let e=this.rules.block.html.exec(s);if(e)return{type:"html",block:!0,raw:e[0],pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:e[0]}}def(s){let e=this.rules.block.def.exec(s);if(e){let t=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),i=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",r=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:t,raw:e[0],href:i,title:r}}}table(s){let e=this.rules.block.table.exec(s);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;let t=Tt(e[1]),i=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),r=e[3]?.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],a={type:"table",raw:e[0],header:[],align:[],rows:[]};if(t.length===i.length){for(let n of i)this.rules.other.tableAlignRight.test(n)?a.align.push("right"):this.rules.other.tableAlignCenter.test(n)?a.align.push("center"):this.rules.other.tableAlignLeft.test(n)?a.align.push("left"):a.align.push(null);for(let n=0;n<t.length;n++)a.header.push({text:t[n],tokens:this.lexer.inline(t[n]),header:!0,align:a.align[n]});for(let n of r)a.rows.push(Tt(n,a.header.length).map((l,o)=>({text:l,tokens:this.lexer.inline(l),header:!1,align:a.align[o]})));return a}}lheading(s){let e=this.rules.block.lheading.exec(s);if(e)return{type:"heading",raw:e[0],depth:e[2].charAt(0)==="="?1:2,text:e[1],tokens:this.lexer.inline(e[1])}}paragraph(s){let e=this.rules.block.paragraph.exec(s);if(e){let t=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:t,tokens:this.lexer.inline(t)}}}text(s){let e=this.rules.block.text.exec(s);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(s){let e=this.rules.inline.escape.exec(s);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(s){let e=this.rules.inline.tag.exec(s);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(s){let e=this.rules.inline.link.exec(s);if(e){let t=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(t)){if(!this.rules.other.endAngleBracket.test(t))return;let a=he(t.slice(0,-1),"\\");if((t.length-a.length)%2===0)return}else{let a=Os(e[2],"()");if(a===-2)return;if(a>-1){let n=(e[0].indexOf("!")===0?5:4)+e[1].length+a;e[2]=e[2].substring(0,a),e[0]=e[0].substring(0,n).trim(),e[3]=""}}let i=e[2],r="";if(this.options.pedantic){let a=this.rules.other.pedanticHrefTitle.exec(i);a&&(i=a[1],r=a[3])}else r=e[3]?e[3].slice(1,-1):"";return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(t)?i=i.slice(1):i=i.slice(1,-1)),Lt(e,{href:i&&i.replace(this.rules.inline.anyPunctuation,"$1"),title:r&&r.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(s,e){let t;if((t=this.rules.inline.reflink.exec(s))||(t=this.rules.inline.nolink.exec(s))){let i=(t[2]||t[1]).replace(this.rules.other.multipleSpaceGlobal," "),r=e[i.toLowerCase()];if(!r){let a=t[0].charAt(0);return{type:"text",raw:a,text:a}}return Lt(t,r,t[0],this.lexer,this.rules)}}emStrong(s,e,t=""){let i=this.rules.inline.emStrongLDelim.exec(s);if(!(!i||i[3]&&t.match(this.rules.other.unicodeAlphaNumeric))&&(!(i[1]||i[2])||!t||this.rules.inline.punctuation.exec(t))){let r=[...i[0]].length-1,a,n,l=r,o=0,h=i[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(h.lastIndex=0,e=e.slice(-1*s.length+r);(i=h.exec(e))!=null;){if(a=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!a)continue;if(n=[...a].length,i[3]||i[4]){l+=n;continue}else if((i[5]||i[6])&&r%3&&!((r+n)%3)){o+=n;continue}if(l-=n,l>0)continue;n=Math.min(n,n+l+o);let c=[...i[0]][0].length,p=s.slice(0,r+i.index+c+n);if(Math.min(r,n)%2){let f=p.slice(1,-1);return{type:"em",raw:p,text:f,tokens:this.lexer.inlineTokens(f)}}let u=p.slice(2,-2);return{type:"strong",raw:p,text:u,tokens:this.lexer.inlineTokens(u)}}}}codespan(s){let e=this.rules.inline.code.exec(s);if(e){let t=e[2].replace(this.rules.other.newLineCharGlobal," "),i=this.rules.other.nonSpaceChar.test(t),r=this.rules.other.startingSpaceChar.test(t)&&this.rules.other.endingSpaceChar.test(t);return i&&r&&(t=t.substring(1,t.length-1)),{type:"codespan",raw:e[0],text:t}}}br(s){let e=this.rules.inline.br.exec(s);if(e)return{type:"br",raw:e[0]}}del(s){let e=this.rules.inline.del.exec(s);if(e)return{type:"del",raw:e[0],text:e[2],tokens:this.lexer.inlineTokens(e[2])}}autolink(s){let e=this.rules.inline.autolink.exec(s);if(e){let t,i;return e[2]==="@"?(t=e[1],i="mailto:"+t):(t=e[1],i=t),{type:"link",raw:e[0],text:t,href:i,tokens:[{type:"text",raw:t,text:t}]}}}url(s){let e;if(e=this.rules.inline.url.exec(s)){let t,i;if(e[2]==="@")t=e[0],i="mailto:"+t;else{let r;do r=e[0],e[0]=this.rules.inline._backpedal.exec(e[0])?.[0]??"";while(r!==e[0]);t=e[0],e[1]==="www."?i="http://"+e[0]:i=e[0]}return{type:"link",raw:e[0],text:t,href:i,tokens:[{type:"text",raw:t,text:t}]}}}inlineText(s){let e=this.rules.inline.text.exec(s);if(e){let t=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:t}}}},C=class We{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Y,this.options.tokenizer=this.options.tokenizer||new Ae,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let t={other:A,block:ve.normal,inline:ce.normal};this.options.pedantic?(t.block=ve.pedantic,t.inline=ce.pedantic):this.options.gfm&&(t.block=ve.gfm,this.options.breaks?t.inline=ce.breaks:t.inline=ce.gfm),this.tokenizer.rules=t}static get rules(){return{block:ve,inline:ce}}static lex(e,t){return new We(t).lex(e)}static lexInline(e,t){return new We(t).inlineTokens(e)}lex(e){e=e.replace(A.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let t=0;t<this.inlineQueue.length;t++){let i=this.inlineQueue[t];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],i=!1){for(this.options.pedantic&&(e=e.replace(A.tabCharGlobal,"    ").replace(A.spaceLine,""));e;){let r;if(this.options.extensions?.block?.some(n=>(r=n.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let n=t.at(-1);r.raw.length===1&&n!==void 0?n.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type==="paragraph"||n?.type==="text"?(n.raw+=(n.raw.endsWith(`
`)?"":`
`)+r.raw,n.text+=`
`+r.text,this.inlineQueue.at(-1).src=n.text):t.push(r);continue}if(r=this.tokenizer.fences(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.heading(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.hr(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.blockquote(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.list(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.html(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type==="paragraph"||n?.type==="text"?(n.raw+=(n.raw.endsWith(`
`)?"":`
`)+r.raw,n.text+=`
`+r.raw,this.inlineQueue.at(-1).src=n.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title},t.push(r));continue}if(r=this.tokenizer.table(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.lheading(e)){e=e.substring(r.raw.length),t.push(r);continue}let a=e;if(this.options.extensions?.startBlock){let n=1/0,l=e.slice(1),o;this.options.extensions.startBlock.forEach(h=>{o=h.call({lexer:this},l),typeof o=="number"&&o>=0&&(n=Math.min(n,o))}),n<1/0&&n>=0&&(a=e.substring(0,n+1))}if(this.state.top&&(r=this.tokenizer.paragraph(a))){let n=t.at(-1);i&&n?.type==="paragraph"?(n.raw+=(n.raw.endsWith(`
`)?"":`
`)+r.raw,n.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(r),i=a.length!==e.length,e=e.substring(r.raw.length);continue}if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let n=t.at(-1);n?.type==="text"?(n.raw+=(n.raw.endsWith(`
`)?"":`
`)+r.raw,n.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=n.text):t.push(r);continue}if(e){let n="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(n);break}else throw new Error(n)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let i=e,r=null;if(this.tokens.links){let o=Object.keys(this.tokens.links);if(o.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(i))!=null;)o.includes(r[0].slice(r[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,r.index)+"["+"a".repeat(r[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(i))!=null;)i=i.slice(0,r.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let a;for(;(r=this.tokenizer.rules.inline.blockSkip.exec(i))!=null;)a=r[2]?r[2].length:0,i=i.slice(0,r.index+a)+"["+"a".repeat(r[0].length-a-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);i=this.options.hooks?.emStrongMask?.call({lexer:this},i)??i;let n=!1,l="";for(;e;){n||(l=""),n=!1;let o;if(this.options.extensions?.inline?.some(c=>(o=c.call({lexer:this},e,t))?(e=e.substring(o.raw.length),t.push(o),!0):!1))continue;if(o=this.tokenizer.escape(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.tag(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.link(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(o.raw.length);let c=t.at(-1);o.type==="text"&&c?.type==="text"?(c.raw+=o.raw,c.text+=o.text):t.push(o);continue}if(o=this.tokenizer.emStrong(e,i,l)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.codespan(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.br(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.del(e)){e=e.substring(o.raw.length),t.push(o);continue}if(o=this.tokenizer.autolink(e)){e=e.substring(o.raw.length),t.push(o);continue}if(!this.state.inLink&&(o=this.tokenizer.url(e))){e=e.substring(o.raw.length),t.push(o);continue}let h=e;if(this.options.extensions?.startInline){let c=1/0,p=e.slice(1),u;this.options.extensions.startInline.forEach(f=>{u=f.call({lexer:this},p),typeof u=="number"&&u>=0&&(c=Math.min(c,u))}),c<1/0&&c>=0&&(h=e.substring(0,c+1))}if(o=this.tokenizer.inlineText(h)){e=e.substring(o.raw.length),o.raw.slice(-1)!=="_"&&(l=o.raw.slice(-1)),n=!0;let c=t.at(-1);c?.type==="text"?(c.raw+=o.raw,c.text+=o.text):t.push(o);continue}if(e){let c="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(c);break}else throw new Error(c)}}return t}},_e=class{options;parser;constructor(s){this.options=s||Y}space(s){return""}code({text:s,lang:e,escaped:t}){let i=(e||"").match(A.notSpaceStart)?.[0],r=s.replace(A.endingNewline,"")+`
`;return i?'<pre><code class="language-'+M(i)+'">'+(t?r:M(r,!0))+`</code></pre>
`:"<pre><code>"+(t?r:M(r,!0))+`</code></pre>
`}blockquote({tokens:s}){return`<blockquote>
${this.parser.parse(s)}</blockquote>
`}html({text:s}){return s}def(s){return""}heading({tokens:s,depth:e}){return`<h${e}>${this.parser.parseInline(s)}</h${e}>
`}hr(s){return`<hr>
`}list(s){let e=s.ordered,t=s.start,i="";for(let n=0;n<s.items.length;n++){let l=s.items[n];i+=this.listitem(l)}let r=e?"ol":"ul",a=e&&t!==1?' start="'+t+'"':"";return"<"+r+a+`>
`+i+"</"+r+`>
`}listitem(s){let e="";if(s.task){let t=this.checkbox({checked:!!s.checked});s.loose?s.tokens[0]?.type==="paragraph"?(s.tokens[0].text=t+" "+s.tokens[0].text,s.tokens[0].tokens&&s.tokens[0].tokens.length>0&&s.tokens[0].tokens[0].type==="text"&&(s.tokens[0].tokens[0].text=t+" "+M(s.tokens[0].tokens[0].text),s.tokens[0].tokens[0].escaped=!0)):s.tokens.unshift({type:"text",raw:t+" ",text:t+" ",escaped:!0}):e+=t+" "}return e+=this.parser.parse(s.tokens,!!s.loose),`<li>${e}</li>
`}checkbox({checked:s}){return"<input "+(s?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:s}){return`<p>${this.parser.parseInline(s)}</p>
`}table(s){let e="",t="";for(let r=0;r<s.header.length;r++)t+=this.tablecell(s.header[r]);e+=this.tablerow({text:t});let i="";for(let r=0;r<s.rows.length;r++){let a=s.rows[r];t="";for(let n=0;n<a.length;n++)t+=this.tablecell(a[n]);i+=this.tablerow({text:t})}return i&&(i=`<tbody>${i}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+i+`</table>
`}tablerow({text:s}){return`<tr>
${s}</tr>
`}tablecell(s){let e=this.parser.parseInline(s.tokens),t=s.header?"th":"td";return(s.align?`<${t} align="${s.align}">`:`<${t}>`)+e+`</${t}>
`}strong({tokens:s}){return`<strong>${this.parser.parseInline(s)}</strong>`}em({tokens:s}){return`<em>${this.parser.parseInline(s)}</em>`}codespan({text:s}){return`<code>${M(s,!0)}</code>`}br(s){return"<br>"}del({tokens:s}){return`<del>${this.parser.parseInline(s)}</del>`}link({href:s,title:e,tokens:t}){let i=this.parser.parseInline(t),r=Et(s);if(r===null)return i;s=r;let a='<a href="'+s+'"';return e&&(a+=' title="'+M(e)+'"'),a+=">"+i+"</a>",a}image({href:s,title:e,text:t,tokens:i}){i&&(t=this.parser.parseInline(i,this.parser.textRenderer));let r=Et(s);if(r===null)return M(t);s=r;let a=`<img src="${s}" alt="${t}"`;return e&&(a+=` title="${M(e)}"`),a+=">",a}text(s){return"tokens"in s&&s.tokens?this.parser.parseInline(s.tokens):"escaped"in s&&s.escaped?s.text:M(s.text)}},dt=class{strong({text:s}){return s}em({text:s}){return s}codespan({text:s}){return s}del({text:s}){return s}html({text:s}){return s}text({text:s}){return s}link({text:s}){return""+s}image({text:s}){return""+s}br(){return""}},E=class Ze{options;renderer;textRenderer;constructor(e){this.options=e||Y,this.options.renderer=this.options.renderer||new _e,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new dt}static parse(e,t){return new Ze(t).parse(e)}static parseInline(e,t){return new Ze(t).parseInline(e)}parse(e,t=!0){let i="";for(let r=0;r<e.length;r++){let a=e[r];if(this.options.extensions?.renderers?.[a.type]){let l=a,o=this.options.extensions.renderers[l.type].call({parser:this},l);if(o!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(l.type)){i+=o||"";continue}}let n=a;switch(n.type){case"space":{i+=this.renderer.space(n);continue}case"hr":{i+=this.renderer.hr(n);continue}case"heading":{i+=this.renderer.heading(n);continue}case"code":{i+=this.renderer.code(n);continue}case"table":{i+=this.renderer.table(n);continue}case"blockquote":{i+=this.renderer.blockquote(n);continue}case"list":{i+=this.renderer.list(n);continue}case"html":{i+=this.renderer.html(n);continue}case"def":{i+=this.renderer.def(n);continue}case"paragraph":{i+=this.renderer.paragraph(n);continue}case"text":{let l=n,o=this.renderer.text(l);for(;r+1<e.length&&e[r+1].type==="text";)l=e[++r],o+=`
`+this.renderer.text(l);t?i+=this.renderer.paragraph({type:"paragraph",raw:o,text:o,tokens:[{type:"text",raw:o,text:o,escaped:!0}]}):i+=o;continue}default:{let l='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return i}parseInline(e,t=this.renderer){let i="";for(let r=0;r<e.length;r++){let a=e[r];if(this.options.extensions?.renderers?.[a.type]){let l=this.options.extensions.renderers[a.type].call({parser:this},a);if(l!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(a.type)){i+=l||"";continue}}let n=a;switch(n.type){case"escape":{i+=t.text(n);break}case"html":{i+=t.html(n);break}case"link":{i+=t.link(n);break}case"image":{i+=t.image(n);break}case"strong":{i+=t.strong(n);break}case"em":{i+=t.em(n);break}case"codespan":{i+=t.codespan(n);break}case"br":{i+=t.br(n);break}case"del":{i+=t.del(n);break}case"text":{i+=t.text(n);break}default:{let l='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(l),"";throw new Error(l)}}}return i}},de=class{options;block;constructor(s){this.options=s||Y}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(s){return s}postprocess(s){return s}processAllTokens(s){return s}emStrongMask(s){return s}provideLexer(){return this.block?C.lex:C.lexInline}provideParser(){return this.block?E.parse:E.parseInline}},Ns=class{defaults=it();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=E;Renderer=_e;TextRenderer=dt;Lexer=C;Tokenizer=Ae;Hooks=de;constructor(...s){this.use(...s)}walkTokens(s,e){let t=[];for(let i of s)switch(t=t.concat(e.call(this,i)),i.type){case"table":{let r=i;for(let a of r.header)t=t.concat(this.walkTokens(a.tokens,e));for(let a of r.rows)for(let n of a)t=t.concat(this.walkTokens(n.tokens,e));break}case"list":{let r=i;t=t.concat(this.walkTokens(r.items,e));break}default:{let r=i;this.defaults.extensions?.childTokens?.[r.type]?this.defaults.extensions.childTokens[r.type].forEach(a=>{let n=r[a].flat(1/0);t=t.concat(this.walkTokens(n,e))}):r.tokens&&(t=t.concat(this.walkTokens(r.tokens,e)))}}return t}use(...s){let e=this.defaults.extensions||{renderers:{},childTokens:{}};return s.forEach(t=>{let i={...t};if(i.async=this.defaults.async||i.async||!1,t.extensions&&(t.extensions.forEach(r=>{if(!r.name)throw new Error("extension name required");if("renderer"in r){let a=e.renderers[r.name];a?e.renderers[r.name]=function(...n){let l=r.renderer.apply(this,n);return l===!1&&(l=a.apply(this,n)),l}:e.renderers[r.name]=r.renderer}if("tokenizer"in r){if(!r.level||r.level!=="block"&&r.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let a=e[r.level];a?a.unshift(r.tokenizer):e[r.level]=[r.tokenizer],r.start&&(r.level==="block"?e.startBlock?e.startBlock.push(r.start):e.startBlock=[r.start]:r.level==="inline"&&(e.startInline?e.startInline.push(r.start):e.startInline=[r.start]))}"childTokens"in r&&r.childTokens&&(e.childTokens[r.name]=r.childTokens)}),i.extensions=e),t.renderer){let r=this.defaults.renderer||new _e(this.defaults);for(let a in t.renderer){if(!(a in r))throw new Error(`renderer '${a}' does not exist`);if(["options","parser"].includes(a))continue;let n=a,l=t.renderer[n],o=r[n];r[n]=(...h)=>{let c=l.apply(r,h);return c===!1&&(c=o.apply(r,h)),c||""}}i.renderer=r}if(t.tokenizer){let r=this.defaults.tokenizer||new Ae(this.defaults);for(let a in t.tokenizer){if(!(a in r))throw new Error(`tokenizer '${a}' does not exist`);if(["options","rules","lexer"].includes(a))continue;let n=a,l=t.tokenizer[n],o=r[n];r[n]=(...h)=>{let c=l.apply(r,h);return c===!1&&(c=o.apply(r,h)),c}}i.tokenizer=r}if(t.hooks){let r=this.defaults.hooks||new de;for(let a in t.hooks){if(!(a in r))throw new Error(`hook '${a}' does not exist`);if(["options","block"].includes(a))continue;let n=a,l=t.hooks[n],o=r[n];de.passThroughHooks.has(a)?r[n]=h=>{if(this.defaults.async&&de.passThroughHooksRespectAsync.has(a))return(async()=>{let p=await l.call(r,h);return o.call(r,p)})();let c=l.call(r,h);return o.call(r,c)}:r[n]=(...h)=>{if(this.defaults.async)return(async()=>{let p=await l.apply(r,h);return p===!1&&(p=await o.apply(r,h)),p})();let c=l.apply(r,h);return c===!1&&(c=o.apply(r,h)),c}}i.hooks=r}if(t.walkTokens){let r=this.defaults.walkTokens,a=t.walkTokens;i.walkTokens=function(n){let l=[];return l.push(a.call(this,n)),r&&(l=l.concat(r.call(this,n))),l}}this.defaults={...this.defaults,...i}}),this}setOptions(s){return this.defaults={...this.defaults,...s},this}lexer(s,e){return C.lex(s,e??this.defaults)}parser(s,e){return E.parse(s,e??this.defaults)}parseMarkdown(s){return(e,t)=>{let i={...t},r={...this.defaults,...i},a=this.onError(!!r.silent,!!r.async);if(this.defaults.async===!0&&i.async===!1)return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof e>"u"||e===null)return a(new Error("marked(): input parameter is undefined or null"));if(typeof e!="string")return a(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(e)+", string expected"));if(r.hooks&&(r.hooks.options=r,r.hooks.block=s),r.async)return(async()=>{let n=r.hooks?await r.hooks.preprocess(e):e,l=await(r.hooks?await r.hooks.provideLexer():s?C.lex:C.lexInline)(n,r),o=r.hooks?await r.hooks.processAllTokens(l):l;r.walkTokens&&await Promise.all(this.walkTokens(o,r.walkTokens));let h=await(r.hooks?await r.hooks.provideParser():s?E.parse:E.parseInline)(o,r);return r.hooks?await r.hooks.postprocess(h):h})().catch(a);try{r.hooks&&(e=r.hooks.preprocess(e));let n=(r.hooks?r.hooks.provideLexer():s?C.lex:C.lexInline)(e,r);r.hooks&&(n=r.hooks.processAllTokens(n)),r.walkTokens&&this.walkTokens(n,r.walkTokens);let l=(r.hooks?r.hooks.provideParser():s?E.parse:E.parseInline)(n,r);return r.hooks&&(l=r.hooks.postprocess(l)),l}catch(n){return a(n)}}}onError(s,e){return t=>{if(t.message+=`
Please report this to https://github.com/markedjs/marked.`,s){let i="<p>An error occurred:</p><pre>"+M(t.message+"",!0)+"</pre>";return e?Promise.resolve(i):i}if(e)return Promise.reject(t);throw t}}},X=new Ns;function x(s,e){return X.parse(s,e)}x.options=x.setOptions=function(s){return X.setOptions(s),x.defaults=X.defaults,Gt(x.defaults),x};x.getDefaults=it;x.defaults=Y;x.use=function(...s){return X.use(...s),x.defaults=X.defaults,Gt(x.defaults),x};x.walkTokens=function(s,e){return X.walkTokens(s,e)};x.parseInline=X.parseInline;x.Parser=E;x.parser=E.parse;x.Renderer=_e;x.TextRenderer=dt;x.Lexer=C;x.lexer=C.lex;x.Tokenizer=Ae;x.Hooks=de;x.parse=x;x.options;x.setOptions;x.use;x.walkTokens;x.parseInline;E.parse;C.lex;var Is=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,ie=(s,e,t,i)=>{for(var r=i>1?void 0:i?Bs(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Is(e,t,r),r};let q=class extends _{constructor(){super(...arguments),this.name="",this.plugin=null,this.loading=!1,this.error=null,this.activeReadmeTab="root"}connectedCallback(){super.connectedCallback(),this.name&&this.loadPlugin()}willUpdate(s){s.has("name")&&this.name&&this.loadPlugin()}async loadPlugin(){if(this.name){this.loading=!0,this.error=null,this.activeReadmeTab="root";try{this.plugin=await T.getPlugin(this.name)}catch(s){console.error("Failed to load plugin:",s),this.error=s instanceof Error?s.message:"Failed to load plugin details",this.plugin=null}finally{this.loading=!1}}}async handleDownload(s,e){try{const t=await T.downloadPlugin(s,e),i=URL.createObjectURL(t),r=document.createElement("a");r.href=i,r.download=`${s}-${e}.pivotpkg`,r.click(),URL.revokeObjectURL(i)}catch(t){console.error("Failed to download plugin:",t),alert("Failed to download plugin")}}renderVersionsTable(){const s=this.plugin?.versions;return!s||s.length===0?d`<p>No versions available.</p>`:d`
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
					${s.map(e=>d`
						<tr>
							<td><strong>${e.version}</strong></td>
							<td>${Wt(e.fileSize)}</td>
							<td>${e.downloadCount}</td>
							<td>${Zt(e.uploadedAt)}</td>
							<td>
							${w(e.dependencies.length>0,()=>d`
								${e.dependencies.map(t=>d`
									<span class="dependency-tag">
										${t.dependencyName} ${t.versionRange}
									</span>
								`)}
							`,()=>d`
								<span class="no-deps">None</span>
							`)}
							</td>
							<td>
								<button
									class="btn-small btn-primary"
									@click=${()=>this.handleDownload(this.plugin.name,e.version)}
								>
									Download
								</button>
							</td>
						</tr>
					`)}
				</tbody>
			</table>
		`}renderTags(){const s=this.plugin?.tags;if(!(!s||s.length===0))return d`
			<div class="tags">
				${s.map(e=>d`<span class="tag">${e}</span>`)}
			</div>
		`}get readmeTabs(){const s=[];return this.plugin?.readme&&s.push({key:"root",label:"README",content:this.plugin.readme}),this.plugin?.serverReadme&&s.push({key:"server",label:"Server",content:this.plugin.serverReadme}),this.plugin?.clientReadme&&s.push({key:"client",label:"Client",content:this.plugin.clientReadme}),s}renderReadme(){const s=this.readmeTabs;if(s.length===0)return;const e=s.find(t=>t.key===this.activeReadmeTab)??s[0];return d`
			<div class="readme-section">
				${w(s.length>1,()=>d`
					<div class="readme-tabs">
						${s.map(t=>d`
							<button
								class="readme-tab ${t.key===e.key?"active":""}"
								@click=${()=>{this.activeReadmeTab=t.key}}
							>
								${t.label}
							</button>
						`)}
					</div>
				`,()=>d`
					<h3>README</h3>
				`)}
				<div class="readme">${ts(x.parse(e.content))}</div>
			</div>
		`}render(){return this.loading?d`<div class="loading">Loading plugin details...</div>`:this.error?d`<div class="alert alert-error">${this.error}</div>`:this.plugin?d`
			<div class="plugin-header">
				<div class="plugin-title-row">
					<h2>${this.plugin.name}</h2>
					${w(this.plugin.latestVersion,()=>d`
						<span class="version-badge">v${this.plugin.latestVersion}</span>
					`)}
				</div>
				${w(this.plugin.author,()=>d`
					<p class="author">by ${this.plugin.author}</p>
				`)}
				${w(this.plugin.description,()=>d`
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
		`:d`<div class="empty-state">No plugin selected.</div>`}};q.styles=D`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
			margin: 0 auto;
		}

		h2 {
			margin: 0;
			color: #333;
		}

		h3 {
			color: #333;
			margin: 24px 0 12px;
		}

		.plugin-header {
			background: white;
			padding: 24px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.plugin-title-row {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.version-badge {
			background: #667eea;
			color: white;
			padding: 4px 10px;
			border-radius: 12px;
			font-size: 13px;
			font-weight: 500;
		}

		.author {
			margin: 4px 0 0;
			color: #666;
			font-size: 14px;
		}

		.description {
			margin: 12px 0 0;
			color: #444;
			line-height: 1.5;
		}

		.tags {
			display: flex;
			gap: 6px;
			flex-wrap: wrap;
			margin-top: 12px;
		}

		.tag {
			background: #e8ebf7;
			color: #667eea;
			padding: 4px 10px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 500;
		}

		.meta-row {
			display: flex;
			gap: 20px;
			margin-top: 16px;
			padding-top: 16px;
			border-top: 1px solid #eee;
		}

		.meta-item {
			font-size: 13px;
			color: #666;
		}

		.versions-table {
			width: 100%;
			border-collapse: collapse;
			background: white;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			border-radius: 8px;
			overflow: hidden;
		}

		.versions-table thead {
			background: #f8f9fa;
		}

		.versions-table th {
			padding: 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.versions-table td {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.versions-table tbody tr:hover {
			background: #f8f9fa;
		}

		.dependency-tag {
			display: inline-block;
			background: #f0f0f0;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 12px;
			margin: 2px 4px 2px 0;
		}

		.no-deps {
			color: #999;
			font-size: 13px;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #999;
		}

		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-error {
			background: #f8d7da;
			color: #721c24;
			border: 1px solid #f5c6cb;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.btn-primary {
			background: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.readme-section {
			margin-top: 24px;
		}

		.readme-tabs {
			display: flex;
			gap: 0;
			border-bottom: 2px solid #e0e0e0;
			margin-bottom: 0;
		}

		.readme-tab {
			padding: 10px 20px;
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			margin-bottom: -2px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			color: #666;
			transition: all 0.2s;
		}

		.readme-tab:hover {
			color: #333;
			background: #f8f9fa;
		}

		.readme-tab.active {
			color: #667eea;
			border-bottom-color: #667eea;
		}

		.readme-tabs + .readme {
			border-radius: 0 0 8px 8px;
		}

		.readme {
			background: white;
			padding: 24px 32px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			line-height: 1.6;
			color: #333;
			word-wrap: break-word;
			overflow-wrap: break-word;
		}

		.readme h1,
		.readme h2,
		.readme h3,
		.readme h4 {
			margin: 1.5em 0 0.5em;
			color: #222;
		}

		.readme h1:first-child,
		.readme h2:first-child {
			margin-top: 0;
		}

		.readme p {
			margin: 0.75em 0;
		}

		.readme code {
			background: #f4f4f4;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 0.9em;
			font-family: 'Cascadia Code', 'Fira Code', monospace;
		}

		.readme pre {
			background: #1e1e2e;
			color: #cdd6f4;
			padding: 16px;
			border-radius: 6px;
			overflow-x: auto;
			font-size: 13px;
			line-height: 1.5;
		}

		.readme pre code {
			background: none;
			padding: 0;
			color: inherit;
		}

		.readme ul,
		.readme ol {
			padding-left: 1.5em;
		}

		.readme li {
			margin: 0.25em 0;
		}

		.readme blockquote {
			border-left: 3px solid #667eea;
			margin: 1em 0;
			padding: 0.5em 1em;
			color: #555;
			background: #f8f9fa;
			border-radius: 0 4px 4px 0;
		}

		.readme a {
			color: #667eea;
			text-decoration: none;
		}

		.readme a:hover {
			text-decoration: underline;
		}

		.readme table {
			width: 100%;
			border-collapse: collapse;
			margin: 1em 0;
		}

		.readme th,
		.readme td {
			border: 1px solid #ddd;
			padding: 8px 12px;
			text-align: left;
		}

		.readme th {
			background: #f8f9fa;
			font-weight: 600;
		}

		.readme hr {
			border: none;
			border-top: 1px solid #eee;
			margin: 1.5em 0;
		}

		.readme img {
			max-width: 100%;
			height: auto;
			border-radius: 4px;
		}
	`;ie([R({type:String})],q.prototype,"name",2);ie([g()],q.prototype,"plugin",2);ie([g()],q.prototype,"loading",2);ie([g()],q.prototype,"error",2);ie([g()],q.prototype,"activeReadmeTab",2);q=ie([U("plugin-detail")],q);var js=Object.defineProperty,qs=Object.getOwnPropertyDescriptor,we=(s,e,t,i)=>{for(var r=i>1?void 0:i?qs(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&js(e,t,r),r};let Q=class extends _{constructor(){super(...arguments),this.name="",this.plugins=[],this.loading=!1,this.search="",this.previousName=""}connectedCallback(){super.connectedCallback(),this.previousName=this.name,this.initialize()}async updated(s){if(!s.has("name"))return;const e=this.shadowRoot?.querySelector(".detail-pane");!e||s.get("name")===void 0&&!this.previousName||(e.getAnimations().forEach(i=>i.cancel()),e.animate([{opacity:0},{opacity:1}],{duration:200,easing:"ease-out",fill:"forwards"}))}async initialize(){await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const s=await T.getPlugins({search:this.search||void 0,pageSize:100});this.plugins=s.plugins}catch(s){console.error("Failed to load plugins:",s)}finally{this.loading=!1}}handleSearchInput(s){this.search=s.target.value}async handleSearch(s){s?.preventDefault(),await this.loadPlugins()}async selectPlugin(s){await k.navigate(`/explore/${encodeURIComponent(s)}`)}renderPluginList(){return this.loading?d`<div class="loading">Loading...</div>`:this.plugins.length===0?d`<div class="empty-state">No plugins found.</div>`:d`
			<ul class="plugin-list">
				${this.plugins.map(s=>d`
					<li
						class="plugin-list-item ${this.name===s.name?"selected":""}"
						@click=${()=>this.selectPlugin(s.name)}
					>
						<div class="plugin-name">${s.name}</div>
						<div class="plugin-meta">
							${w(s.latestVersion,()=>d`
								<span class="plugin-version">v${s.latestVersion}</span>
							`)}
							${w(s.author,()=>d`
								<span class="plugin-author">${s.author}</span>
							`)}
						</div>
					</li>
				`)}
			</ul>
		`}render(){return d`
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
					${w(this.name,()=>d`
						<plugin-detail .name=${this.name}></plugin-detail>
					`,()=>d`
						<div class="empty-detail">
							<p>Select a plugin from the list to view its details.</p>
						</div>
					`)}
				</div>
			</div>
		`}};Q.styles=D`
		:host {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-rows: auto 1fr;
			padding: 12px 20px;
			max-width: 1400px;
		}

		h1 {
			margin: 0;
			color: #333;
		}

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.header-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.explorer-layout {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 20px;
		}

		.list-pane {
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			overflow: hidden;
			display: flex;
			flex-direction: column;
			margin: 8px;
		}

		.search-bar {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.search-input {
			width: 100%;
			padding: 8px 12px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			box-sizing: border-box;
			transition: border-color 0.3s;
		}

		.search-input:focus {
			outline: none;
			border-color: #667eea;
		}

		.plugin-list {
			list-style: none;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			flex: 1;
		}

		.plugin-list-item {
			padding: 12px 16px;
			border-bottom: 1px solid #f0f0f0;
			cursor: pointer;
			transition: background 0.2s;
		}

		.plugin-list-item:hover {
			background: #f8f9fa;
		}

		.plugin-list-item.selected {
			background: #e8ebf7;
			border-left: 3px solid #667eea;
		}

		.plugin-name {
			font-weight: 600;
			color: #333;
			margin-bottom: 4px;
		}

		.plugin-meta {
			display: flex;
			gap: 12px;
			font-size: 12px;
			color: #888;
		}

		.plugin-version {
			color: #667eea;
			font-weight: 500;
		}

		.detail-pane {
			overflow-y: auto;
			margin: 8px;
		}

		.detail-pane plugin-detail {
			padding: 0;
			max-width: none;
			margin: 0;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-detail {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			color: #999;
		}

		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
			text-decoration: none;
		}

		.btn-primary {
			background: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.btn-secondary {
			background: #6c757d;
			color: white;
		}

		.btn-secondary:hover {
			background: #5a6268;
		}
	`;we([R({type:String})],Q.prototype,"name",2);we([g()],Q.prototype,"plugins",2);we([g()],Q.prototype,"loading",2);we([g()],Q.prototype,"search",2);Q=we([U("plugin-explorer")],Q);var Fs=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,I=(s,e,t,i)=>{for(var r=i>1?void 0:i?Hs(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Fs(e,t,r),r};let z=class extends _{constructor(){super(...arguments),this.activeTab="upload",this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.accessMode="private",this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){const s=await Le.getConfig();this.accessMode=s.accessMode,this.currentUser=await S.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const s=await T.getPlugins();this.plugins=s.plugins}catch(s){console.error("Failed to load plugins:",s)}finally{this.loading=!1}}get isAuthenticated(){return!!this.currentUser}renderUploadTab(){return d`
			<h2>Upload Plugin Package</h2>

			${w(this.uploadStatus,()=>d`
				<div class="alert alert-success">${this.uploadStatus}</div>
			`)}
			${w(this.uploadError,()=>d`
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

				${w(this.uploadProgress,()=>d`
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
		`}handleFileSelect(s){const e=s.target;this.selectedFile=e.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const s=await T.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${s.plugin} v${s.version}`,this.selectedFile=null;const e=this.shadowRoot?.querySelector("#plugin-file");e&&(e.value=""),await this.loadPlugins()}catch(s){this.uploadError=s instanceof Error?s.message:"Upload failed"}finally{this.uploadProgress=!1}}renderStorageTab(){const s=this.plugins.length,e=this.plugins.reduce((i,r)=>i+(r.versionCount??0),0),t=this.plugins.reduce((i,r)=>i+(r.totalDownloads??0),0);return d`
			<h2>Storage Information</h2>
			<div class="stats-grid">
				<div class="stat-card">
					<h3>Total Plugins</h3>
					<p class="stat-value">${s}</p>
				</div>
				<div class="stat-card">
					<h3>Total Versions</h3>
					<p class="stat-value">${e}</p>
				</div>
				<div class="stat-card">
					<h3>Total Downloads</h3>
					<p class="stat-value">${t}</p>
				</div>
			</div>
		`}render(){return d`
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
				${w(this.isAuthenticated,()=>d`
					<router-link to="/admin" class="nav-card">
						<h3>Plugin Admin</h3>
						<p>Manage your plugins, upload new versions, and view statistics.</p>
					</router-link>
				`)}
			</nav>

			${w(this.isAuthenticated,()=>d`
				<div class="tabs">
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
					${w(this.activeTab==="upload",()=>this.renderUploadTab(),()=>this.renderStorageTab())}
				</div>
			`)}
		`}};z.styles=D`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
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

		.nav-cards {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 16px;
			margin-bottom: 32px;
		}

		.nav-card {
			display: block;
			background: white;
			padding: 24px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			text-decoration: none;
			color: inherit;
			transition: box-shadow 0.3s, transform 0.2s;
			cursor: pointer;
		}

		.nav-card:hover {
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
			transform: translateY(-2px);
		}

		.nav-card h3 {
			margin: 0 0 8px;
			color: #667eea;
		}

		.nav-card p {
			margin: 0;
			color: #666;
			font-size: 14px;
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
	`;I([g()],z.prototype,"activeTab",2);I([g()],z.prototype,"plugins",2);I([g()],z.prototype,"loading",2);I([g()],z.prototype,"currentUser",2);I([g()],z.prototype,"uploadStatus",2);I([g()],z.prototype,"uploadError",2);I([g()],z.prototype,"uploadProgress",2);I([g()],z.prototype,"accessMode",2);z=I([U("registry-manager")],z);const pe={enter:s=>new Promise(e=>{const t=s.animate([{transform:"translateX(-30px)",opacity:0},{transform:"translateX(0)",opacity:1}],{duration:200,easing:"ease-out",fill:"forwards"});t.onfinish=()=>e()}),exit:s=>new Promise(e=>{const t=s.animate([{transform:"translateX(0)",opacity:1},{transform:"translateX(30px)",opacity:0}],{duration:150,easing:"ease-in"});t.onfinish=()=>e()})},Vs=async()=>await Le.isPublic()||await S.isAuthenticated()?!0:(await k.navigate("/login"),!1),Ws=async()=>await S.isAuthenticated()?!0:(await k.navigate("/login"),!1),Zs=[{path:"/login",name:"login",template:()=>d`<login-page></login-page>`,beforeEnter:async()=>await S.isAuthenticated()?(await k.navigate("/"),!1):!0},{path:"/",name:"layout",template:()=>d`<app-layout></app-layout>`,beforeEnter:Vs,children:[{path:"",name:"dashboard",template:()=>d`<registry-manager></registry-manager>`,animation:pe},{path:"browse",name:"browse",template:()=>d`<plugin-browse></plugin-browse>`,animation:pe},{path:"plugin/:name",name:"plugin-detail",template:s=>d`<plugin-detail .name=${s.name}></plugin-detail>`,animation:pe},{path:"explore/:name?",name:"explore",template:s=>d`<plugin-explorer .name=${s.name??""}></plugin-explorer>`,animation:pe},{path:"admin",name:"admin",template:()=>d`<plugin-admin></plugin-admin>`,beforeEnter:Ws,animation:pe},{path:"(.*)",name:"fallback",redirect:"/"}]}];var Gs=Object.defineProperty,Ks=Object.getOwnPropertyDescriptor,nr=(s,e,t,i)=>{for(var r=i>1?void 0:i?Ks(e,t):e,a=s.length-1,n;a>=0;a--)(n=s[a])&&(r=(i?n(e,t,r):n(r))||r);return i&&r&&Gs(e,t,r),r};let Re=class extends _{constructor(){super(...arguments),this.isInitialized=!1}connectedCallback(){super.connectedCallback(),k.setRoutes(Zs),S.onAuthenticationStateChanged(()=>this.handleAuthChange()),this.initialize()}async initialize(){await Le.getConfig(),this.isInitialized=!0,await k.navigate(window.location.pathname)}disconnectedCallback(){super.disconnectedCallback(),k.dispose()}async handleAuthChange(){await k.navigate(window.location.pathname)}render(){return this.isInitialized?d`<router-outlet></router-outlet>`:d`<div class="loading-screen">Loading...</div>`}};Re.styles=D`
		:host {
			display: grid;
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
	`;nr([g()],Re.prototype,"isInitialized",2);Re=nr([U("app-root")],Re);
