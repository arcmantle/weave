import { componentStyles } from '@redacted/web-components';
import { css } from 'lit';

/* ------------------------------------------------- */

export const actionSidebarStyle = [
	componentStyles,
	css`
	:host {
		display: grid;
	}
	.base {
		display: grid;
		grid-template-rows: min-content;
		justify-content: center;
		padding: 12px;
	}
	`,
];
