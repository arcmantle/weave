(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const n of o.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&r(n)}).observe(document,{childList:!0,subtree:!0});function e(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(s){if(s.ep)return;s.ep=!0;const o=e(s);fetch(s.href,o)}})();let Lt=class extends Event{constructor(t,e,r,s){super("context-request",{bubbles:!0,composed:!0}),this.context=t,this.contextTarget=e,this.callback=r,this.subscribe=s??!1}};let mt=class{constructor(t,e,r,s){if(this.subscribe=!1,this.provided=!1,this.value=void 0,this.t=(o,n)=>{this.unsubscribe&&(this.unsubscribe!==n&&(this.provided=!1,this.unsubscribe()),this.subscribe||this.unsubscribe()),this.value=o,this.host.requestUpdate(),this.provided&&!this.subscribe||(this.provided=!0,this.callback&&this.callback(o,n)),this.unsubscribe=n},this.host=t,e.context!==void 0){const o=e;this.context=o.context,this.callback=o.callback,this.subscribe=o.subscribe??!1}else this.context=e,this.callback=r,this.subscribe=s??!1;this.host.addController(this)}hostConnected(){this.dispatchRequest()}hostDisconnected(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=void 0)}dispatchRequest(){this.host.dispatchEvent(new Lt(this.context,this.host,this.t,this.subscribe))}};let qt=class{get value(){return this.o}set value(t){this.setValue(t)}setValue(t,e=!1){const r=e||!Object.is(t,this.o);this.o=t,r&&this.updateObservers()}constructor(t){this.subscriptions=new Map,this.updateObservers=()=>{for(const[e,{disposer:r}]of this.subscriptions)e(this.o,r)},t!==void 0&&(this.value=t)}addCallback(t,e,r){if(!r)return void t(this.value);this.subscriptions.has(t)||this.subscriptions.set(t,{disposer:()=>{this.subscriptions.delete(t)},consumerHost:e});const{disposer:s}=this.subscriptions.get(t);t(this.value,s)}clearCallbacks(){this.subscriptions.clear()}};let Wt=class extends Event{constructor(t,e){super("context-provider",{bubbles:!0,composed:!0}),this.context=t,this.contextTarget=e}},bt=class extends qt{constructor(t,e,r){super(e.context!==void 0?e.initialValue:r),this.onContextRequest=s=>{if(s.context!==this.context)return;const o=s.contextTarget??s.composedPath()[0];o!==this.host&&(s.stopPropagation(),this.addCallback(s.callback,o,s.subscribe))},this.onProviderRequest=s=>{if(s.context!==this.context||(s.contextTarget??s.composedPath()[0])===this.host)return;const o=new Set;for(const[n,{consumerHost:a}]of this.subscriptions)o.has(n)||(o.add(n),a.dispatchEvent(new Lt(this.context,a,n,!0)));s.stopPropagation()},this.host=t,e.context!==void 0?this.context=e.context:this.context=e,this.attachListeners(),this.host.addController?.(this)}attachListeners(){this.host.addEventListener("context-request",this.onContextRequest),this.host.addEventListener("context-provider",this.onProviderRequest)}hostConnected(){this.host.dispatchEvent(new Wt(this.context,this.host))}};function Tt({context:i}){return(t,e)=>{const r=new WeakMap;if(typeof e=="object")return{get(){return t.get.call(this)},set(s){return r.get(this).setValue(s),t.set.call(this,s)},init(s){return r.set(this,new bt(this,{context:i,initialValue:s})),s}};{t.constructor.addInitializer((n=>{r.set(n,new bt(n,{context:i}))}));const s=Object.getOwnPropertyDescriptor(t,e);let o;if(s===void 0){const n=new WeakMap;o={get(){return n.get(this)},set(a){r.get(this).setValue(a),n.set(this,a)},configurable:!0,enumerable:!0}}else{const n=s.set;o={...s,set(a){r.get(this).setValue(a),n?.call(this,a)}}}return void Object.defineProperty(t,e,o)}}}function at({context:i,subscribe:t}){return(e,r)=>{typeof r=="object"?r.addInitializer((function(){new mt(this,{context:i,callback:s=>{e.set.call(this,s)},subscribe:t})})):e.constructor.addInitializer((s=>{new mt(s,{context:i,callback:o=>{s[r]=o},subscribe:t})}))}}const G=globalThis,lt=G.ShadowRoot&&(G.ShadyCSS===void 0||G.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ct=Symbol(),vt=new WeakMap;let Ut=class{constructor(t,e,r){if(this._$cssResult$=!0,r!==ct)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(lt&&t===void 0){const r=e!==void 0&&e.length===1;r&&(t=vt.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),r&&vt.set(e,t))}return t}toString(){return this.cssText}};const Ft=i=>new Ut(typeof i=="string"?i:i+"",void 0,ct),W=(i,...t)=>{const e=i.length===1?i[0]:t.reduce((r,s,o)=>r+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+i[o+1],i[0]);return new Ut(e,i,ct)},Kt=(i,t)=>{if(lt)i.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const r=document.createElement("style"),s=G.litNonce;s!==void 0&&r.setAttribute("nonce",s),r.textContent=e.cssText,i.appendChild(r)}},yt=lt?i=>i:i=>i instanceof CSSStyleSheet?(t=>{let e="";for(const r of t.cssRules)e+=r.cssText;return Ft(e)})(i):i;const{is:Gt,defineProperty:Xt,getOwnPropertyDescriptor:Jt,getOwnPropertyNames:Zt,getOwnPropertySymbols:Yt,getPrototypeOf:Qt}=Object,Q=globalThis,wt=Q.trustedTypes,te=wt?wt.emptyScript:"",ee=Q.reactiveElementPolyfillSupport,j=(i,t)=>i,X={toAttribute(i,t){switch(t){case Boolean:i=i?te:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,t){let e=i;switch(t){case Boolean:e=i!==null;break;case Number:e=i===null?null:Number(i);break;case Object:case Array:try{e=JSON.parse(i)}catch{e=null}}return e}},ht=(i,t)=>!Gt(i,t),$t={attribute:!0,type:String,converter:X,reflect:!1,useDefault:!1,hasChanged:ht};Symbol.metadata??=Symbol("metadata"),Q.litPropertyMetadata??=new WeakMap;let k=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$t){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const r=Symbol(),s=this.getPropertyDescriptor(t,r,e);s!==void 0&&Xt(this.prototype,t,s)}}static getPropertyDescriptor(t,e,r){const{get:s,set:o}=Jt(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:s,set(n){const a=s?.call(this);o?.call(this,n),this.requestUpdate(t,a,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$t}static _$Ei(){if(this.hasOwnProperty(j("elementProperties")))return;const t=Qt(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(j("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(j("properties"))){const e=this.properties,r=[...Zt(e),...Yt(e)];for(const s of r)this.createProperty(s,e[s])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[r,s]of e)this.elementProperties.set(r,s)}this._$Eh=new Map;for(const[e,r]of this.elementProperties){const s=this._$Eu(e,r);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const r=new Set(t.flat(1/0).reverse());for(const s of r)e.unshift(yt(s))}else t!==void 0&&e.push(yt(t));return e}static _$Eu(t,e){const r=e.attribute;return r===!1?void 0:typeof r=="string"?r:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const r of e.keys())this.hasOwnProperty(r)&&(t.set(r,this[r]),delete this[r]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Kt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,r){this._$AK(t,r)}_$ET(t,e){const r=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,r);if(s!==void 0&&r.reflect===!0){const o=(r.converter?.toAttribute!==void 0?r.converter:X).toAttribute(e,r.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const r=this.constructor,s=r._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const o=r.getPropertyOptions(s),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:X;this._$Em=s;const a=n.fromAttribute(e,o.type);this[s]=a??this._$Ej?.get(s)??a,this._$Em=null}}requestUpdate(t,e,r,s=!1,o){if(t!==void 0){const n=this.constructor;if(s===!1&&(o=this[t]),r??=n.getPropertyOptions(t),!((r.hasChanged??ht)(o,e)||r.useDefault&&r.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,r))))return;this.C(t,e,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:r,reflect:s,wrapped:o},n){r&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),o!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||r||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[s,o]of this._$Ep)this[s]=o;this._$Ep=void 0}const r=this.constructor.elementProperties;if(r.size>0)for(const[s,o]of r){const{wrapped:n}=o,a=this[s];n!==!0||this._$AL.has(s)||a===void 0||this.C(s,void 0,o,a)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(e)):this._$EM()}catch(r){throw t=!1,this._$EM(),r}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};k.elementStyles=[],k.shadowRootOptions={mode:"open"},k[j("elementProperties")]=new Map,k[j("finalized")]=new Map,ee?.({ReactiveElement:k}),(Q.reactiveElementVersions??=[]).push("2.1.2");const ut=globalThis,xt=i=>i,J=ut.trustedTypes,At=J?J.createPolicy("lit-html",{createHTML:i=>i}):void 0,kt="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,Mt="?"+C,se=`<${Mt}>`,U=document,H=()=>U.createComment(""),V=i=>i===null||typeof i!="object"&&typeof i!="function",dt=Array.isArray,re=i=>dt(i)||typeof i?.[Symbol.iterator]=="function",it=`[ 	
\f\r]`,B=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Pt=/-->/g,_t=/>/g,L=RegExp(`>|${it}(?:([^\\s"'>=/]+)(${it}*=${it}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),St=/'/g,Ct=/"/g,Ot=/^(?:script|style|textarea|title)$/i,ie=i=>(t,...e)=>({_$litType$:i,strings:t,values:e}),d=ie(1),M=Symbol.for("lit-noChange"),f=Symbol.for("lit-nothing"),Et=new WeakMap,T=U.createTreeWalker(U,129);function Nt(i,t){if(!dt(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return At!==void 0?At.createHTML(t):t}const oe=(i,t)=>{const e=i.length-1,r=[];let s,o=t===2?"<svg>":t===3?"<math>":"",n=B;for(let a=0;a<e;a++){const l=i[a];let u,h,c=-1,p=0;for(;p<l.length&&(n.lastIndex=p,h=n.exec(l),h!==null);)p=n.lastIndex,n===B?h[1]==="!--"?n=Pt:h[1]!==void 0?n=_t:h[2]!==void 0?(Ot.test(h[2])&&(s=RegExp("</"+h[2],"g")),n=L):h[3]!==void 0&&(n=L):n===L?h[0]===">"?(n=s??B,c=-1):h[1]===void 0?c=-2:(c=n.lastIndex-h[2].length,u=h[1],n=h[3]===void 0?L:h[3]==='"'?Ct:St):n===Ct||n===St?n=L:n===Pt||n===_t?n=B:(n=L,s=void 0);const $=n===L&&i[a+1].startsWith("/>")?" ":"";o+=n===B?l+se:c>=0?(r.push(u),l.slice(0,c)+kt+l.slice(c)+C+$):l+C+(c===-2?a:$)}return[Nt(i,o+(i[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),r]};class q{constructor({strings:t,_$litType$:e},r){let s;this.parts=[];let o=0,n=0;const a=t.length-1,l=this.parts,[u,h]=oe(t,e);if(this.el=q.createElement(u,r),T.currentNode=this.el.content,e===2||e===3){const c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(s=T.nextNode())!==null&&l.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(const c of s.getAttributeNames())if(c.endsWith(kt)){const p=h[n++],$=s.getAttribute(c).split(C),S=/([.?@])?(.*)/.exec(p);l.push({type:1,index:o,name:S[2],strings:$,ctor:S[1]==="."?ae:S[1]==="?"?le:S[1]==="@"?ce:tt}),s.removeAttribute(c)}else c.startsWith(C)&&(l.push({type:6,index:o}),s.removeAttribute(c));if(Ot.test(s.tagName)){const c=s.textContent.split(C),p=c.length-1;if(p>0){s.textContent=J?J.emptyScript:"";for(let $=0;$<p;$++)s.append(c[$],H()),T.nextNode(),l.push({type:2,index:++o});s.append(c[p],H())}}}else if(s.nodeType===8)if(s.data===Mt)l.push({type:2,index:o});else{let c=-1;for(;(c=s.data.indexOf(C,c+1))!==-1;)l.push({type:7,index:o}),c+=C.length-1}o++}}static createElement(t,e){const r=U.createElement("template");return r.innerHTML=t,r}}function O(i,t,e=i,r){if(t===M)return t;let s=r!==void 0?e._$Co?.[r]:e._$Cl;const o=V(t)?void 0:t._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),o===void 0?s=void 0:(s=new o(i),s._$AT(i,e,r)),r!==void 0?(e._$Co??=[])[r]=s:e._$Cl=s),s!==void 0&&(t=O(i,s._$AS(i,t.values),s,r)),t}class ne{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:r}=this._$AD,s=(t?.creationScope??U).importNode(e,!0);T.currentNode=s;let o=T.nextNode(),n=0,a=0,l=r[0];for(;l!==void 0;){if(n===l.index){let u;l.type===2?u=new F(o,o.nextSibling,this,t):l.type===1?u=new l.ctor(o,l.name,l.strings,this,t):l.type===6&&(u=new he(o,this,t)),this._$AV.push(u),l=r[++a]}n!==l?.index&&(o=T.nextNode(),n++)}return T.currentNode=U,s}p(t){let e=0;for(const r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(t,r,e),e+=r.strings.length-2):r._$AI(t[e])),e++}}class F{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,r,s){this.type=2,this._$AH=f,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=r,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=O(this,t,e),V(t)?t===f||t==null||t===""?(this._$AH!==f&&this._$AR(),this._$AH=f):t!==this._$AH&&t!==M&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):re(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==f&&V(this._$AH)?this._$AA.nextSibling.data=t:this.T(U.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:r}=t,s=typeof r=="number"?this._$AC(t):(r.el===void 0&&(r.el=q.createElement(Nt(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===s)this._$AH.p(e);else{const o=new ne(s,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=Et.get(t.strings);return e===void 0&&Et.set(t.strings,e=new q(t)),e}k(t){dt(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let r,s=0;for(const o of t)s===e.length?e.push(r=new F(this.O(H()),this.O(H()),this,this.options)):r=e[s],r._$AI(o),s++;s<e.length&&(this._$AR(r&&r._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const r=xt(t).nextSibling;xt(t).remove(),t=r}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,r,s,o){this.type=1,this._$AH=f,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=f}_$AI(t,e=this,r,s){const o=this.strings;let n=!1;if(o===void 0)t=O(this,t,e,0),n=!V(t)||t!==this._$AH&&t!==M,n&&(this._$AH=t);else{const a=t;let l,u;for(t=o[0],l=0;l<o.length-1;l++)u=O(this,a[r+l],e,l),u===M&&(u=this._$AH[l]),n||=!V(u)||u!==this._$AH[l],u===f?t=f:t!==f&&(t+=(u??"")+o[l+1]),this._$AH[l]=u}n&&!s&&this.j(t)}j(t){t===f?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class ae extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===f?void 0:t}}class le extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==f)}}class ce extends tt{constructor(t,e,r,s,o){super(t,e,r,s,o),this.type=5}_$AI(t,e=this){if((t=O(this,t,e,0)??f)===M)return;const r=this._$AH,s=t===f&&r!==f||t.capture!==r.capture||t.once!==r.once||t.passive!==r.passive,o=t!==f&&(r===f||s);s&&this.element.removeEventListener(this.name,this,r),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class he{constructor(t,e,r){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(t){O(this,t)}}const ue=ut.litHtmlPolyfillSupport;ue?.(q,F),(ut.litHtmlVersions??=[]).push("3.3.2");const de=(i,t,e)=>{const r=e?.renderBefore??t;let s=r._$litPart$;if(s===void 0){const o=e?.renderBefore??null;r._$litPart$=s=new F(t.insertBefore(H(),o),o,void 0,e??{})}return s._$AI(i),s};const pt=globalThis;class A extends k{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=de(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return M}}A._$litElement$=!0,A.finalized=!0,pt.litElementHydrateSupport?.({LitElement:A});const pe=pt.litElementPolyfillSupport;pe?.({LitElement:A});(pt.litElementVersions??=[]).push("4.2.2");const z=i=>(t,e)=>{e!==void 0?e.addInitializer(()=>{customElements.define(i,t)}):customElements.define(i,t)};const fe={attribute:!0,type:String,converter:X,reflect:!1,hasChanged:ht},ge=(i=fe,t,e)=>{const{kind:r,metadata:s}=e;let o=globalThis.litPropertyMetadata.get(s);if(o===void 0&&globalThis.litPropertyMetadata.set(s,o=new Map),r==="setter"&&((i=Object.create(i)).wrapped=!0),o.set(e.name,i),r==="accessor"){const{name:n}=e;return{set(a){const l=t.get.call(this);t.set.call(this,a),this.requestUpdate(n,l,i,!0,a)},init(a){return a!==void 0&&this.C(n,void 0,i,a),a}}}if(r==="setter"){const{name:n}=e;return function(a){const l=this[n];t.call(this,a),this.requestUpdate(n,l,i,!0,a)}}throw Error("Unsupported decorator location: "+r)};function y(i){return(t,e)=>typeof e=="object"?ge(i,t,e):((r,s,o)=>{const n=s.hasOwnProperty(o);return s.constructor.createProperty(o,r),n?Object.getOwnPropertyDescriptor(s,o):void 0})(i,t,e)}function w(i){return y({...i,state:!0,attribute:!1})}class me{constructor(){this.popStateListeners=[],this.clickListeners=[],this.boundPopState=()=>{this.popStateListeners.forEach(t=>t())},this.boundClick=t=>{this.clickListeners.forEach(e=>e(t))},window.addEventListener("popstate",this.boundPopState),document.addEventListener("click",this.boundClick)}get origin(){return window.location.origin}getCurrentPath(){return window.location.pathname}getCurrentURL(){return window.location.href}getScrollPosition(){return{x:window.scrollX,y:window.scrollY}}pushState(t,e){window.history.pushState(t,"",e)}replaceState(t,e){window.history.replaceState(t,"",e)}back(){window.history.back()}forward(){window.history.forward()}onPopState(t){return this.popStateListeners.push(t),()=>{const e=this.popStateListeners.indexOf(t);e>-1&&this.popStateListeners.splice(e,1)}}onLinkClick(t){return this.clickListeners.push(t),()=>{const e=this.clickListeners.indexOf(t);e>-1&&this.clickListeners.splice(e,1)}}scrollTo(t,e){window.scrollTo(t,e)}scrollIntoView(t){const e=document.getElementById(t);e&&e.scrollIntoView({behavior:"smooth"})}dispose(){window.removeEventListener("popstate",this.boundPopState),document.removeEventListener("click",this.boundClick),this.popStateListeners=[],this.clickListeners=[]}}const ft=Symbol("router");class Rt{constructor(t=100){this.cache=new Map,this.maxSize=t}get(t){const e=this.cache.get(t);return e!==void 0&&(this.cache.delete(t),this.cache.set(t,e)),e}set(t,e){if(this.cache.has(t)&&this.cache.delete(t),this.cache.size>=this.maxSize){const r=this.cache.keys().next().value;r!==void 0&&this.cache.delete(r)}this.cache.set(t,e)}has(t){return this.cache.get(t)!==void 0}clear(){this.cache.clear()}get size(){return this.cache.size}values(){return this.cache.values()}}class Dt{constructor(t={}){this.routes=[],this.compiledRoutes=[],this.namedRoutes=new Map,this.controllers=new Set,this.basePath="",this.lazyCache=new WeakMap,this.currentMatch=null,this.scrollPositions=new Map,this.scrollRestoration=!0,this.useViewTransitions=!1,this.redirectCount=0,this.MAX_REDIRECTS=10,this.navigationDepth=0,this.MAX_NAVIGATION_DEPTH=10,this.enableMetrics=!0,this.prefetchCache=new WeakMap,this.beforeNavigateStartListeners=[],this.afterNavigateStartListeners=[],this.beforeNavigateEndListeners=[],this.afterNavigateEndListeners=[],this.navigateErrorListeners=[],this.historyAdapter=t.history??new me,this.baseUrl=this.historyAdapter.origin,this.basePath=t.basePath||"",this.scrollRestoration=t.scrollRestoration??!0,this.useViewTransitions=t.useViewTransitions??!1,this.fallbackRoute=t.fallbackRoute,this.routeTree=this.createNode(""),this.enableMetrics=t.enableMetrics??!0,this.reportPerformance=t.reportPerformance,this.analyticsEndpoint=t.analyticsEndpoint,this.timings=new Rt(t.maxMetricsEntries??100),this.routeStats=new Rt(t.maxMetricsEntries??100),this.prefetchConfig=t.prefetch,this.prefetchConfig&&this.setupPrefetching(),this.cleanupLinkClick=this.historyAdapter.onLinkClick(this.handleClick.bind(this)),this.cleanupPopState=this.historyAdapter.onPopState(this.handlePopState.bind(this))}handleClick(t){const e=t.target.closest("a");if(!e||t.metaKey||t.ctrlKey||t.shiftKey||t.altKey||t.button!==0||e.target==="_blank"||e.hasAttribute("download")||e.getAttribute("rel")==="external")return;const r=e.getAttribute("href");r&&(r.startsWith("http")||r.startsWith("//")||(t.preventDefault(),this.navigate(r)))}handlePopState(){if(this.scrollRestoration){const t=this.historyAdapter.getCurrentPath(),e=this.scrollPositions.get(t);e&&this.historyAdapter.scrollTo(e.x,e.y)}this.notifyControllers()}setRoutes(t){this.routes=t,this.compiledRoutes=this.compileRoutes(t),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes)}onBeforeNavigateStart(t){return this.beforeNavigateStartListeners.push(t),()=>{const e=this.beforeNavigateStartListeners.indexOf(t);e>-1&&this.beforeNavigateStartListeners.splice(e,1)}}onAfterNavigateStart(t){return this.afterNavigateStartListeners.push(t),()=>{const e=this.afterNavigateStartListeners.indexOf(t);e>-1&&this.afterNavigateStartListeners.splice(e,1)}}onBeforeNavigateEnd(t){return this.beforeNavigateEndListeners.push(t),()=>{const e=this.beforeNavigateEndListeners.indexOf(t);e>-1&&this.beforeNavigateEndListeners.splice(e,1)}}onAfterNavigateEnd(t){return this.afterNavigateEndListeners.push(t),()=>{const e=this.afterNavigateEndListeners.indexOf(t);e>-1&&this.afterNavigateEndListeners.splice(e,1)}}onNavigateError(t){return this.navigateErrorListeners.push(t),()=>{const e=this.navigateErrorListeners.indexOf(t);e>-1&&this.navigateErrorListeners.splice(e,1)}}async emitBeforeNavigateStart(t){return!(await Promise.all(this.beforeNavigateStartListeners.map(r=>r(t)))).includes(!1)}async emitAfterNavigateStart(t){return!(await Promise.all(this.afterNavigateStartListeners.map(r=>r(t)))).includes(!1)}async emitBeforeNavigateEnd(t){return!(await Promise.all(this.beforeNavigateEndListeners.map(r=>r(t)))).includes(!1)}async emitAfterNavigateEnd(t){return!(await Promise.all(this.afterNavigateEndListeners.map(r=>r(t)))).includes(!1)}emitNavigateError(t){this.navigateErrorListeners.forEach(e=>e(t))}compileRoutes(t,e=""){const r=[];for(const s of t){const o=this.normalizePath(e+s.path),n=this.basePath+o;try{const a=new URLPattern({pathname:n}),l=this.calculateRoutePriority(s.path),u={...s,pattern:a,fullPath:o,priority:l};if(r.push(u),s.children){const h=this.compileRoutes(s.children,o);r.push(...h)}}catch(a){console.error(`Failed to compile route pattern: ${n}`,a)}}return r.sort((s,o)=>o.priority-s.priority)}calculateRoutePriority(t){if(t==="/")return 100;let e=0;const r=t.split("/").filter(Boolean);for(const s of r)s==="*"||s==="**"||/^\(.*\)$/.test(s)?e+=1:s.startsWith(":")?e+=10:e+=100;return e}createNode(t){return{segment:t,routes:[],children:new Map}}buildRouteTree(t){this.routeTree=this.createNode("");for(const e of t){const r=e.fullPath.split("/").filter(Boolean);let s=this.routeTree;for(const o of r)o==="*"||o==="**"?(s.wildcardChild||(s.wildcardChild=this.createNode(o)),s=s.wildcardChild):o.startsWith(":")?(s.paramChild||(s.paramChild=this.createNode(o)),s=s.paramChild):(s.children.has(o)||s.children.set(o,this.createNode(o)),s=s.children.get(o));s.routes.push(e)}}buildNamedRoutesMap(t){this.namedRoutes.clear();for(const e of t)e.name&&this.namedRoutes.set(e.name,e)}normalizePath(t){return t=t.startsWith("/")?t:"/"+t,t==="/"?t:t.replace(/\/$/,"")}async navigate(t,e={}){const r=Date.now(),s=performance.now();let o=0,n=0,a=0,l=0,u=0;try{if(this.navigationDepth++,this.navigationDepth>this.MAX_NAVIGATION_DEPTH)return console.error(`Maximum navigation depth (${this.MAX_NAVIGATION_DEPTH}) exceeded. Possible infinite redirect loop.`),this.navigationDepth=0,!1;this.scrollRestoration&&this.currentMatch&&this.scrollPositions.set(this.currentMatch.path,this.historyAdapter.getScrollPosition());let h;try{h=new URL(t,this.baseUrl)}catch{h=new URL(this.baseUrl+this.basePath+t)}e.query&&Object.entries(e.query).forEach(([g,b])=>{h.searchParams.set(g,b)}),e.hash&&(h.hash=e.hash);let c=this.matchURL(h);if(!c&&this.fallbackRoute){const g=new URL(this.basePath+this.fallbackRoute.path,this.baseUrl);c=this.matchURL(g)}if(!c)return console.warn(`No route found for ${h.pathname}`),!1;const p={from:this.currentMatch,to:c,timestamp:r};if(!await this.emitBeforeNavigateStart(p))return!1;const S=performance.now();if(!e.skipGuards&&this.currentMatch){const g=this.findRouteByPath(this.currentMatch.path);if(g?.canDeactivate&&!await g.canDeactivate(c,this.currentMatch))return!1}if(!e.skipGuards){const g=this.findRouteByPath(c.path);if(g?.beforeEnter&&!await g.beforeEnter(c,this.currentMatch))return!1}o=performance.now()-S;const R=this.findRouteByPath(c.path);if(R?.redirect){const g=performance.now();if(this.redirectCount++,this.redirectCount>this.MAX_REDIRECTS)return console.error("Maximum redirect limit reached"),this.redirectCount=0,!1;const b=await this.navigate(R.redirect,{...e,replace:!0});return u=performance.now()-g,b}if(this.redirectCount=0,!await this.emitAfterNavigateStart(p))return!1;const gt=async()=>{const g=performance.now(),b=h.pathname+h.search+h.hash;e.replace?this.historyAdapter.replaceState(e.state||null,b):this.historyAdapter.pushState(e.state||null,b);const rt=performance.now();if(this.currentMatch){const K=this.findRouteByPath(this.currentMatch.path);if(K?.animation?.exit){const I=document.querySelectorAll("[data-route-element]");await Promise.all(Array.from(I).map(Vt=>K.animation.exit(Vt)))}}if(this.currentMatch=c,R?.animation?.enter){await new Promise(I=>requestAnimationFrame(()=>I()));const K=document.querySelectorAll("[data-route-element]");await Promise.all(Array.from(K).map(I=>R.animation.enter(I)))}a=performance.now()-rt,n=performance.now()-g-a;const Ht=performance.now();if(this.scrollRestoration&&(h.hash?this.historyAdapter.scrollIntoView(h.hash.slice(1)):e.replace||this.historyAdapter.scrollTo(0,0)),l=performance.now()-Ht,!await this.emitBeforeNavigateEnd(p))return!1;await this.notifyControllers()};if(this.useViewTransitions&&"startViewTransition"in document?await document.startViewTransition(gt).finished:await gt(),this.enableMetrics){const b={total:performance.now()-s,guards:o,templateRender:n,animations:a,scrollRestoration:l,redirect:u,path:c.path,timestamp:r};if(this.timings.set(c.path,b),this.reportPerformance&&this.reportPerformance(b),this.analyticsEndpoint&&"sendBeacon"in navigator){const rt=JSON.stringify({type:"navigation",...b});navigator.sendBeacon(this.analyticsEndpoint,rt)}}return await this.emitAfterNavigateEnd(p),this.navigationDepth=0,!0}catch(h){if(this.navigationDepth=0,await this.handleRouteError(h,t,e))return!0;const p={from:this.currentMatch,to:{path:t,params:{},query:new URLSearchParams,hash:"",chain:[]},timestamp:r,error:h};throw this.emitNavigateError(p),h}finally{this.navigationDepth=Math.max(0,this.navigationDepth-1)}}navigateByName(t,e={}){const r=this.namedRoutes.get(t);return r?this.navigate(r.fullPath,e):(console.warn(`No route found with name: ${t}`),Promise.resolve(!1))}findRouteByPath(t){return this.compiledRoutes.find(e=>e.fullPath===t)}match(t){if(t){const r=new URL(t,this.baseUrl);return this.matchURL(r)}const e=new URL(this.historyAdapter.getCurrentURL());return this.matchURL(e)}matchAtDepth(t,e){const r=this.match(e);return r&&r.chain[t]||null}matchURL(t){const e=this.stripBasePath(t.pathname),r=[];for(const s of this.compiledRoutes){const o=s.pattern.exec(t);if(o){const n={};o.pathname.groups&&Object.assign(n,o.pathname.groups);const a={path:s.fullPath,params:n,query:t.searchParams,hash:t.hash,template:s.template,component:s.component,name:s.name,metadata:s.metadata,animation:s.animation,chain:[]};if(this.buildChain(r,a,e),a.chain=r,s.lazy){const l=this.lazyCache.get(s),u=this.hasMatchingChildRoute(e,s);if(l&&!(l instanceof Promise)){if(this.enableMetrics){const p=Date.now();this.routeStats.set(`${p}:${s.path}`,{path:s.path,loadTime:0,cacheHit:!0,timestamp:p})}return a}if(u)return a;if(l instanceof Promise)return l.then(()=>this.notifyControllers()).catch(()=>this.notifyControllers()),a.loading=!0,a;const h=performance.now(),c=s.lazy().then(p=>{const $=performance.now()-h;if(this.lazyCache.set(s,p),this.enableMetrics){const R=Date.now();this.routeStats.set(`${R}:${s.path}`,{path:s.path,loadTime:$,cacheHit:!1,timestamp:R})}const S=this.compileRoutes(p,s.fullPath);return this.compiledRoutes.push(...S),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes),p}).catch(p=>{throw this.lazyCache.delete(s),p});return this.lazyCache.set(s,c),c.then(()=>this.notifyControllers()).catch(()=>this.notifyControllers()),a.loading=!0,a}return a}}return null}hasMatchingChildRoute(t,e){return this.compiledRoutes.some(r=>r.fullPath.startsWith(e.fullPath)&&r.fullPath!==e.fullPath)}buildChain(t,e,r){t.push(e)}stripBasePath(t){return this.basePath&&t.startsWith(this.basePath)?t.slice(this.basePath.length)||"/":t}getCurrentPath(){return this.historyAdapter.getCurrentPath()}getHistoryAdapter(){return this.historyAdapter}dispose(){this.cleanupPopState?.(),this.cleanupLinkClick?.(),this.historyAdapter.dispose()}addController(t){this.controllers.add(t)}removeController(t){this.controllers.delete(t)}async notifyControllers(){const t=[];this.controllers.forEach(e=>t.push(e.routeChanged())),await Promise.all(t)}setupPrefetching(){if(!this.prefetchConfig)return;const{strategy:t,delay:e=50,threshold:r=.1}=this.prefetchConfig,s=typeof document<"u";if(t==="hover"&&s)document.addEventListener("mouseover",o=>{const n=o.target.closest("a");if(!n||!n.href)return;const a=new URL(n.href);a.origin===this.historyAdapter.origin&&setTimeout(()=>{this.preload(a.pathname).catch(()=>{})},e)},{passive:!0});else if(t==="visible"&&s){const o=new IntersectionObserver(l=>{l.forEach(u=>{if(u.isIntersecting){const h=u.target;if(!h.href)return;const c=new URL(h.href);c.origin===this.historyAdapter.origin&&this.preload(c.pathname).catch(()=>{})}})},{threshold:r}),n=()=>{document.querySelectorAll("a[href]").forEach(l=>{o.observe(l)})};n(),new MutationObserver(n).observe(document.body,{childList:!0,subtree:!0})}else if(t==="idle")if(typeof window<"u"&&"requestIdleCallback"in window){const o=()=>{this.preloadAll().catch(()=>{})};window.requestIdleCallback(o,{timeout:2e3})}else setTimeout(()=>this.preloadAll().catch(()=>{}),1e3)}async preload(t){const e=new URL(t,this.baseUrl),r=this.matchURL(e);if(r)for(const s of r.chain){const o=this.findRouteByPath(s.path);if(o&&o.lazy&&!this.lazyCache.has(o)){const n=performance.now(),a=this.prefetchCache.has(o);try{if(a){const u=await this.prefetchCache.get(o);this.lazyCache.set(o,u)}else{const u=o.lazy();this.prefetchCache.set(o,u);const h=await u;this.lazyCache.set(o,h);const c=performance.now()-n;this.routeStats.set(o.path,{path:o.path,loadTime:c,cacheHit:!1,timestamp:Date.now()})}const l=this.lazyCache.get(o);if(Array.isArray(l)){const u=this.compileRoutes(l,o.path);this.compiledRoutes.push(...u),this.buildNamedRoutesMap(this.compiledRoutes),this.buildRouteTree(this.compiledRoutes)}}catch(l){console.warn(`Failed to preload route ${o.path}:`,l)}}}}async preloadAll(){const t=this.compiledRoutes.filter(e=>e.lazy);await Promise.all(t.map(e=>this.preload(e.fullPath)))}async handleRouteError(t,e,r){const s=new URL(e,this.baseUrl),o=this.matchURL(s);if(!o)return!1;const n=this.findErrorBoundary(o.chain);if(!n)return!1;n.onError&&n.onError(t,o);const a=r._retryCount??0,l=n.maxRetries??3;if(a<l){const h={...r,_retryCount:a+1};n.retrySkipGuards&&(h.skipGuards=!0);try{return await this.navigate(e,h)}catch{}}const u={...o,template:n.fallback,error:t};return this.currentMatch=u,this.notifyControllers(),!0}findErrorBoundary(t){for(let e=t.length-1;e>=0;e--){const r=t[e],s=this.findRouteByPath(r.path);if(s?.errorBoundary)return s.errorBoundary}}getTimings(){return Array.from(this.timings.values())}getLastTiming(){const t=Array.from(this.timings.values());return t[t.length-1]}clearTimings(){this.timings.clear()}getRouteStats(){return Array.from(this.routeStats.values())}getStats(t){return Array.from(this.routeStats.values()).filter(e=>e.path===t).sort((e,r)=>r.timestamp-e.timestamp)[0]}clearStats(){this.routeStats.clear()}getAggregatedStats(){const t=this.getRouteStats(),e=t.length,r=t.filter(n=>n.cacheHit).length,s=t.filter(n=>!n.cacheHit).map(n=>n.loadTime),o=s.length>0?s.reduce((n,a)=>n+a,0)/s.length:0;return{totalLoads:e,cacheHits:r,averageLoadTime:o}}}class zt{constructor(t,e,r=0){this.host=t,this.router=e,this.depth=r,t.addController(this)}hostConnected(){this.router.addController(this)}hostDisconnected(){this.router.removeController(this)}routeChanged(){return this.host.requestUpdate(),this.host.updateComplete}navigate(t,e){return this.router.navigate(t,e)}navigateByName(t,e){return this.router.navigateByName(t,e)}match(t){return this.router.matchAtDepth(this.depth,t)}getCurrentPath(){return this.router.getCurrentPath()}getDepth(){return this.depth}}const m=new Dt;var be=Object.defineProperty,ve=Object.getOwnPropertyDescriptor,et=(i,t,e,r)=>{for(var s=r>1?void 0:r?ve(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&be(t,e,s),s};const It=Symbol("router-depth");let N=class extends A{constructor(){super(...arguments),this.parentDepth=-1,this.routerInstance=m,this.currentDepth=0}connectedCallback(){super.connectedCallback(),this.currentDepth=this.parentDepth+1,this.routerController=new zt(this,this.routerInstance,this.currentDepth)}render(){if(!this.routerController)return d`<slot></slot>`;const i=this.routerController.match();if(!i)return d`<slot></slot>`;if(i.loading)return d`<div class="loading">Loading...</div>`;if(i.error)return d`
				<div class="error">
					<strong>Error:</strong> ${i.error.message}
				</div>
			`;if(i.template)return i.template(i.params);if(i.component){const t=document.createElement(i.component);return Object.entries(i.params).forEach(([e,r])=>{t[e]=r}),t}return d`<slot></slot>`}};N.styles=W`
		:host {
			display: block;
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
	`;et([at({context:It,subscribe:!0}),y({type:Number})],N.prototype,"parentDepth",2);et([at({context:ft,subscribe:!0}),y({attribute:!1})],N.prototype,"routerInstance",2);et([Tt({context:It}),y({type:Number})],N.prototype,"currentDepth",2);N=et([z("router-outlet")],N);var ye=Object.defineProperty,we=Object.getOwnPropertyDescriptor,E=(i,t,e,r)=>{for(var s=r>1?void 0:r?we(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&ye(t,e,s),s};let P=class extends A{constructor(){super(...arguments),this.to="",this.name="",this.replace=!1,this.activeClass="active",this.routerInstance=m}connectedCallback(){super.connectedCallback(),this.routerController=new zt(this,this.routerInstance)}async handleClick(i){if(i.preventDefault(),!this.routerController)return;const t={replace:this.replace,query:this.query,hash:this.hash};this.name?await this.routerController.navigateByName(this.name,t):await this.routerController.navigate(this.to,t)}render(){if(!this.routerController)return d`<slot></slot>`;const i=this.routerController.getCurrentPath(),t=this.name?"#":this.to,r=i===this.to?this.activeClass:"";return d`
			<a href="${t}" class="${r}" @click="${this.handleClick}">
				<slot></slot>
			</a>
		`}};P.styles=W`
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
	`;E([y({type:String})],P.prototype,"to",2);E([y({type:String})],P.prototype,"name",2);E([y({type:Boolean})],P.prototype,"replace",2);E([y({type:String})],P.prototype,"activeClass",2);E([y({type:Object})],P.prototype,"query",2);E([y({type:String})],P.prototype,"hash",2);E([at({context:ft,subscribe:!0}),y({attribute:!1})],P.prototype,"routerInstance",2);P=E([z("router-link")],P);var $e=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,Bt=(i,t,e,r)=>{for(var s=r>1?void 0:r?xe(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&$e(t,e,s),s};let nt=class extends A{constructor(i){super(),this.router=new Dt(i)}render(){return d`<slot></slot>`}};Bt([Tt({context:ft}),y({attribute:!1})],nt.prototype,"router",2);nt=Bt([z("router-provider")],nt);class Ae{constructor(){this.currentUser=null,this.listeners=new Set,this.isRefreshing=!1,this.refreshPromise=null}async getCurrentUser(){if(this.currentUser===null)try{const t=await fetch("/api/auth/me",{credentials:"include"});if(t.ok){const e=await t.json();this.currentUser=e.username}else this.currentUser=null}catch(t){console.error("[AuthService] Not authenticated (exception):",t),this.currentUser=null}return this.currentUser}async login(t){if(!t.trim())return{success:!1,error:"Username cannot be empty"};try{const e=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({username:t.trim()})});if(e.ok){const r=await e.json();return this.currentUser=r.username,this.notifyListeners(),{success:!0}}else return{success:!1,error:await e.text()}}catch(e){return{success:!1,error:e instanceof Error?e.message:"Unknown error"}}}async logout(){try{await fetch("/api/auth/logout",{method:"POST",credentials:"include"})}catch{}this.currentUser=null,this.notifyListeners()}async isAuthenticated(){return!!await this.getCurrentUser()}onAuthenticationStateChanged(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notifyListeners(){this.listeners.forEach(t=>t())}async refreshToken(){if(this.isRefreshing)return this.refreshPromise??!1;this.isRefreshing=!0,this.refreshPromise=this.performRefresh();try{return await this.refreshPromise}finally{this.isRefreshing=!1,this.refreshPromise=null}}async performRefresh(){try{const t=await fetch("/api/auth/refresh",{method:"POST",credentials:"include"});if(t.ok){const e=await t.json();return this.currentUser=e.username,this.notifyListeners(),!0}else return this.currentUser=null,this.notifyListeners(),!1}catch(t){return console.error("[AuthService] Token refresh failed:",t),this.currentUser=null,this.notifyListeners(),!1}}async fetchWithAuth(t,e={}){const r={...e,credentials:"include"};let s=await fetch(t,r);return s.status===401&&await this.refreshToken()&&(s=await fetch(t,r)),s}}const v=new Ae;var Pe=Object.defineProperty,_e=Object.getOwnPropertyDescriptor,st=(i,t,e,r)=>{for(var s=r>1?void 0:r?_e(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&Pe(t,e,s),s};let D=class extends A{constructor(){super(...arguments),this.username="",this.errorMessage="",this.isLoggingIn=!1}async handleLogin(){if(this.errorMessage="",!this.username.trim()){this.errorMessage="Please enter a username";return}try{this.isLoggingIn=!0;const i=await v.login(this.username.trim());i.success?await m.navigate("/"):this.errorMessage=i.error??"Login failed"}catch(i){this.errorMessage=`Login failed: ${i instanceof Error?i.message:"Unknown error"}`}finally{this.isLoggingIn=!1}}handleKeyPress(i){i.key==="Enter"&&this.handleLogin()}render(){return d`
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
								@input=${i=>{this.username=i.target.value}}
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
		`}};D.styles=W`
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
	`;st([w()],D.prototype,"username",2);st([w()],D.prototype,"errorMessage",2);st([w()],D.prototype,"isLoggingIn",2);D=st([z("login-page")],D);class Se{constructor(){this.config=null}async getConfig(){if(!this.config){const t=await fetch("/api/config");if(!t.ok)throw new Error(`Failed to fetch registry config: ${t.statusText}`);this.config=await t.json()}return this.config}async isPublic(){return(await this.getConfig()).accessMode==="public"}}const Z=new Se;class Ce{async getPlugins(t){const e=new URLSearchParams;t?.search&&e.set("search",t.search),t?.tag&&e.set("tag",t.tag),t?.page&&e.set("page",t.page.toString()),t?.pageSize&&e.set("pageSize",t.pageSize.toString());const r=`/api/plugins${e.toString()?"?"+e.toString():""}`,s=await v.fetchWithAuth(r);if(!s.ok)throw new Error(`Failed to fetch plugins: ${s.statusText}`);return await s.json()}async getPlugin(t){const e=await v.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}`);if(!e.ok)throw new Error(`Failed to fetch plugin: ${e.statusText}`);return await e.json()}async deleteVersion(t,e){const r=await v.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}/versions/${encodeURIComponent(e)}`,{method:"DELETE"});if(!r.ok)throw new Error(`Failed to delete plugin version: ${r.statusText}`)}async downloadPlugin(t,e){const r=await v.fetchWithAuth(`/api/plugins/${encodeURIComponent(t)}/versions/${encodeURIComponent(e)}/download`);if(!r.ok)throw new Error(`Failed to download plugin: ${r.statusText}`);return await r.blob()}async uploadPlugin(t){const e=new FormData;e.append("file",t);const r=await v.fetchWithAuth("/api/plugins/upload",{method:"POST",body:e});if(!r.ok){const s=await r.json();throw new Error(s.error||`Failed to upload plugin: ${r.statusText}`)}return await r.json()}}const ot=new Ce;var Ee=Object.defineProperty,Re=Object.getOwnPropertyDescriptor,_=(i,t,e,r)=>{for(var s=r>1?void 0:r?Re(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&Ee(t,e,s),s};let x=class extends A{constructor(){super(...arguments),this.activeTab="browse",this.plugins=[],this.loading=!1,this.currentUser=null,this.uploadStatus=null,this.uploadError=null,this.uploadProgress=!1,this.accessMode="private",this.selectedFile=null}connectedCallback(){super.connectedCallback(),this.initialize()}async initialize(){const i=await Z.getConfig();this.accessMode=i.accessMode,this.currentUser=await v.getCurrentUser(),await this.loadPlugins()}async loadPlugins(){this.loading=!0;try{const i=await ot.getPlugins();this.plugins=i.plugins}catch(i){console.error("Failed to load plugins:",i)}finally{this.loading=!1}}async deleteVersion(i,t){if(confirm(`Delete ${i} version ${t}?`))try{await ot.deleteVersion(i,t),await this.loadPlugins()}catch(e){console.error("Failed to delete version:",e),alert("Failed to delete plugin version")}}formatFileSize(i){const t=["B","KB","MB","GB"];let e=i,r=0;for(;e>=1024&&r<t.length-1;)r++,e=e/1024;return`${e.toFixed(2)} ${t[r]}`}formatDate(i){return new Date(i).toLocaleString()}get isAuthenticated(){return!!this.currentUser}async handleLogin(){await m.navigate("/login")}async handleLogout(){await v.logout(),this.accessMode==="private"?await m.navigate("/login"):(this.currentUser=null,this.activeTab="browse")}renderBrowseTab(){return this.loading?d`<div class="loading">Loading...</div>`:this.plugins.length===0?d`<p>No plugins in registry.</p>`:d`
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
					${this.plugins.map(i=>d`
							<tr>
								<td><strong>${i.name}</strong></td>
								<td>${i.latestVersion??"N/A"}</td>
								<td>${i.author??""}</td>
								<td>${i.description??""}</td>
								<td>${i.totalDownloads??0}</td>
								<td>
									<button
										class="btn-small btn-primary"
										@click=${()=>this.viewPluginDetails(i.name)}
									>
										View Details
									</button>
								</td>
							</tr>
						`)}
				</tbody>
			</table>
		`}async viewPluginDetails(i){console.log("View details for:",i)}renderUploadTab(){return d`
			<h2>Upload Plugin Package</h2>

			${this.uploadStatus?d`<div class="alert alert-success">${this.uploadStatus}</div>`:""}
			${this.uploadError?d`<div class="alert alert-error">${this.uploadError}</div>`:""}

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

				${this.uploadProgress?d`<div class="upload-progress">Uploading...</div>`:""}

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
		`}handleFileSelect(i){const t=i.target;this.selectedFile=t.files?.[0]||null,this.uploadStatus=null,this.uploadError=null}async handleUpload(){if(!this.selectedFile){this.uploadError="Please select a file to upload";return}if(!this.selectedFile.name.endsWith(".pivotpkg")){this.uploadError="Please select a valid .pivotpkg file";return}this.uploadProgress=!0,this.uploadError=null,this.uploadStatus=null;try{const i=await ot.uploadPlugin(this.selectedFile);this.uploadStatus=`Successfully uploaded ${i.plugin} v${i.version}`,this.selectedFile=null;const t=this.shadowRoot?.querySelector("#plugin-file");t&&(t.value=""),await this.loadPlugins()}catch(i){this.uploadError=i instanceof Error?i.message:"Upload failed"}finally{this.uploadProgress=!1}}renderStorageTab(){const i=this.plugins.length,t=this.plugins.reduce((r,s)=>r+(s.versionCount??0),0),e=this.plugins.reduce((r,s)=>r+(s.totalDownloads??0),0);return d`
			<h2>Storage Information</h2>
			<div class="stats-grid">
				<div class="stat-card">
					<h3>Total Plugins</h3>
					<p class="stat-value">${i}</p>
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
		`}render(){return d`
			<div class="header-bar">
				<h1>Registry Manager</h1>
				${this.isAuthenticated?d`
						<button class="btn btn-secondary" @click=${this.handleLogout}>
							Logout (${this.currentUser})
						</button>
					`:this.accessMode==="public"?d`
							<button class="btn btn-primary" @click=${this.handleLogin}>
								Login
							</button>
						`:f}
			</div>

			<div class="tabs">
				<button
					class=${this.activeTab==="browse"?"active":""}
					@click=${()=>this.activeTab="browse"}
				>
					Browse Plugins
				</button>
				${this.isAuthenticated?d`
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
					`:f}
			</div>

			<div class="tab-content">
				${this.activeTab==="browse"?this.renderBrowseTab():this.activeTab==="upload"?this.renderUploadTab():this.renderStorageTab()}
			</div>
		`}};x.styles=W`
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
	`;_([w()],x.prototype,"activeTab",2);_([w()],x.prototype,"plugins",2);_([w()],x.prototype,"loading",2);_([w()],x.prototype,"currentUser",2);_([w()],x.prototype,"uploadStatus",2);_([w()],x.prototype,"uploadError",2);_([w()],x.prototype,"uploadProgress",2);_([w()],x.prototype,"accessMode",2);x=_([z("registry-manager")],x);const Le=[{path:"/login",name:"login",template:()=>d`<login-page></login-page>`,beforeEnter:async()=>await v.isAuthenticated()?(await m.navigate("/"),!1):!0},{path:"/",name:"dashboard",template:()=>d`<registry-manager></registry-manager>`,beforeEnter:async()=>await Z.isPublic()||await v.isAuthenticated()?!0:(await m.navigate("/login"),!1)},{path:"/(.*)",name:"fallback",beforeEnter:async()=>{const i=await Z.isPublic(),t=await v.isAuthenticated();return i?(await m.navigate("/",{replace:!0}),!1):(await m.navigate(t?"/":"/login",{replace:!0}),!1)}}];var Te=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,jt=(i,t,e,r)=>{for(var s=r>1?void 0:r?Ue(t,e):t,o=i.length-1,n;o>=0;o--)(n=i[o])&&(s=(r?n(t,e,s):n(s))||s);return r&&s&&Te(t,e,s),s};let Y=class extends A{constructor(){super(...arguments),this.isInitialized=!1}connectedCallback(){super.connectedCallback(),m.setRoutes(Le),v.onAuthenticationStateChanged(()=>this.handleAuthChange()),this.initialize()}async initialize(){await Z.getConfig(),this.isInitialized=!0,await m.navigate(window.location.pathname)}disconnectedCallback(){super.disconnectedCallback(),m.dispose()}async handleAuthChange(){await m.navigate(window.location.pathname)}render(){return this.isInitialized?d`<router-outlet></router-outlet>`:d`<div class="loading-screen">Loading...</div>`}};Y.styles=W`
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
	`;jt([w()],Y.prototype,"isInitialized",2);Y=jt([z("app-root")],Y);
