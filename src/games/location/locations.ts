// Catálogo común de lugares de «¿Dónde queda?», usado por las dos modalidades.
// Para agregar las fotografías reales: copiarlas en public/images/locations/ y completar el campo
// "image" de cada lugar en src/data/locations.json (p. ej. "/images/locations/plaza-godoy-cruz.jpg").
// Los componentes no necesitan cambios.
import rawPlaces from '../../data/locations.json'
import { parsePlaces } from './locationLogic.ts'

const { places, rejected } = parsePlaces(rawPlaces)

if (rejected > 0) {
  console.warn(`¿Dónde queda?: se descartaron ${rejected} lugares inválidos o con id repetido en locations.json`)
}

// Las rutas del JSON son relativas a public/; se respeta la base de Vite por si la app no se sirve en la raíz.
export const PLACES = places.map((place) => ({
  ...place,
  image: place.image === null ? null : `${import.meta.env.BASE_URL}${place.image.replace(/^\//, '')}`,
}))
