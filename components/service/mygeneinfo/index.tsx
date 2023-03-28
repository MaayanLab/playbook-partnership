import React from 'react'
import { MetaNode } from '@/spec/metanode'
import { GeneTerm } from '@/components/core/input/term'
import { RegulatoryElementSet } from '@/components/core/input/set'
import { z } from 'zod'
import { gene_icon, linkeddatahub_icon, mygeneinfo_icon } from '@/icons'

export const MyGeneInfoHitC = z.object({
  hits: z.array(
    z.object({
      _id: z.string(),
      _score: z.number(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      taxid: z.number().optional(),
      entrezgene: z.string().optional(),
    }),
  ),
})
export type MyGeneInfoHit = z.infer<typeof MyGeneInfoHitC>

export const MyGeneInfoC = z.object({
  _id: z.string(),
  symbol: z.string(),
  entrezgene: z.string().optional(),
  name: z.string().optional(),
  taxid: z.number().optional(),
  ensembl: z.object({
    gene: z.string(),
  }).optional()
})
export type MyGeneInfo = z.infer<typeof MyGeneInfoC>

export const MyGeneInfoByTermC = z.object({
  data: z.object({
    ld: z.object({
      RegulatoryElement: z.array(z.object({ 
            entId: z.string(),
            ldhId: z.string()
          })
        )
    })
  })
})
export type MyGeneInfoByTerm = z.infer<typeof MyGeneInfoByTermC>

async function mygeneinfo_query(geneId: string): Promise<{total: number, hits: Array<MyGeneInfoHit>}> {
  const res = await fetch(`https://mygene.info/v3/query?q=${encodeURIComponent(geneId)}`)
  return await res.json()
}

async function mygeneinfo(geneId: string): Promise<MyGeneInfo> {
  const res = await fetch(`https://mygene.info/v3/gene/${encodeURIComponent(geneId)}`)
  return await res.json()
}

async function myGeneInfoByGeneTerm(geneTerm: string): Promise<MyGeneInfoByTerm> {
  const res = await fetch(`https://genboree.org/cfde-gene-dev/Gene/id/${encodeURIComponent(geneTerm)}`)
  return await res.json()
}

export const GeneInfo = MetaNode('GeneInfo')
  .meta({
    label: 'Gene Information',
    description: 'A Gene resolved with MyGeneInfo',
    icon: [gene_icon],
  })
  .codec(MyGeneInfoC)
  .view(geneinfo => (
    <div>
      <a href={`https://www.ncbi.nlm.nih.gov/gene/${geneinfo.entrezgene}`}>{geneinfo.symbol}</a> {geneinfo.name}
    </div>
  ))
  .build()

export const GeneInfoFromGeneTerm = MetaNode('GeneInfoFromGeneTerm')
  .meta({
    label: 'Resolve Gene Info from Term',
    description: 'Resolve gene info from gene term with MyGeneInfo',
    icon: [mygeneinfo_icon],
  })
  .inputs({ gene: GeneTerm })
  .output(GeneInfo)
  .resolve(async (props) => {
    return await getGeneData(props.inputs.gene);
  })
  .story(props =>
    `More information about the gene was then obtained with the MyGene.info API [\\ref{doi:10.1186/s13059-016-0953-9},\\ref{doi:10.1093/nar/gks1114}].`
  )
  .build()

  export async function getGeneData(geneSymbol: string){
    const results = MyGeneInfoHitC.parse(await mygeneinfo_query(geneSymbol))
    const hits = results.hits.filter((hit): hit is MyGeneInfoHit['hits'][0] & { symbol: string } => !!hit.symbol)
    const exactMatch = hits.filter(hit => hit.symbol.toUpperCase() == geneSymbol.toUpperCase())[0]
    const _id: string | undefined = exactMatch !== undefined ? exactMatch._id : hits[0]._id
    if (_id === undefined) throw new Error(`Could not identify a gene for the symbol ${geneSymbol} in mygene.info`)
    return await mygeneinfo(_id)
  }


  export const GetRegulatoryElementsForGeneInfo = MetaNode('GetRegulatoryElementsForGeneInfo')
  .meta({
    label: 'Resolve Reg. Elements from Gene Info',
    description: 'GetRegulatoryElementsForGeneInfo',
    icon: [linkeddatahub_icon],
  })
  .inputs({ geneInfo: GeneInfo  })
  .output(RegulatoryElementSet)
  .resolve(async (props) => {
    const response =  await myGeneInfoByGeneTerm(props.inputs.geneInfo.symbol);
    if(response.data == null || response.data.ld == null){
      return { set: [] };
    }
    return { set: response.data.ld.RegulatoryElement.map(({ entId }) => entId ) };
  })
  .story(props =>
    `Regulatory elements were obtained from the Linked Data Hub [\\ref{Linked Data Hub, https://genboree.org/cfde-gene-dev/}].`
  )
  .build()
