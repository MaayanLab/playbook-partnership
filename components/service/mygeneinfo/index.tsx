import { MetaNode } from '@/spec/metanode'
import { FileURL } from '@/components/core/file'
import { GeneTerm } from '@/components/core/input/term'
import { GeneSet } from '@/components/core/input/set'
import { GraphPlot } from '@/components/viz/graph'
import { z } from 'zod'
import { gene_icon, linkeddatahub_icon, mygeneinfo_icon, file_transfer_icon, datafile_icon } from '@/icons'
import { fileAsStream } from  '@/components/core/file/api/download'
import { Table, Cell, Column} from '@/app/components/Table'

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

const MyRegulatoryElement = z.object({
  entId: z.string(),
  ldhId: z.string(),
  entContent: z.object({
    coordinates: z.object({    
      chromosome: z.string(),
      end: z.any(),
      start: z.any()
    })
  })
})

export const MyGeneInfoByTermC = z.object({
  data: z.object({
    ld: z.object({
      RegulatoryElement: z.array(
          MyRegulatoryElement
      )
    })
  })
})
export type MyGeneInfoByTerm = z.infer<typeof MyGeneInfoByTermC>

const MyRegulatoryElementSetInfoC = z.array(
  MyRegulatoryElement
)
export type MyRegulatoryElementSetInfo = z.infer<typeof MyRegulatoryElementSetInfoC>

async function mygeneinfo_query(geneId: string): Promise<{total: number, hits: Array<MyGeneInfoHit>}> {
  const res = await fetch(`https://mygene.info/v3/query?q=${encodeURIComponent(geneId)}`)
  return await res.json()
}

async function mygeneinfo(geneId: string): Promise<MyGeneInfo> {
  const res = await fetch(`https://mygene.info/v3/gene/${encodeURIComponent(geneId)}`)
  return await res.json()
}

async function myGeneInfoFromLinkDataHub(geneTerm: string): Promise<MyGeneInfoByTerm> {
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

export const RegulatoryElementSetInfo = MetaNode('RegulatoryElementSetInfo')
  .meta({
    label: 'RegulatoryElementSetInfo',
    description: '',
    icon: [datafile_icon]
  })
  .codec(MyRegulatoryElementSetInfoC)
  .view(regulatoryElementSet => {
    return( 
      <Table
        height={500}
        cellRendererDependencies={[regulatoryElementSet]}
        numRows={regulatoryElementSet.length}
        enableGhostCells
        enableFocusedCell>
        <Column
          name="Entity id"
          cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entId}</Cell>}
        />
        <Column
          name="Chromosome"
          cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.chromosome}</Cell>}
        />
        <Column
          name="Start Pos."
          cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.start}</Cell>}
        />
        <Column
          name="End Pos."
          cellRenderer={row => <Cell key={row+''}>{regulatoryElementSet[row].entContent.coordinates.end}</Cell>}
        />
      </Table>
    )
}).build()

export const RegulatoryElementsForGeneInfo = MetaNode('RegulatoryElementsForGeneInfo')
  .meta({
    label: 'Resolve Regulatory Elements from LDH',
    description: 'Resolve regulatory elements from gene with Linked Data Hub',
    icon: [linkeddatahub_icon],
    pagerank: 1,
  })
  .inputs({ geneInfo: GeneInfo  })
  .output(RegulatoryElementSetInfo)
  .resolve(async (props) => {
    const response =  await myGeneInfoFromLinkDataHub(props.inputs.geneInfo.symbol);
    return response.data.ld.RegulatoryElement;
  })
  .story(props =>
    `Regulatory elements were obtained from the Linked Data Hub [\\ref{Linked Data Hub, https://genboree.org/cfde-gene-dev/}].`
  )
  .build()

export const GetRegulatoryElementsForGeneInfoFromGene = MetaNode('GetRegulatoryElementsForGeneInfoFromGene')
  .meta(RegulatoryElementsForGeneInfo.meta)
  .inputs({ gene: GeneTerm })
  .output(RegulatoryElementsForGeneInfo.output)
  .resolve(async (props) => {
    const geneInfo = await GeneInfoFromGeneTerm.resolve(props)
    return await RegulatoryElementsForGeneInfo.resolve({ inputs: { geneInfo } })
  })
  .story(props =>
    `Regulatory elements were obtained from the Linked Data Hub [\\ref{Linked Data Hub, https://genboree.org/cfde-gene-dev/}].`
  )
  .build()

const CTDResponseInfoC = z.object({
    "highlyConnectedGenes": z.any(),
    "guiltyByAssociationGenes": z.any(),
    "jsonGraph": z.object({
      "nodes": z.array(z.object({
        "id": z.string().optional(),
        "name": z.string().optional(),
        "type": z.string()
      })),
      "edges": z.any().optional(),
      "interactions": z.array(z.object({
        "source": z.string(),
        "target": z.string()
      })).optional(),
    })
});
export type CTDResponseInfo = z.infer<typeof CTDResponseInfoC>

export async function getCTDFileResponse(formData: any): Promise<CTDResponseInfo> {
  const res = await fetch(`http://5.161.50.225:8018/rest/playbook_ctd/ctd/file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    body: formData
  })
  return await res.json()
}

export async function getCTDGenSetResponse(strValue: string): Promise<CTDResponseInfo> {
  const res = await fetch(`http://5.161.50.225:8018/rest/playbook_ctd/ctd/geneList`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: strValue
  })
  return await res.json()
}

