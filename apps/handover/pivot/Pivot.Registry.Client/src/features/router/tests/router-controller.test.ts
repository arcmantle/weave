import { html } from 'lit';
import { beforeEach, describe, expect, it } from 'vitest';

import { Router } from '../router.ts';
import { RouterController } from '../router.ts';


describe('RouterController', () => {
	let router: Router;
	let host: any;
	let controller: RouterController;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');

		router = new Router();
		// Mock host object instead of creating LitElement
		host = {
			addController: () => {},
			requestUpdate: () => {},
		};
		controller = new RouterController(host, router);
	});

	it('should create a controller instance', () => {
		expect(controller).toBeDefined();
		expect(controller).toBeInstanceOf(RouterController);
	});

	it('should add controller to router on host connected', () => {
		controller.hostConnected();

		// Controller should be registered with router
		expect(controller).toBeDefined();
	});

	it('should remove controller from router on host disconnected', () => {
		controller.hostConnected();
		controller.hostDisconnected();

		// Controller should be unregistered
		expect(controller).toBeDefined();
	});

	it('should navigate through controller', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/test', template: () => html`<div>Test</div>` },
		]);

		const result = await controller.navigate('/test');

		expect(result).toBe(true);
		expect(window.location.pathname).toBe('/test');
	});

	it('should navigate by name through controller', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>`, name: 'home' },
			{ path: '/profile', template: () => html`<div>Profile</div>`, name: 'profile' },
		]);

		const result = await controller.navigateByName('profile');

		expect(result).toBe(true);
		expect(window.location.pathname).toBe('/profile');
	});

	it('should match routes through controller', () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		]);

		const match = controller.match('/about');

		expect(match).toBeDefined();
	});

	it('should get current path through controller', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/current', template: () => html`<div>Current</div>` },
		]);

		await controller.navigate('/current');

		expect(controller.getCurrentPath()).toBe('/current');
	});

	it('should track depth', () => {
		const depth0 = new RouterController(host, router, 0);
		const depth1 = new RouterController(host, router, 1);
		const depth2 = new RouterController(host, router, 2);

		expect(depth0.getDepth()).toBe(0);
		expect(depth1.getDepth()).toBe(1);
		expect(depth2.getDepth()).toBe(2);
	});

	it('should match at correct depth', () => {
		router.setRoutes([
			{
				path:     '/level1',
				template: () => html`<div>Level 1</div>`,
				children: [
					{
						path:     'level2',
						template: () => html`<div>Level 2</div>`,
						children: [ { path: 'level3', template: () => html`<div>Level 3</div>` } ],
					},
				],
			},
		]);

		const controllerDepth0 = new RouterController(host, router, 0);
		const controllerDepth1 = new RouterController(host, router, 1);

		const match0 = controllerDepth0.match('/level1/level2/level3');
		const match1 = controllerDepth1.match('/level1/level2/level3');

		expect(match0).toBeDefined();
		expect(match1).toBeDefined();
	});

	it('should request update on route change', () => {
		let updateRequested = false;

		const hostWithUpdate = {
			addController: () => {},
			requestUpdate: () => {
				updateRequested = true;
			},
		} as any;

		const testController = new RouterController(hostWithUpdate, router);

		testController.routeChanged();

		expect(updateRequested).toBe(true);
	});
});

describe('RouterController - Integration with Router', () => {
	let router: Router;
	let host: any;
	let _controller: RouterController;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');

		router = new Router();
		host = {
			addController: () => {},
			requestUpdate: () => {},
		};
		_controller = new RouterController(host, router);

		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/page1', template: () => html`<div>Page 1</div>` },
			{ path: '/page2', template: () => html`<div>Page 2</div>` },
		]);
	});

	it('should update when router navigates', async () => {
		let updateCount = 0;

		const hostWithUpdate = {
			addController: () => {},
			requestUpdate: () => {
				updateCount++;
			},
		} as any;

		const testController = new RouterController(hostWithUpdate, router);
		testController.hostConnected();

		await router.navigate('/page1');

		expect(updateCount).toBeGreaterThan(0);
	});

	it('should notify multiple controllers', async () => {
		const updates: number[] = [];

		const createHost = (id: number) => ({
			addController: () => {},
			requestUpdate: () => {
				updates.push(id);
			},
		} as any);

		const controller1 = new RouterController(createHost(1), router);
		const controller2 = new RouterController(createHost(2), router);
		const controller3 = new RouterController(createHost(3), router);

		controller1.hostConnected();
		controller2.hostConnected();
		controller3.hostConnected();

		await router.navigate('/page1');

		expect(updates).toContain(1);
		expect(updates).toContain(2);
		expect(updates).toContain(3);
	});
});
