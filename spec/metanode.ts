/**
 * The metanode specification is essentially a higher order typescript where semantic types are tied to:
 *  - codecs (for encoding & decoding the concrete data to/from strings)
 *  - views (for constructing a human-interactive rendering for inspecting the type)
 * Additionally, semantic functions can be defined parameterized by those same semantic types, tied to:
 *  - inputs (the semantically typed arguments)
 *  - output (the semantically typed return value)
 *  - resolve or prompt (given instances of properly typed arguments, produce an instance of the properly typed return value)
 *    - resolve can be performed without user interaction and is just a function
 *    - prompt is a rendered element responsible for translating human-interaction into the output
 */

import React from 'react'
import { z } from 'zod'
import codecFrom from '@/utils/zod-codec'
import type { Codec } from '@/spec/codec'
import type { MaybeArray, ExtractKey, Ensure } from '@/utils/types'
import type { Icon } from '@/icons'
import type { StaticImageData } from 'next/image'

function identity<T>(value: T): T {
  return value
}

/**
 * The broadest type parameter for an IdentifiableMetaNode
 */
export type InternalIdentifiableMetaNode = {
  spec: string
  meta: {
    // a human readable label
    label: string,
    // a human readable description
    description: string,
    // an icon representing the data type/action
    icon?: Icon,
    // a logo for the data source
    logo?: StaticImageData[],
    // a color to distinguish it
    color?: string,
    // an example value for a data metanode
    example?: any,
    // whether or not this should be findable in extend mode (i.e. deprecated)s
    hidden?: boolean,
    // an integer for metanode order tweaking
    pagerank?: number,
    // categorized tags for metanode filtering
    tags?: Record<string, Record<string, number>>,
    // a estimate for how long this usually takes in milliseconds
    durationEstimate?: number,
    // package.json
    version?: string,
    author?: string,
    license?: string,
    // tex feature
    tex?: {
      introduction?: string,
      methods?: string,
      caption?: string,
    },
  }
}

/**
 * The broadest type parameter for a DataMetaNode
 */
export type InternalDataMetaNode = InternalIdentifiableMetaNode & {
  data: unknown,
}

/**
 * The broadest type parameter for a ProcessMetaNode
 */
export type InternalProcessMetaNode = InternalIdentifiableMetaNode & {
  inputs: Record<string, DataMetaNode<InternalDataMetaNode>>,
  output: DataMetaNode<InternalDataMetaNode>,
}

/**
 * All metanodes should have a unique id and some metadata about it.
 *
 * Parameters:
 *  spec: A unique string for this type
 *  meta: key-value metadata to elaborate on the datatype including human readable label & description
 */
export type IdentifiableMetaNode<T = InternalIdentifiableMetaNode> = {
  kind: 'data' | 'process'
  spec: Ensure<ExtractKey<T, 'spec'>, InternalIdentifiableMetaNode['spec']>
  meta: Ensure<ExtractKey<T, 'meta'>, InternalIdentifiableMetaNode['meta']>
}

/**
 * A DataMetaNode represents a semantically annotated datatype.
 *  Though a "First Name" and "Last Name" are both strings, they are different things. In the same way
 *   a DataMetaNode represents something like a First Name, providing programatic *and* semantic typing guarantees.
 *
 * Parameters:
 *  spec: A unique string for this type
 *  meta: key-value metadata to elaborate on the datatype including human readable label & description
 *  codec: A Codec for encoding/decoding the programatic data type to/from a string
 *  view: A JSX rendering of the data type
 */
export type DataMetaNode<T = InternalDataMetaNode> = IdentifiableMetaNode<T> & {
  kind: 'data'
  codec: Codec<ExtractKey<T, 'data'>>
  view(value: ExtractKey<T, 'data'>): React.ReactElement
}

/**
 * Extract the typescript datatype from a DataMetaNode object
 */
export type DataMetaNodeData<T> =
  T extends Array<DataMetaNode<infer I>>
  ? Array<ExtractKey<I, 'data'>>
  : T extends DataMetaNode<infer I>
  ? ExtractKey<I, 'data'>
  : never

/**
 * A BaseProcessMetaNode represents a semantically annotated function. That takes some arguments
 *  which are semantically typed instances of a DataMetaNode and produces a single semantically typed instance of a DataMetaNode.
 */
export type BaseProcessMetaNode<T = InternalProcessMetaNode> = IdentifiableMetaNode<T> & {
  kind: 'process'
  inputs: {[K in keyof ExtractKey<T, 'inputs'>]: ExtractKey<T, 'inputs'>[K]}
  output: ExtractKey<T, 'output'>
}

export type StatusUpdate = {
  type: 'progress',
  percent: number,
} | {
  type: 'info',
  message: string,
} | {
  type: 'warning',
  message: string,
}

/**
 * A ResolveMetaNode is a ProcessMetaNode that operates without user input, a "pure" function.
 */
