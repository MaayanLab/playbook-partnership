/**
 * 1. Construct an arbitrary path through the metagraph, build a story from that path.
 * 2. Prompt GPT to create a questions for that story.
 * 3. Embed the questions, train a multi label classifier from the embedding to the actual metanodes in the metagraph.
 * 4. Given a user question, embed the question, apply the classifier, use the top results as context.
 */
import KRG from '@/core/KRG'
import * as components from '@/components'
import * as dict from '@/utils/dict'
import * as array from '@/utils/array'
import { MetaNode, ProcessMetaNode } from '@/spec/metanode'

const krg = new KRG()
dict.values(components as any).flatMap(component => array.ensureArray(component))
  .filter((component): component is MetaNode => typeof component === 'object' && 'spec' in component)
  .forEach(metanode => krg.add(metanode))

function randomChoice<T>(L: T[]): T {
  return L[Math.floor(Math.random() * L.length)]
}

for (let i = 0; i < 25000; i++) {
  const path = []
  const stories = []
  const stack = []
  let head: ProcessMetaNode | undefined = undefined
  while (true) {
    head = randomChoice(krg.getNextProcess(head ? head.output.spec : undefined))
    if (!head) break
    path.push(head)
    stories.push(head.story({}))
    const nextStep = randomChoice(['continue', 'continue', 'continue', 'continue', 'back', 'back', 'restart', 'stop', 'stop'])
    if (nextStep === 'stop') break
    if (nextStep === 'restart') head = undefined
    if (nextStep === 'back') head = path[path.length-1]
  }
  if (path.length === 1) continue
  const story = stories.filter(story => !!story).join(' ')
  console.log([story, '', ...path.map(({ spec }) => spec)].join('\t'))
}