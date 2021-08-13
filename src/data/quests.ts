import {Class} from './meta';

const quests: {
	[x: string]: {
		class: Class;
		requirement: number;
		sidequest: boolean;
	};
} = {
	FB_Champs_UNG_067: {class: Class.Rogue, requirement: 4, sidequest: false},
	FB_Toki_Quest: {class: Class.Warrior, requirement: 8, sidequest: false},
	Story_03_YShaarjsPower: {class: Class.Warrior, requirement: 6, sidequest: false},
	Story_04_FinalStand: {class: Class.Paladin, requirement: 10, sidequest: false},
	SW_028: {class: Class.Warrior, requirement: 3, sidequest: false},
	SW_028t: {class: Class.Warrior, requirement: 2, sidequest: false},
	SW_028t2: {class: Class.Warrior, requirement: 2, sidequest: false},
	SW_031: {class: Class.Shaman, requirement: 3, sidequest: false},
	SW_031t: {class: Class.Shaman, requirement: 3, sidequest: false},
	SW_031t2: {class: Class.Shaman, requirement: 2, sidequest: false},
	SW_039: {class: Class.DemonHunter, requirement: 4, sidequest: false},
	SW_039t: {class: Class.DemonHunter, requirement: 5, sidequest: false},
	SW_039t3: {class: Class.DemonHunter, requirement: 5, sidequest: false},
	SW_052: {class: Class.Rogue, requirement: 2, sidequest: false},
	SW_052t: {class: Class.Rogue, requirement: 2, sidequest: false},
	SW_052t2: {class: Class.Rogue, requirement: 2, sidequest: false},
	SW_091: {class: Class.Warlock, requirement: 6, sidequest: false},
	SW_091t: {class: Class.Warlock, requirement: 7, sidequest: false},
	SW_091t3: {class: Class.Warlock, requirement: 8, sidequest: false},
	SW_313: {class: Class.Paladin, requirement: 3, sidequest: false},
	SW_313t2: {class: Class.Paladin, requirement: 3, sidequest: false},
	SW_322: {class: Class.Hunter, requirement: 2, sidequest: false},
	SW_322t: {class: Class.Hunter, requirement: 2, sidequest: false},
	SW_322t2: {class: Class.Hunter, requirement: 2, sidequest: false},
	SW_428: {class: Class.Druid, requirement: 4, sidequest: false},
	SW_428t: {class: Class.Druid, requirement: 5, sidequest: false},
	SW_428t2: {class: Class.Druid, requirement: 6, sidequest: false},
	SW_433: {class: Class.Priest, requirement: 3, sidequest: false},
	SW_433t: {class: Class.Priest, requirement: 2, sidequest: false},
	SW_433t2: {class: Class.Priest, requirement: 2, sidequest: false},
	SW_450: {class: Class.Mage, requirement: 3, sidequest: false},
	SW_450t: {class: Class.Mage, requirement: 3, sidequest: false},
	SW_450t2: {class: Class.Mage, requirement: 3, sidequest: false},
	ULD_131: {class: Class.Druid, requirement: 4, sidequest: false},
	ULD_140: {class: Class.Warlock, requirement: 20, sidequest: false},
	ULD_155: {class: Class.Hunter, requirement: 20, sidequest: false},
	ULD_291: {class: Class.Shaman, requirement: 6, sidequest: false},
	ULD_326: {class: Class.Rogue, requirement: 4, sidequest: false},
	ULD_431: {class: Class.Paladin, requirement: 5, sidequest: false},
	ULD_433: {class: Class.Mage, requirement: 10, sidequest: false},
	ULD_711: {class: Class.Warrior, requirement: 5, sidequest: false},
	ULD_724: {class: Class.Priest, requirement: 15, sidequest: false},
	UNG_028: {class: Class.Mage, requirement: 8, sidequest: false},
	UNG_067: {class: Class.Rogue, requirement: 4, sidequest: false},
	UNG_116: {class: Class.Druid, requirement: 5, sidequest: false},
	UNG_829: {class: Class.Warlock, requirement: 6, sidequest: false},
	UNG_920: {class: Class.Hunter, requirement: 7, sidequest: false},
	UNG_934: {class: Class.Warrior, requirement: 7, sidequest: false},
	UNG_940: {class: Class.Priest, requirement: 7, sidequest: false},
	UNG_942: {class: Class.Shaman, requirement: 10, sidequest: false},
	UNG_954: {class: Class.Paladin, requirement: 6, sidequest: false},

	DRG_008: {class: Class.Paladin, requirement: 5, sidequest: true},
	DRG_051: {class: Class.Druid, requirement: 10, sidequest: true},
	DRG_251: {class: Class.Hunter, requirement: 3, sidequest: true},
	DRG_255: {class: Class.Hunter, requirement: 3, sidequest: true},
	DRG_258: {class: Class.Paladin, requirement: 1, sidequest: true},
	DRG_317: {class: Class.Druid, requirement: 2, sidequest: true},
	DRG_323: {class: Class.Mage, requirement: 8, sidequest: true},
	DRG_324: {class: Class.Mage, requirement: 2, sidequest: true},
	DRGA_01q: {class: Class.Mage, requirement: 15, sidequest: true}
};

export const questMap = new Map(Object.entries(quests));