export type ResolveMetaNode<T = InternalProcessMetaNode> = BaseProcessMetaNode<T> & {
  resolve(props: {
    /* The inputs to this process */
    inputs: {[K in keyof ExtractKey<T, 'inputs'>]: DataMetaNodeData<ExtractKey<T, 'inputs'>[K]>},
    /* Use in long-running processes to keep the user updated */
    notify(status: StatusUpdate): void,
  }): Promise<DataMetaNodeData<ExtractKey<T, 'output'>>>
  story(props: {
    /* The inputs to this process */
    inputs?: {[K in keyof ExtractKey<T, 'inputs'>]: DataMetaNodeData<ExtractKey<T, 'inputs'>[K]>}
    /* The output of this process */
    output?: DataMetaNodeData<ExtractKey<T, 'output'>>,
  }): string
}

/**
 * A PromptMetaNode is a ProcessMetaNode that operates with user feedback, allowing users to
 *  inject information/decisions into the workflow.
 */
export type PromptMetaNode<T = InternalDataMetaNode & InternalProcessMetaNode> = BaseProcessMetaNode<T> & {
  codec: Codec<ExtractKey<T, 'data'>>
  prompt(props: {
    data?: ExtractKey<T, 'data'>,
    inputs: {[K in keyof ExtractKey<T, 'inputs'>]: DataMetaNodeData<ExtractKey<T, 'inputs'>[K]>}
    output?: DataMetaNodeData<ExtractKey<T, 'output'>>,
    submit: (data: ExtractKey<T, 'data'>) => void,
    session_id?: string,
  }): React.ReactElement
  resolve(props: {
    /* The data configured in the prompt */
    data: ExtractKey<T, 'data'>,
    /* The inputs to this process */
    inputs: {[K in keyof ExtractKey<T, 'inputs'>]: DataMetaNodeData<ExtractKey<T, 'inputs'>[K]>},
    /* Use in long-running processes to keep the user updated */
    notify(status: StatusUpdate): void,
  }): Promise<DataMetaNodeData<ExtractKey<T, 'output'>>>
  story(props: {
    /* The data configured in the prompt */
    data?: ExtractKey<T, 'data'>,
    /* The inputs to this process */
    inputs?: {[K in keyof ExtractKey<T, 'inputs'>]: DataMetaNodeData<ExtractKey<T, 'inputs'>[K]>}
    /* The output of this process */
    output?: DataMetaNodeData<ExtractKey<T, 'output'>>,
  }): string
}

/**
 * A ProcessMetaNode represents a semantically annotated function. That takes some arguments
 *  which are semantically typed instances of a DataMetaNode and produces a single semantically typed instance of a DataMetaNode.
 */
export type ProcessMetaNode = PromptMetaNode | ResolveMetaNode

/**
 * A MetaNode represents a semantically annotated type, whether it be Data or a Process
 */
export type MetaNode = DataMetaNode | ProcessMetaNode

/**
 * An incremental builder which constructs the various metanode types preserving type safety
 */
