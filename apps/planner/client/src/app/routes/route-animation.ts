import { getDefaultAnimation } from '@arcmantle/core/animation';


export const routeAnimation = () => {
	return {
		show: getDefaultAnimation('route.show'),
		hide: getDefaultAnimation('route.hide'),
	};
};
