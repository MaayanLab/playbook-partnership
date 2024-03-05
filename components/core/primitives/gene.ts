import { Primative } from './spec'
import useSWRImmutable from 'swr/immutable'
import levenSort from '@/utils/leven-sort'
import fetcher from '@/utils/next-rest-fetcher'
import { gene_icon } from '@/icons'

function useHarmonizomeGeneSuggestions(search: string) {
  const { data, error } = useSWRImmutable<string[]>(() => search.length >= 2 ? `https://maayanlab.cloud/Harmonizome/api/1.0/suggest?t=gene&q=${encodeURIComponent(search)}` : null, fetcher)
  const items = data ? levenSort(data, search).slice(0, 10) as string[] : []
  return { items, error }
}

export const Gene = {
  name: 'Gene',
  label: 'Gene',
  icon: [gene_icon],
  color: '#B3CFFF',
  extra: {
    term: {
      meta: {
        example: 'ACE2',
        pagerank: 7,
        tex: {
          // introduction: `Gene information is available from a large number of resources.`,
          // methods: `The genes are mapped to HUGO gene symbols.`,
        },
      },
      autocomplete: useHarmonizomeGeneSuggestions,
    },
    set: {
      meta: {
        example: { description: 'Example gene set', set: ['UTP14A', 'S100A6', 'SCAND1', 'RRP12', 'CIAPIN1', 'ADH5', 'MTERF3', 'SPR', 'CHMP4A', 'UFM1', 'VAT1', 'HACD3', 'RFC5', 'COTL1', 'NPRL2', 'TRIB3', 'PCCB', 'TLE1', 'CD58', 'BACE2', 'KDM3A', 'TARBP1', 'RNH1', 'CHAC1', 'MBNL2', 'VDAC1', 'TES', 'OXA1L', 'NOP56', 'HAT1', 'CPNE3', 'DNMT1', 'ARHGAP1', 'VPS28', 'EIF2S2', 'BAG3', 'CDCA4', 'NPDC1', 'RPS6KA1', 'FIS1', 'SYPL1', 'SARS', 'CDC45', 'CANT1', 'HERPUD1', 'SORBS3', 'MRPS2', 'TOR1A', 'TNIP1', 'SLC25A46', 'MAL', 'EPCAM', 'HDAC6', 'CAPN1', 'TNRC6B', 'PKD1', 'RRS1', 'HP', 'ANO10', 'CEP170B', 'IDE', 'DENND2D', 'CAMK2B', 'ZNF358', 'RPP38', 'MRPL19', 'NUCB2', 'GNAI1', 'LSR', 'ADGRE2', 'PKMYT1', 'CDK5R1', 'ABL1', 'PILRB', 'AXIN1', 'FBXL8', 'MCF2L', 'DBNDD1', 'IGHMBP2', 'WIPF2', 'WFS1', 'OGFOD2', 'MAPK1IP1L', 'COL11A1', 'REG3A', 'SERPINA1', 'MYCBP2', 'PIGK', 'TCAP', 'CRADD', 'ELK1', 'DNAJB2', 'ZBTB16', 'DAZAP1', 'MAPKAPK2', 'EDRF1', 'CRIP1', 'UCP3', 'AGR2', 'P4HA2',] },
        pagerank: 6,
      },
    },
  },
} as Primative