export function MetaNode<ID extends InternalIdentifiableMetaNode['spec']>(spec: ID) {
  return ({
    /**
     * Describe the metanode with human readable labels, descriptions, icons, etc..
     */
    meta: <META extends InternalIdentifiableMetaNode['meta']>(meta: META) =>
    ({
      /**
       * A codec or zod specification for validating the data type for a DataMetaNode
       */
      codec: <DATA extends InternalDataMetaNode['data']>(codec: DataMetaNode<{ data: DATA }>['codec'] | z.ZodType<DATA> = { encode: identity, decode: identity } as DataMetaNode<{ data: DATA }>['codec']) =>
      ({
        /**
         * A view function for rendering the DataMetaNode using React
         */
        view: (view: DataMetaNode<{ data: DATA }>['view']) =>
        ({
          /**
           * Build a DataMetaNode
           */
          build: () => ({ spec, meta, kind: 'data', codec: 'parse' in codec ? codecFrom(codec) : codec, view }) as DataMetaNode<{ spec: ID, meta: META, data: DATA }>,
        }),
        /**
         * The input(s) to this ProcessMetaNode, of the form
         *  { argumentName: SomeAlreadyDefinedDataMetaNode, ... }
         */
        inputs: <INPUTS>(inputs: {[K in keyof INPUTS]: INPUTS[K] extends MaybeArray<DataMetaNode<infer _>> ? INPUTS[K] : never} = {} as {[K in keyof INPUTS]: INPUTS[K] extends MaybeArray<DataMetaNode<infer _>> ? INPUTS[K] : never}) =>
        ({
          /**
           * The output of this ProcessMetaNode, an already defined DataMetaNode
           */
          output: <OUTPUT>(output: OUTPUT extends DataMetaNode<infer _> ? OUTPUT : never) =>
          ({
            /**
             * Define the prompt function for building a PromptMetaNode -- this function uses the input arguments
             *  to build a UI for prompting the user for information to create the output DataMetaNode.
             */
            prompt: (prompt: PromptMetaNode<{ data: DATA, inputs: INPUTS, output: OUTPUT }>['prompt']) =>
            ({
              /**
               * Define the resolve function for building a ResolveMetaNode -- this function uses the input arguments
               *  to resolve output matching the output DataMetaNode.
               */
              resolve: (resolve: PromptMetaNode<{ data: DATA, inputs: INPUTS, output: OUTPUT }>['resolve']) =>
              ({
                /**
                 * Describe this metanode's story
                 */
                story: (story: PromptMetaNode<{ data: DATA, inputs: INPUTS, output: OUTPUT }>['story']) => ({
                  /**
                   * Build a ProcessMetaNode
                   */
                  build: () => ({ spec, meta, kind: 'process', codec: 'parse' in codec ? codecFrom(codec) : codec, inputs, output, prompt, resolve, story }) as PromptMetaNode<{ spec: ID, meta: META, data: DATA, inputs: INPUTS, output: OUTPUT }>,
                })
              })
            })
          })
        })
      }),
      /**
       * The input(s) to this ProcessMetaNode, of the form
       *  { argumentName: SomeAlreadyDefinedDataMetaNode, ... }
       */
      inputs: <INPUTS>(inputs: {[K in keyof INPUTS]: INPUTS[K] extends MaybeArray<DataMetaNode<infer _>> ? INPUTS[K] : never} = {} as {[K in keyof INPUTS]: INPUTS[K] extends MaybeArray<DataMetaNode<infer _>> ? INPUTS[K] : never}) =>
      ({
        /**
         * The output of this ProcessMetaNode, an already defined DataMetaNode
         */
        output: <OUTPUT>(output: OUTPUT extends DataMetaNode<infer _> ? OUTPUT : never) =>
        ({
          /**
           * Define the resolve function for building a ResolveMetaNode -- this function uses the input arguments
           *  to resolve output matching the output DataMetaNode.
           */
          resolve: (resolve: ResolveMetaNode<{ inputs: INPUTS, output: OUTPUT }>['resolve']) =>
          ({
            /**
             * Describe this metanode's story
             */
            story: (story: ResolveMetaNode<{ inputs: INPUTS, output: OUTPUT }>['story']) => ({
              /**
               * Build a ProcessMetaNode
               */
              build: () => ({ spec, meta, kind: 'process', inputs, output, resolve, story }) as ResolveMetaNode<{ spec: ID, meta: META, inputs: INPUTS, output: OUTPUT }>,
            })
          }),
          /**
           * Define the prompt function for building a PromptMetaNode -- this function uses the input arguments
           *  to build a UI for prompting the user for information to create the output DataMetaNode.
           */
          prompt: (prompt: PromptMetaNode<{ data: DataMetaNodeData<OUTPUT>, inputs: INPUTS, output: OUTPUT }>['prompt']) =>
          ({
            /**
             * Describe this metanode's story
             */
            story: (story: PromptMetaNode<{ data: DataMetaNodeData<OUTPUT>, inputs: INPUTS, output: OUTPUT }>['story']) => ({
              /**
               * Build a ProcessMetaNode
               */
              build: () => ({ spec, meta, kind: 'process', codec: output.codec, inputs, output, prompt, resolve: async (props) => { return props.data }, story }) as PromptMetaNode<{ spec: ID, meta: META, data: DataMetaNodeData<OUTPUT>, inputs: INPUTS, output: OUTPUT }>,
            })
          })
        })
      })
    })
  })
}

/**
 * @deprecated just call MetaNode('yourname')
 */
MetaNode.createData = (spec: string) => {
  console.warn('Using Legacy MetaNode.createData(), please use MetaNode() instead')
  return MetaNode(spec)
}
/**
 * @deprecated just call MetaNode('yourname')
 */
MetaNode.createProcess = (spec: string) => {
  console.warn('Using Legacy MetaNode.createProcess(), please use MetaNode() instead')
  return MetaNode(spec)
}

export function MetaNodesFromExports(exports: Record<string, MetaNode[] | MetaNode | unknown>, packageJson: { version: string, license: string, author: string }) {
  const metanodes: MetaNode[] = []
  for (const key in exports) {
    const value = exports[key]
    const valueArray = Array.isArray(value) ? value : [value]
    for (const value of valueArray) {
      if (typeof value === 'object' && value !== null && 'spec' in value) {
        const metanode = value as MetaNode
        if (!metanode.meta.version) metanode.meta.version = packageJson.version
        if (!metanode.meta.license) metanode.meta.license = packageJson.license
        if (!metanode.meta.author) metanode.meta.author = packageJson.author
        metanodes.push(metanode)
      }
    }
  }
  return metanodes
}
