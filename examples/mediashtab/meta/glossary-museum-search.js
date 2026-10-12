import {terms} from './glossary-data.js';
import {normalize} from './glossary-engine.js';
const exact=new Map(terms.flatMap(t=>t.aliases.map(a=>[normalize(a),t.id])));
export function termMatch(object,query){const id=exact.get(normalize(query));return id&&object?object.terms.includes(id):null;}
