// Fuente de preguntas de la ruleta. Para cambiar contenido alcanza con editar src/data/roulette.json
// (las imágenes van en public/images/roulette/); los componentes no necesitan cambios.
import rawQuestions from '../../data/roulette.json'
import { parseQuestions } from './rouletteLogic.ts'

const { questions, rejected } = parseQuestions(rawQuestions)

if (rejected > 0) {
  console.warn(`Ruleta: se descartaron ${rejected} preguntas inválidas o con id repetido en roulette.json`)
}

// Las rutas del JSON son relativas a public/; se respeta la base de Vite por si la app no se sirve en la raíz.
export const ROULETTE_QUESTIONS = questions.map((question) => ({
  ...question,
  image: question.image === null ? null : `${import.meta.env.BASE_URL}${question.image.replace(/^\//, '')}`,
}))
