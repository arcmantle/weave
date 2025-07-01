import { componentStyles } from '@redacted/web-components';
import { css } from 'lit';

/* ------------------------------------------------- */

export const calenderPlannerStyle = [
	componentStyles,
	css`
	:host {
		display: block;
	}
	.base {
		display: grid;
		height: 100%;
		margin-left: 12px;
	}
	`,
];
