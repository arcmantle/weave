import { chronicle } from '@arcmantle/chronicle/chronicle';


export const rebindChronicleDraftRenderTracking = <TDraft extends object>(
	draft:              TDraft | null,
	onRenderRequested:  () => void,
	previousUnsubscribe?: (() => void) | null,
): (() => void) | null => {
	previousUnsubscribe?.();
	if (!draft)
		return null;

	return chronicle.onAny(draft, onRenderRequested);
};


export const applyChronicleDraftHistoryMutation = <TDraft extends object>(
	draft:             TDraft | null,
	canApply:          (draft: TDraft) => boolean,
	apply:             (draft: TDraft) => void,
	onRenderRequested: () => void,
): void => {
	if (!draft || !canApply(draft))
		return;

	apply(draft);
	onRenderRequested();
};
