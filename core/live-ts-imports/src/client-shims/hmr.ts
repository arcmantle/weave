const url: string = 'ws://' + location.host;


const setupConnection = (): void => {
	try {
		let socket = new WebSocket(url);

		socket.addEventListener('message', (ev) => {
			if (ev.data === 'reload')
				location.reload();
		});

		socket.addEventListener('close', async () => {
			socket = new WebSocket(url);
			socket.addEventListener('open', () => location.reload());
		});
	}
	catch (err) {
		setupConnection();
	}
};
setupConnection();
