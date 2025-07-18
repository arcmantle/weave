
import { css } from '@arcmantle/custom-element/adapter';

import { buttonStyle } from '../../styles/button.styles.js';


export const layoutStyles = css`
:host {
	height: 100%;
	display: grid;
	grid-template-rows: 1fr;
	grid-template-columns: auto 1fr;
	grid-template-areas: "sidebar frame" "sidebar frame";
	background-color: var(--midoc-background);
	color: var(--midoc-on-background);
	overflow: hidden;
}
.header {
	display: grid;
	grid-template-columns: auto 1fr auto;
	grid-template-rows: auto;
	border-bottom: 1px solid var(--midoc-outline);
	margin-inline: 8px;
}
.header >* {
	display: inline-flex;
	flex-flow: row nowrap;
	align-items: center;
}
${ buttonStyle('.scrollback button', 40, 24) }
${ buttonStyle('.nav-toggle button', 40, 24) }
${ buttonStyle('.theme-toggle button', 40, 18) }
.nav-toggle,
.theme-toggle,
.scrollback {
	margin: 8px 12px;
	backdrop-filter: blur(1px);
	border-radius: 999px;
	overflow: hidden;
}
.scrollback {
	position: fixed;
	bottom: 25px;
	right: 20px;
}
.hidden {
	display: none;
}
.loader {
	position: absolute;
	place-self: center;
	font-size: 50px;
	padding: 12px;
	background-color: var(--midoc-surface);
	color: var(--midoc-tertiary);
	border: 1px solid var(--midoc-outline);
	border-radius: 8px;
}
:host(.nav--closed) midoc-sidebar {
	width: 0vw;
}
midoc-sidebar {
	transition: width 0.3s ease;
	width: 250px;
	grid-area: sidebar;
	border-right: var(--midoc-sidebar-border);
	background-color: var(--midoc-sidebar-bg);
}
main {
	position: relative;
	grid-area: frame;
	display: grid;
	grid-template-rows: auto 1fr;
	grid-template-columns: 1fr;
}
section {
	display: grid;
}
iframe {
	transition: opacity 0.2s ease-out;
	opacity: 1;
	height: 100%;
	width: 100%;
	border: none;
	user-select: none;

	&:not(.active) {
		pointer-events: none;
	}
}
`;
