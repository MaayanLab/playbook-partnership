import type KRG from "@/core/KRG"
import type { FPL } from "@/core/FPPRG"
import * as dict from '@/utils/dict'
import * as array from '@/utils/array'
import { decode_complete_process_inputs, decode_complete_process_output } from "@/core/engine"
import { convertDOI } from '@/utils/citations'

type Metadata = {
  title?: string,
  description?: string,
}

type Author = {
  name: string,
  affiliation?: string,
  email?: string,
  orcid?: string,
}

function screenshotOf(node: React.ReactNode) {
  return 'TODO'
}

export default async function FPL2tex(props: { krg: KRG, fpl: FPL, metadata?: Metadata, author?: Author | null }): Promise<string> {
  const fullFPL = props.fpl.resolve()
  const processLookup = dict.init(
    await Promise.all(fullFPL.map(async (step, index) => {
      const metanode = props.krg.getProcessNode(step.process.type)
      let story: string | undefined
      let inputs: Record<string, unknown> | undefined
      let output: unknown | undefined
      if (!props.metadata?.description) {
        try { inputs = await decode_complete_process_inputs(props.krg, step.process) } catch (e) {}
        try { output = await decode_complete_process_output(props.krg, step.process) } catch (e) {}
        story = metanode.story ? metanode.story({ inputs, output }) : undefined
      }
      return {
        key: step.process.id,
        value: {
          index,
          node: step.process,
          metanode,
          story,
          inputs,
          output,
        },
      }
    }))
  )
  const story = props.metadata?.description || (
    dict.values(processLookup)
      .filter(({ story }) => !!story)
      .map(({ story }) => story)
      .join(' ')
  )

  let i = 0
  let updatedStory = ''
  const expr = /\\ref\{(.+?)\}/g
  const citations: Record<string, string> = {}
  let m
  while ((m = expr.exec(story)) !== null) {
    const currentCitation = m[1]
    if (!(currentCitation in citations)) {
      citations[currentCitation] = currentCitation
    }
    updatedStory += `${story.substring(i, m.index)}\\cite{${citations[currentCitation]}}`
    i = m.index + m[0].length
  }
  updatedStory += story.substring(i)
  return `
\\documentclass{article}
\\begin{document}

${props.metadata?.title ? `\\title{${props.metadata.title}}` : ''}

${props.author ? `\\author${props.author.affiliation ? `[1]` : ''}{${props.author.name}}` : ''}${props.author?.email ? `\\email{${props.author.email}}` : ''}
${props.author?.affiliation ? `\\affil*[1]{${props.author.affiliation}}` : ''}

\\abstract{${updatedStory}}
\\keywords{${[
  'Playbook Workflow Builder',
  ...array.unique(
    dict.values(processLookup)
      .flatMap(({ metanode }) =>
        metanode.meta.tags ? dict.items(metanode.meta.tags).flatMap(({ key: _, value }) => dict.keys(value)).join(' ') : []
      )
  )
].join(', ')}}

\\maketitle

\\section{Introduction}\\label{sec1}
${
  array.unique(dict.values(processLookup)
    .filter(({ metanode }) => !!metanode.meta.tex?.introduction)
    .map(({ metanode }) => metanode.meta.tex?.introduction))
    .join('\n')
}

\\section{Methods}\\label{sec2}
${
  array.unique(dict.values(processLookup)
    .filter(({ metanode }) => !!metanode.meta.tex?.methods)
    .map(({ metanode }) => metanode.meta.tex?.methods))
    .join('\n')
}

\\section{Results}\\label{sec3}

\\section{Conclusion}\\label{sec4}

\\section{Figures}\\label{sec5}
${
  dict.values(processLookup)
    .map(({ metanode, inputs, output }, i) => `
\\begin{figure}[h]
\\centering
\\includegraphics[width=0.9\\textwidth]{${screenshotOf(metanode.output.view(output))}}
\\caption{${metanode.output.meta.tex?.caption}}\\label{fig${i+1}}
\\end{figure}
`).join('')
}

\\begin{thebibliography}
${dict.keys(citations).map(key => `
\\bibitem{${key}}
${convertDOI(key)}
`).join('')}
\\end{thebibliography}

\\end{document}
`
}
