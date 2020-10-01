import {keyBy} from 'lodash';

type CardType = {dbfId: number; id: string; name: string};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cardsJson: CardType[] = require('../../data/cards.json');
const cardData = keyBy(cardsJson, c => c.id) as {[key: string]: CardType};

export default cardData;
