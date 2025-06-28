import { signal } from '@lit-labs/preact-signals';
import { ContainerModule } from '@arcmantle/lit-aegis';


export const layoutModule = new ContainerModule(({ bind }) => {
	bind('show-info-center').toConstantValue(signal(false));
});
