import { IndexDBWrapper } from '@arcmantle/library/indexdb';
import { CaptureSession } from '../pages/capture/capture-session.ts';


export const synapseIndexDB = 'synapse';


IndexDBWrapper.setup(synapseIndexDB, (setup) => {
	setup.createCollection(CaptureSession, 'sessions', { autoIncrement: true })
		.createIndex('id', 'id')
		.mutate(() => {});
});
