import { IndexDBSchema } from '@arcmantle/library/indexdb';
import type { Image } from './components/gallery.cmp.ts';


export class CaptureSession extends IndexDBSchema<CaptureSession> {

	public static override dbIdentifier = 'sessions';
	public static override dbKey = 'id';

	public id = 'current';
	public hash:   string;
	public images: Image[];

}