export const CTDResponseInfo = MetaNode('CTDResponseInfo')
  .meta({
    label: 'CTDResponseInfo',
    description: '',
    icon: [datafile_icon]
  })
  .codec(CTDResponseInfoC)
  .view(props => {
    return(
      <div>
        <p>Highly Connected Genes num: {props.highlyConnectedGenes.length}</p>
        <p>Guilty By Association Genes num: {props.guiltyByAssociationGenes.length}</p>
        <p>Json Graph Nodes num: {props.jsonGraph.nodes.length}</p>
      </div>
    )
  }).build()

export const GeneSet_CTD_Kegg = MetaNode('GeneSet_CTD_Kegg')
  .meta({
    label: `GeneSet_CTD_Kegg`,
    description: "Get a CTD response for a set of genes for graph type kegg."
  })
  .inputs({ geneset: GeneSet })
  .output(CTDResponseInfo)
  .resolve(async (props) => {
    let requestBody = {
      "graphType": "kegg",
      "geneList": props.inputs.geneset.set
    }
    return await getCTDGenSetResponse(JSON.stringify(requestBody));
  }).story(props =>
    `Get a CTD response for a set of genes for graph type kegg.`
  ).build()


export const GeneSet_CTD_String = MetaNode('GeneSet_CTD_String')
  .meta({
    label: `GeneSet_CTD_String`,
    description: "Get a CTD response for a set of genes for graph type string."
  })
  .inputs({ geneset: GeneSet })
  .output(CTDResponseInfo)
  .resolve(async (props) => {
    let requestBody = {
      "graphType": "string",
      "geneList": props.inputs.geneset.set
    }
    return await getCTDGenSetResponse(JSON.stringify(requestBody));
  }).story(props =>
    `Get a CTD response for a set of genes for graph type string.`
  ).build()


export const GenesFile_CTD_Kegg = MetaNode('GenesFile_CTD_Kegg')
  .meta({
    label: `GenesFile_CTD_Kegg`,
    description: "Ensure a file contains a gene set, values separated by a \\n character  and with the extension .csv",
    icon: [file_transfer_icon]
  })
  .inputs({ file: FileURL })
  .output(CTDResponseInfo)
  .resolve(async (props) => {
    const fileReader: any = await fileAsStream(props.inputs.file);

    const formData = new FormData();
    formData.append('csvGenesFile', fileReader, props.inputs.file.filename);
    formData.append('graphType', "kegg");
    return await getCTDFileResponse(formData);
  }).build()

export const GenesFile_CTD_String = MetaNode('GenesFile_CTD_String')
  .meta({
    label: `GenesFile_CTD_String`,
    description: "Ensure a file contains a gene set, values separated by a \\n character  and with the extension .csv",
    icon: [file_transfer_icon]
  })
  .inputs({ file: FileURL })
  .output(CTDResponseInfo)
  .resolve(async (props) => {
    const fileReader: any = await fileAsStream(props.inputs.file);

    const formData = new FormData();
    formData.append('csvGenesFile', fileReader, props.inputs.file.filename);
    formData.append('graphType', "string");
    return await getCTDFileResponse(formData);
  }).build()

export const Highly_Connected_Genes = MetaNode('Highly_Connected_Genes')
  .meta({
    label: `Highly_Connected_Genes`,
    description: "Get a list of Highly_Connected_Genes from the CTD response."
  })
  .inputs({ ctdResponseInfo: CTDResponseInfo })
  .output(GeneSet)
  .resolve(async (props) => {
    let geneSet = {
      description: 'Highly_Connected_Genes, CTD response',
      set:  props.inputs.ctdResponseInfo.highlyConnectedGenes
    };
    return geneSet;
  }).story(props =>
    `Get a list of Highly_Connected_Genes from the CTD response.`
  ).build()

export const Guilty_By_Association_Genes = MetaNode('Guilty_By_Association_Genes')
  .meta({
    label: `Guilty_By_Association_Genes`,
    description: "Get a list of Guilty_By_Association_Genes from the CTD response."
  })
  .inputs({ ctdResponseInfo: CTDResponseInfo })
  .output(GeneSet)
  .resolve(async (props) => {
    let geneSet = {
      description: 'Guilty_By_Association_Genes, CTD response',
      set:  props.inputs.ctdResponseInfo.guiltyByAssociationGenes
    };
    return geneSet;
  }).story(props =>
    `Get a list of Guilty_By_Association_Genes from the CTD response.`
  ).build()

//just for demo, this needs to be presented with a proper graph visualization
export const CTDGraph = MetaNode('CTDGraph')
  .meta({
    label: 'CTDGraph',
    description: '',
    icon: [datafile_icon]
  })
  .codec()
  .view(props => {
    return(
      <div>
          {JSON.stringify(props)}
      </div>
    )
  }).build()

export const CTD_Graph_Nodes = MetaNode('CTD_Graph_Nodes')
  .meta({
    label: `CTD_Graph_Nodes`,
    description: "CTD_Graph_Nodes."
  })
  .inputs({ ctdResponseInfo: CTDResponseInfo })
  .output(GraphPlot)
  .resolve(async (props) => {
    let jsonGraphObj = props.inputs.ctdResponseInfo.jsonGraph;

    jsonGraphObj.edges = jsonGraphObj.interactions;
    delete jsonGraphObj.interactions;

    for(let n in jsonGraphObj.nodes){
      let node = jsonGraphObj.nodes[n];
      node.id = node.name;
      delete node.name;
    }
    
    return jsonGraphObj;
  }).story(props =>
    `CTD_Graph_Nodes.`
  ).build()

