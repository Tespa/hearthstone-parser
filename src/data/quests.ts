import * as quests from './quest-text-map.json';

const questToRequirementPair: [keyof typeof quests, number][] = [
	['ULD_131', 4],
	['ULD_140', 20],
	['ULD_155', 20],
	['ULD_291', 6],
	['ULD_326', 4],
	['ULD_431', 5],
	['ULD_433', 10],
	['ULD_711', 5],
	['ULD_724', 15],
	['UNG_028', 6],
	['UNG_067', 5],
	['UNG_116', 5],
	['UNG_829', 6],
	['UNG_920', 7],
	['UNG_934', 7],
	['UNG_940', 7],
	['UNG_942', 10],
	['UNG_954', 6]
];

export const questToRequirement = new Map<string, number>(
	questToRequirementPair
);
