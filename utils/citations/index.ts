import * as dict from '@/utils/dict'
import doiMappings from './citations'

export function convertDOI(text: string) {
  const m = /^doi:(.+)$/.exec(text)
  if (m !== null && m[1] in doiMappings) {
    return `${doiMappings[m[1] as keyof typeof doiMappings]} ${text}`
  } else if (m !== null) {
    console.warn(`${m[1]} not registered, call 'npm run codegen:cite -- ${m[1]}'`)
  }
  return text
}

/**
 * This lets you add citations inline and pulls them out and puts them at the end.
 *
 * Usage:
 * ```
 * Using some thing [\\ref{Some Citation},\\ref{Some Other Citation}]... And also [\\ref{Some Citation}].
 * ```
 * Output:
 * ```
 * Using some thing [1,2]... And also [1].
 *
 * 1. Some Citation
 * 2. Some Other Citation
 * ```
 */
export default function extractCitations(text: string) {
  let i = 0
  let updatedText = ''
  const expr = /\\ref\{(.+?)\}/g
  let citationNum = 1
  const citations: Record<string, string> = {}
  let m
  while ((m = expr.exec(text)) !== null) {
    const currentCitation = m[1]
    if (!(currentCitation in citations)) {
      const currentCitationNum = `${citationNum++}`
      citations[currentCitation] = currentCitationNum
    }
    updatedText += `${text.substring(i, m.index)}${citations[currentCitation]}`
    i = m.index + m[0].length
  }
  updatedText += text.substring(i)
  if (!dict.isEmpty(citations)) {
    updatedText += '\n\n' + dict.items(citations)
      .map(({ key: currentCitation, value: currentCitationNum }) => `${currentCitationNum}. ${convertDOI(currentCitation)}`)
      .join('\n')
  }
  return updatedText
}
