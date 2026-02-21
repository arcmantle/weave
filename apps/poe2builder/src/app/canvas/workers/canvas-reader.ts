import { CanvasWorkerReader } from './reader-implementation.js';


const host = new CanvasWorkerReader();
onmessage = host.onmessage.bind(host);
