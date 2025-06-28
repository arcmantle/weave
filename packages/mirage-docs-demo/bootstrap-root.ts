import { ContainerLoader, ContainerModule } from '@arcmantle/mirage-docs/app/aegis/index.js';
import { PathTreeAdapter } from '@arcmantle/mirage-docs/app/components/layout/path-tree.cmp.js';
import type { PropertyValues } from 'lit';


class NewSidebar extends PathTreeAdapter {

	public override willUpdate(props: PropertyValues): void {
		super.willUpdate(props);

		//console.log(this.element.paths);
	}

}


const module = new ContainerModule(({ rebind }) => {
	rebind('midoc-path-tree').toConstantValue(NewSidebar);
});

ContainerLoader.load(module);
