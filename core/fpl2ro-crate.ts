/**
 * This converts PWB workflows and components into Research Object Crates
 */
import type { FPL } from "@/core/FPPRG"
import type KRG from "@/core/KRG"
import * as dict from '@/utils/dict'
import packageJson from '@/package.json'
import { Author, Metadata, fpl_expand, toISO8601TimeString } from "./common";

const version = packageJson.version

export default async function fpl2ro_create(props: { krg: KRG, fpl: FPL, metadata?: Metadata, author?: Author | null }) {
  const { processLookup, story } = await fpl_expand(props)
  return {
    "@context": "https://w3id.org/ro/crate/1.1/context",
    "@id": `${process.env.PUBLIC_URL}/report/${props.fpl.id}`,
    "@type": "ComputationalWorkflow",
    "dct:conformsTo": "https://bioschemas.org/profiles/ComputationalWorkflow/1.0-RELEASE/",
    "url": `${process.env.PUBLIC_URL}/report/${props.fpl.id}`,
    "version": 0,
    "sdPublisher": {
      "@type": "Organization",
      "url": "https://playbook-workflow-builder.cloud"
    },
    "name": props.metadata?.title,
    "description": props.metadata?.description ?? story,
    "dateCreated": toISO8601TimeString(),
    "license": 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    "programmingLanguage": [
      {
        "@type": "ComputerLanguage",
        "name": "Playbook Workflow Builder",
        "version": version,
        "alternateName": "PWB",
        "url": "https://playbook-workflow-builder.cloud",
      }
    ],
    "creator": props.author?.orcid ? [
      {
        "@id": props.author.orcid,
        "@type": "Person",
        "name": props.author.name,
        // "email": props.author.email,
        "affiliation": props.author.affiliation ? {
          "@type": "Organization",
          "name": props.author.affiliation
        } : undefined,
      },
    ] : undefined,
    "input": dict.values(processLookup).filter(({ metanode }) => 'codec' in metanode).map(({ index, node, metanode }) => ({
      "@type": "FormalParameter",
      "dct:conformsTo": "https://bioschemas.org/profiles/FormalParameter/1.0-RELEASE/",
      "name": metanode.meta.label,
      "description": metanode.meta.description,
      "encodingFormat": "application/json",
    })),
    "output": dict.values(processLookup).map(({ index, node, metanode }) => ({
      "@type": "FormalParameter",
      "dct:conformsTo": "https://bioschemas.org/profiles/FormalParameter/1.0-RELEASE/",
      "name": metanode.output.meta.label,
      "description": metanode.output.meta.description,
      "encodingFormat": "application/json",
    })),
    "encoding": [
      {
        "@type": "File",
        "encodingFormat":"application/json",
        "contentUrl": `${process.env.PUBLIC_URL}/api/db/fpl/${props.fpl.id}/export`,
        "name": "Playbook JSON",
      },
      {
        "@type": "File",
        "encodingFormat":"application/json",
        "contentUrl": `${process.env.PUBLIC_URL}/api/db/fpl/${props.fpl.id}/output/export`,
        "name": "Playbook with Output JSON",
      },
      {
        "@type": [
          "File",
          "SoftwareSourceCode"
        ],
        "programmingLanguage": {
          "@type": "ComputerLanguage",
          "name": "Common Workflow Language",
          "alternateName": "CWL",
          "identifier": "https://w3id.org/cwl/v1.0/",
          "url": "https://www.commonwl.org/",
        },
        "encodingFormat":"application/x-zip",
        "contentUrl": `${process.env.PUBLIC_URL}/api/v1/cwl/${props.fpl.id}`,
      },
      {
        "@type": [
          "File",
          "SoftwareSourceCode"
        ],
        "programmingLanguage": {
          "@type": "ComputerLanguage",
          "name": "BioCompute Object",
          "alternateName": "BCO",
          "identifier": "https://w3id.org/ieee/ieee-2791-schema",
          "url": "https://biocomputeobject.org/",
        },
        "encodingFormat":"application/json",
        "contentUrl": `${process.env.PUBLIC_URL}/api/bco/${props.fpl.id}`,
      },
    ],
  }
}
