import { MetaNode } from "@/spec/metanode";
import { EnrichrEnrichmentAnalysis } from "../enrichr";
import { enrichr_icon, view_in_graph_icon } from "@/icons";
import { z } from 'zod'

const enrichr_kg_url = 'https://maayanlab.cloud/enrichr-kg'

export const EnrichrKG = MetaNode('EnrichrKG')
  .meta({
    label: 'Enrichr Knowledge Graph',
    description: 'A knowledge graph of the gene set enrichment results',
    icon: [enrichr_icon, view_in_graph_icon],
  })
  .codec(z.union([
    z.object({
      empty: z.literal(true),
    }),
    z.object({
      shortId: z.string(),
      userListId: z.number(),
    })
  ]))
  .view(userlist => {
    const searchParams = new URLSearchParams()
    if (!('empty' in userlist)) {
      searchParams.append('userListId', userlist.userListId.toString())
      searchParams.append('search', 'true')
      searchParams.append('fullscreen', 'true')
      searchParams.append('libraries', JSON.stringify([
        {library: 'GO_Biological_Process_2021',term_limit: 5},
        {library: 'MGI_Mammalian_Phenotype_Level_4_2021',term_limit: 5},
        {library: 'KEGG_2021_Human',term_limit: 5},
      ]))
    }
    return (
      <div className="flex-grow flex flex-row m-0" style={{ minHeight: 800 }}>
        {'empty' in userlist ? 
          <div className="prose max-w-none">Enrichment Analysis Cannot be Performed on Empty Set</div>
          : <iframe
            className="flex-grow border-0"
            src={`${enrichr_kg_url}?${searchParams.toString()}`}
          />}
      </div>
    )
  })
  .build()

export const EnrichrUserListToEnrichrKG = MetaNode('EnrichrUserListToEnrichrKG')
  .meta({
    label: 'Visualize Enrichr Knowledge Graph',
    description: 'View gene set results as a knowledge graph',    
  })
  .inputs({ enrichr: EnrichrEnrichmentAnalysis })
  .output(EnrichrKG)
  .resolve(async (props) => props.inputs.enrichr)
  .story(props => ``)
  .build()
