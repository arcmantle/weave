import type { Component } from 'solid-js';

import Comp from './Comp';

const App: Component = () => {
	return (
		<>
			<h1 on:click={(ev) => console.log()} onClick={(ev) => console.log()} >Hello world!!!!</h1>
			<Comp />
			<Comp wc>
			</Comp>
		</>
	);
};

export default App;
