// Fuente de preguntas de la ruleta. Para cargar contenido real alcanza con reemplazar
// src/data/roulette.json respetando su formato; los componentes no necesitan cambios.
import rawQuestions from '../../data/roulette.json'
import { parseQuestions } from './rouletteLogic.ts'

const { questions, rejected } = parseQuestions(rawQuestions)

if (rejected > 0) {
  console.warn(`Ruleta: se descartaron ${rejected} preguntas inválidas o con id repetido en roulette.json`)
}

export const ROULETTE_QUESTIONS = questions
