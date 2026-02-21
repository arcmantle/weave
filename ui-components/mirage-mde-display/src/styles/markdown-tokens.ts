import { type CSSResult, unsafeCSS } from 'lit';

import styles from './markdown-tokens.css?inline';


export const markdownTokens: CSSResult = unsafeCSS(styles);
