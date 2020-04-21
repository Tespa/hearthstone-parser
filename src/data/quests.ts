import * as questData from './quest-text-map.json';
import {Class} from './meta.js';

const quests: {[TK in keyof typeof questData]: {
	class: Class;
	requirement: number;
	sidequest: boolean;
};} = {
	DRG_008: {
		class: Class.Paladin,
		requirement: 5,
		sidequest: true
	},
	DRG_051: {
		class: Class.Druid,
		requirement: 10,
		sidequest: true
	},
	DRG_251: {
		class: Class.Hunter,
		requirement: 3,
		sidequest: true
	},
	DRG_255: {
		class: Class.Hunter,
		requirement: 3,
		sidequest: true
	},
	DRG_258: {
		class: Class.Hunter,
		requirement: 1,
		sidequest: true
	},
	DRG_317: {
		class: Class.Druid,
		requirement: 2,
		sidequest: true
	},
	DRG_323: {
		class: Class.Mage,
		requirement: 8,
		sidequest: true
	},
	DRG_324: {
		class: Class.Mage,
		requirement: 2,
		sidequest: true
	},
	ULD_131: {
		class: Class.Druid,
		requirement: 4,
		sidequest: false
	},
	ULD_140: {
		class: Class.Warlock,
		requirement: 20,
		sidequest: false
	},
	ULD_155: {
		class: Class.Hunter,
		requirement: 20,
		sidequest: false
	},
	ULD_291: {
		class: Class.Shaman,
		requirement: 6,
		sidequest: false
	},
	ULD_326: {
		class: Class.Rogue,
		requirement: 4,
		sidequest: false
	},
	ULD_431: {
		class: Class.Paladin,
		requirement: 5,
		sidequest: false
	},
	ULD_433: {
		class: Class.Mage,
		requirement: 10,
		sidequest: false
	},
	ULD_711: {
		class: Class.Warrior,
		requirement: 5,
		sidequest: false
	},
	ULD_724: {
		class: Class.Priest,
		requirement: 15,
		sidequest: false
	},
	UNG_028: {
		class: Class.Mage,
		requirement: 8,
		sidequest: false
	},
	UNG_067: {
		class: Class.Rogue,
		requirement: 5,
		sidequest: false
	},
	UNG_116: {
		class: Class.Druid,
		requirement: 5,
		sidequest: false
	},
	UNG_829: {
		class: Class.Warlock,
		requirement: 6,
		sidequest: false
	},
	UNG_920: {
		class: Class.Hunter,
		requirement: 7,
		sidequest: false
	},
	UNG_934: {
		class: Class.Warrior,
		requirement: 7,
		sidequest: false
	},
	UNG_940: {
		class: Class.Priest,
		requirement: 7,
		sidequest: false
	},
	UNG_942: {
		class: Class.Shaman,
		requirement: 10,
		sidequest: false
	},
	UNG_954: {
		class: Class.Paladin,
		requirement: 6,
		sidequest: false
	}
};

export const questMap = new Map(Object.entries(quests));
