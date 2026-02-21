import { CanvasWorkerEditor } from './editor-implementation.js';


const host = new CanvasWorkerEditor();
onmessage = host.onmessage.bind(host);
