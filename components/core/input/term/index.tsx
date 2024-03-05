import React from 'react'
import { DataMetaNode, InternalDataMetaNode, MetaNode } from '@/spec/metanode'
import { z } from 'zod'
import { Gene, Protein, Glycan, Variant, RegulatoryElement, Drug, Primative, Metabolite, Pathway, Phenotype, Tissue, Disease } from '@/components/core/primitives'

import dynamic from 'next/dynamic'
import { input_icon } from '@/icons'

const Suggest2 = dynamic(() => import('@blueprintjs/select').then(({ Suggest2 }) => Suggest2))
const InputGroup = dynamic(() => import('@blueprintjs/core').then(({ InputGroup }) => InputGroup))
const Button = dynamic(() => import('@blueprintjs/core').then(({ Button }) => Button))
const MenuItem = dynamic(() => import('@blueprintjs/core').then(({ MenuItem }) => MenuItem))

const Term_T = (T: Primative) => MetaNode(`Term[${T.name}]`)
  .meta({
    label: T.label,
    description: `${T.label} Term`,
    color: T.color,
    icon: T.icon,
    ...(T.extra?.term?.meta || {}),
  })
  .codec(z.string())
  .view(term => {
    return <div className="prose">{T.label}: {term}</div>
  })
  .build()

export const DiseaseTerm = Term_T(Disease)
export const DrugTerm = Term_T(Drug)
export const GeneTerm = Term_T(Gene)
export const ProteinTerm = Term_T(Protein)
export const GlycanTerm = Term_T(Glycan)
export const VariantTerm = Term_T(Variant)
export const RegulatoryElementTerm = Term_T(RegulatoryElement)
export const MetaboliteTerm = Term_T(Metabolite)
export const PathwayTerm = Term_T(Pathway)
export const PhenotypeTerm = Term_T(Phenotype)
export const TissueTerm = Term_T(Tissue)

const itemRenderer = (item: unknown, { modifiers: { active, disabled }, handleClick }: { modifiers: { active: boolean, disabled: boolean }, handleClick: React.MouseEventHandler }) => (
  <MenuItem
    key={item+''}
    text={item+''}
    onClick={handleClick}
    active={active}
    disabled={disabled}
  />
)
const createNewItemRenderer = (item: string, active: boolean, handleClick: React.MouseEventHandler<HTMLElement>) => (
  <MenuItem
    key={item}
    text={item}
    onClick={handleClick}
    active={active}
  />
)
const createNewItemFromQuery = (item: unknown) => item+''
const inputValueRenderer = (item: unknown) => item+''

const Input_Term_T = (T: Primative, Term_T: DataMetaNode<InternalDataMetaNode & { data: string }>) => MetaNode(`Input[${T.name}]`)
  .meta({
    label: `${T.label} Input`,
    description: `Start with a ${T.label}`,
    icon: [input_icon],
    tags: {
      Type: {
        [T.label]: 1,
      },
      Cardinality: {
        Term: 1,
      },
    },
    tex: {
      ...(T.extra?.term?.meta?.tex || {}),
      introduction: `${T.label} information is available from a large number of resources.`,
    },
    ...(T.extra?.term?.meta || {}),
  })
  .inputs()
  .output(Term_T)
  .prompt(props => {
    const [item, setItem] = React.useState('')
    const { items, error } = T.extra?.term?.autocomplete !== undefined ? T.extra.term.autocomplete(item) : { items: [], error: undefined }
    if (error) console.warn(error)
    React.useEffect(() => { setItem(props.output || '') }, [props.output])
    return (
      <div>
        {T.extra?.term?.autocomplete ?
          <Suggest2
            fill
            closeOnSelect
            query={item}
            selectedItem={item}
            createNewItemFromQuery={createNewItemFromQuery}
            onItemSelect={item => {
              setItem(item as string)
            }}
            inputValueRenderer={inputValueRenderer}
            itemRenderer={itemRenderer}
            createNewItemRenderer={createNewItemRenderer}
            createNewItemPosition="first"
            noResults={
              item ? <MenuItem
                key="No results"
                text="No results"
                disabled
                roleStructure="listoption"
              /> : null
            }
            items={items}
            inputProps={{ leftIcon: 'search', placeholder: `Search ${T.label}...` }}
            popoverProps={{ minimal: true }}
            onQueryChange={q => setItem(q)}
          />
        : <InputGroup
            fill
            value={item}
            onChange={evt => {setItem(evt.currentTarget.value)}}
            leftIcon="search"
            placeholder={`Search ${T.label}...`}
          />}
        {T.extra?.term?.meta?.example !== undefined ?
          <Button
            large
            text="Example"
            rightIcon="bring-data"
            onClick={evt => {
              if (T.extra?.term?.meta?.example !== undefined) {
                setItem(T.extra.term.meta.example)
              }
            }}
          />
          : null}
          <Button
            large
            type="submit"
            text="Submit"
            rightIcon="send-to-graph"
            disabled={!item}
            onClick={evt => props.submit(item)}
          />
      </div>
    )
  })
  .story(props =>
    props.output ? `The workflow starts with selecting ${props.output} as the search term.`
    : `The workflow starts with selecting a search term.`
  )
  .build()

export const InputDiseaseTerm = Input_Term_T(Disease, DiseaseTerm)
export const InputDrugTerm = Input_Term_T(Drug, DrugTerm)
export const InputGeneTerm = Input_Term_T(Gene, GeneTerm)
export const InputProteinTerm = Input_Term_T(Protein, ProteinTerm)
export const InputGlycanTerm = Input_Term_T(Glycan, GlycanTerm)
export const InputVariantTerm = Input_Term_T(Variant, VariantTerm)
export const InputRegulatoryElementTerm = Input_Term_T(RegulatoryElement, RegulatoryElementTerm)
export const InputMetaboliteTerm = Input_Term_T(Metabolite, MetaboliteTerm)
export const InputPathwayTerm = Input_Term_T(Pathway, PathwayTerm)
export const InputPhenotypeTerm = Input_Term_T(Phenotype, PhenotypeTerm)
export const InputTissueTerm = Input_Term_T(Tissue, TissueTerm)
