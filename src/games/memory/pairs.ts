// Fuente de parejas de Memoria. Para usar contenido real: poner las imágenes en public/images/memory/
// y actualizar src/data/memory.json con el mismo formato; los componentes no necesitan cambios.
import rawPairs from '../../data/memory.json'
import { parsePairs, PAIRS_PER_GAME } from './memoryLogic.ts'

const { pairs, rejected } = parsePairs(rawPairs)

if (rejected > 0) {
  console.warn(`Memoria: se descartaron ${rejected} parejas inválidas o con id repetido en memory.json`)
}
if (pairs.length < PAIRS_PER_GAME) {
  console.warn(`Memoria: hay ${pairs.length} parejas válidas; el tablero necesita ${PAIRS_PER_GAME}`)
}

// Las rutas del JSON son relativas a public/; se respeta la base de Vite por si la app no se sirve en la raíz.
export const MEMORY_PAIRS = pairs.map((pair) => ({
  ...pair,
  image: `${import.meta.env.BASE_URL}${pair.image.replace(/^\//, '')}`,
}))
