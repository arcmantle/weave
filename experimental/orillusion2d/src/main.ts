import {
	type KnightAnimationDefinition,
	knightAnimationMap,
	knightAnimations,
} from './characters/knight/animation-manifest';
import {
	createKnightBehaviorModel,
	knightBehaviorDefinitions,
	type KnightBehaviorId,
} from './characters/knight/behavior-model';
import { OrillusionKnightViewer, type ViewerStatus } from './orillusion-viewer';

const appShell = document.querySelector<HTMLDivElement>('.app-shell');
const canvas = document.querySelector<HTMLCanvasElement>('#app-canvas');
const behaviorSelect = document.querySelector<HTMLSelectElement>('#behavior-select');
const characterSelect = document.querySelector<HTMLSelectElement>('#character-select');
const select = document.querySelector<HTMLSelectElement>('#animation-select');
const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle');
const restartButton = document.querySelector<HTMLButtonElement>('#restart-animation');
const status = document.querySelector<HTMLDivElement>('#animation-status');

if (!appShell || !canvas || !behaviorSelect || !characterSelect || !select || !playToggle || !restartButton || !status)
	throw new Error('Viewer UI failed to initialize.');

status.textContent = 'Loading viewer...';

const syncCharacterSelector = (viewer: OrillusionKnightViewer): void => {
	const knownStatuses = new Map(
		viewer.getCharacterStatuses().map((characterStatus) => [ characterStatus.characterId, characterStatus ]),
	);

	characterSelect.replaceChildren();
	for (const characterId of viewer.getCharacterIds()) {
		const option = document.createElement('option');
		const characterStatus = knownStatuses.get(characterId);
		option.value = characterId;
		option.textContent = characterStatus
			? `${ characterId } (${ characterStatus.characterType })`
			: characterId;
		characterSelect.appendChild(option);
	}
};

const renderStatus = (viewerStatus: ViewerStatus): void => {
	playing = viewerStatus.playing;
	activeDefinition = knightAnimationMap.get(viewerStatus.animationId) ?? activeDefinition;
	playToggle.textContent = viewerStatus.playing ? 'Pause' : 'Play';
	status.textContent = [
		`Character: ${ viewerStatus.characterId } (${ viewerStatus.characterType })`,
		`Behavior: ${ viewerStatus.behaviorLabel ?? 'Manual' }`,
		`Phase: ${ viewerStatus.behaviorPhase ?? 'manual' }`,
		`Action: ${ viewerStatus.actionId ?? 'none' }`,
		`Motion: ${ viewerStatus.motionCommand ?? 'idle' }`,
		`Active: ${ viewerStatus.animationLabel }`,
		`Frame: ${ viewerStatus.frameIndex + 1 } / ${ viewerStatus.frameCount }`,
		`Sheet: ${ viewerStatus.sheetWidth }x${ viewerStatus.sheetHeight }`,
		`Frame Size: ${ viewerStatus.frameWidth }x${ viewerStatus.frameHeight }`,
		`Playback: ${ viewerStatus.fps } fps`,
	].join('\n');
	behaviorSelect.value = viewerStatus.behaviorId ?? 'manual';
	characterSelect.value = viewerStatus.characterId;
	select.value = viewerStatus.animationId;
};

const manualBehaviorOption = document.createElement('option');
manualBehaviorOption.value = 'manual';
manualBehaviorOption.textContent = 'Manual';
behaviorSelect.appendChild(manualBehaviorOption);

for (const definition of knightBehaviorDefinitions) {
	const option = document.createElement('option');
	option.value = definition.id;
	option.textContent = definition.label;
	behaviorSelect.appendChild(option);
}

for (const definition of knightAnimations) {
	const option = document.createElement('option');
	option.value = definition.id;
	option.textContent = definition.label;
	select.appendChild(option);
}

const viewer = new OrillusionKnightViewer(canvas, renderStatus);

let activeDefinition: KnightAnimationDefinition = knightAnimations[0]!;
let playing = true;

characterSelect.addEventListener('change', () => {
	viewer.setActiveCharacter(characterSelect.value);
});

behaviorSelect.addEventListener('change', () => {
	if (behaviorSelect.value === 'manual') {
		viewer.setBehavior(null);

		return;
	}

	viewer.setBehavior(createKnightBehaviorModel(behaviorSelect.value as KnightBehaviorId));
});

select.addEventListener('change', async () => {
	const nextAnimation = knightAnimationMap.get(select.value);
	if (!nextAnimation)
		return;

	activeDefinition = nextAnimation;
	await viewer.setAnimation(nextAnimation);
});

playToggle.addEventListener('click', () => {
	playing = !playing;
	viewer.setPlaying(playing);
});

restartButton.addEventListener('click', () => {
	viewer.restart();
});

window.addEventListener('beforeunload', () => {
	viewer.stop();
});

try {
	await viewer.start(activeDefinition, createKnightBehaviorModel('lazy-bursts'));
	syncCharacterSelector(viewer);
	appShell.classList.add('is-ready');
}
catch (error) {
	const message = error instanceof Error ? error.message : 'Unknown startup failure.';
	status.textContent = `Startup failed:\n${ message }`;
	behaviorSelect.disabled = true;
	characterSelect.disabled = true;
	playToggle.disabled = true;
	restartButton.disabled = true;
	select.disabled = true;
	throw error;
}
