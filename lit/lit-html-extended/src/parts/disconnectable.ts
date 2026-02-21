export interface Disconnectable {
	_$parent?:                 Disconnectable;
	_$disconnectableChildren?: Set<Disconnectable>;
	// Rather than hold connection state on instances, Disconnectables recursively
	// fetch the connection state from the RootPart they are connected in via
	// getters up the Disconnectable tree via _$parent references.
	// This pushes the cost of tracking the isConnected state to `AsyncDirectives`,
	// and avoids needing to pass all Disconnectables (parts, template instances,
	// and directives) their connection state each time it changes,
	// which would be costly for trees that have no AsyncDirectives.
	_$isConnected:             boolean;
}
