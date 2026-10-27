// Lista de colegios del sorteo. Para cambiarla alcanza con editar src/data/schools.json.
import rawSchools from '../data/schools.json'
import { parseSchools } from './raffleLogic.ts'

const { schools, rejected } = parseSchools(rawSchools)

if (rejected > 0) {
  console.warn(`Sorteo: se descartaron ${rejected} colegios inválidos o con código repetido en schools.json`)
}

export const SCHOOLS = schools
