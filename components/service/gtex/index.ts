import { MetaNode } from '@/spec/metanode'
import { GeneInfo, GeneInfoFromGeneTerm } from '@/components/service/mygeneinfo'
import { ScoredTissues } from '@/components/core/input/scored'
import { gtex_icon } from '@/icons'
import python from '@/utils/python'
import { GeneTerm } from '@/components/core/input/term'

export const GTExTissueExpression = MetaNode('GTExTissueExpression')
  .meta({
    label: 'Query GTEx Median Tissue Expression',
    description: 'Use GTEx API to obtain median tissue expression for the given gene',
    icon: [gtex_icon],
    pagerank: 1,
    tex: {
      introduction: 'The Genotype-Tissue Expression (GTEx) project is an ongoing effort to build a comprehensive public resource to study tissue-specific gene expression and regulation. Samples were collected from 54 non-diseased tissue sites across nearly 1000 individuals, primarily for molecular assays including WGS, WES, and RNA-Seq \\cite{doi:10.1038/ng.2653}. The GTEx Portal provides open access to data including gene expression, QTLs, and histology images.',
      methods: 'The GTEx Portal API was first used to convert the gene term into a versioned ENSEMBL gene id. The ENSEMBL gene id was then used to query GTEx v8 for median gene expression across the GTEx cohort.',
    },
  })
  .inputs({ gene_info: GeneInfo })
  .output(ScoredTissues)
  .resolve(async (props) => {
    return await python(
      'components.service.gtex.gtex_gene_expression',
      { kargs: [props.inputs.gene_info.ensembl?.gene || props.inputs.gene_info.symbol], kwargs: { datasetId: 'gtex_v8' } },
      message => props.notify({ type: 'info', message }),
    )
  })
  .story(props =>
    `Median expression of ${props.inputs ? props.inputs.gene_info.symbol : 'the gene'} was obtained from the GTEx Portal [\\ref{doi:10.1038/ng.2653}] using the portal's API.`
  )
  .build()

export const GTExTissueExpressionFromGene = MetaNode('GTExTissueExpressionFromGene')
  .meta(GTExTissueExpression.meta)
  .inputs({ gene: GeneTerm })
  .output(GTExTissueExpression.output)
  .resolve(async (props) => {
    const gene_info = await GeneInfoFromGeneTerm.resolve(props)
    return await GTExTissueExpression.resolve({ ...props, inputs: { gene_info } })
  })
  .story(props =>
    `Median expression of ${props.inputs ? props.inputs.gene : 'the gene'} was obtained from the GTEx Portal [\\ref{doi:10.1038/ng.2653}] using the portal's API.`
  )
  .build()
