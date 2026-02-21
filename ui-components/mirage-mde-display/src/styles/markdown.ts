import { type CSSResult, unsafeCSS } from 'lit';

import styles from './markdown.css?inline';


export const markdownStyles: CSSResult = unsafeCSS(styles);
