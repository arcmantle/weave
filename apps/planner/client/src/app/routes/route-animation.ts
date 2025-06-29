import { getDefaultAnimation } from '@arcmantle/library/animation';


export const routeAnimation = () => {
	return {
		show: getDefaultAnimation('route.show'),
		hide: getDefaultAnimation('route.hide'),
	};
};
