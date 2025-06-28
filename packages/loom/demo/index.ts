import { Router } from '@arcmantle/loom';
import { rootModule } from './src/pages/root/root-module.ts';


new Router(document.body, rootModule);
