import React from "react";
import { MetaNode } from "@/spec/metanode";
import { z } from "zod";
import { Table, Cell, Column, EditableCell } from '@/app/components/Table';
import * as dict from '@/utils/dict'
import { downloadBlob } from '@/utils/download'

import { file_icon, file_transfer_icon, glygen_icon } from "@/icons";
import { FileC, FilePrompt, FileURL, FileInput } from "@/components/core/file";
import python from "@/utils/python";
import SafeRender from "@/utils/saferender";

import { GlycoSightOutputC, 
         GlycoSightFileURLC, 
         GlycoSightOutputType,
         GlycoSightFileURLType } from "./data_models";
import { TestGlycoSightAPI,
         UploadAndAnalyze
 } from "./sup_functions";
import { clientLoadExample } from "./data/client";
import { notify_insertion_trigger } from "@/db";

export const GlycoSightOutputNode = MetaNode("GlycoSightOutputNode")
    .meta({
        label: `GlycoSight Analysis output`,
        description: `UniProt accessions, peptides, and associated glycosylation sites`,
        icon: [glygen_icon],
    })
    .codec(GlycoSightOutputC)
    .view((data) => {
        const gs_items = data.results;
        // const gs_items = dict.items(data);
        return (
              <Table
                height={500}
                cellRendererDependencies={[gs_items]}
                numRows={gs_items.length}
                enableGhostCells
                enableFocusedCell
                downloads={{
                  JSON: () => downloadBlob(new Blob([JSON.stringify(gs_items)], { type: 'application/json;charset=utf-8' }), 'data.json'),
                //   GS_TSV: () => downloadBlob(new Blob([gs_items.map(({ key: term, value: { description, set } }) => [term, description||'', ...set].join('\t')).join('\n')], { type: 'text/tab-separated-values;charset=utf-8' }), 'data.gs'),
                }}
              >
                {/* <Column
                  name="Index"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].key.toString()}</Cell>}
                /> */}
                <Column
                  name="UniProt Accession"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].UniProtAcc}</Cell>}
                />
                <Column
                  name="Amino Acid Position"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].AAPosition}</Cell>}
                />
                <Column
                  name="Spectral Count"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].SpectralCount}</Cell>}
                />
                <Column
                  name="Distinct Peptide Count"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].DistinctPeptideCount}</Cell>}
                />
                <Column
                  name="Peptides"
                  cellRenderer={row => <Cell key={row+''}>{gs_items[row].Peptides}</Cell>}
                />
              </Table>
            )
          })
    .build()

export const GlycoSightFileURLNode = MetaNode("GlycoSightURL")
    .meta({
        label:"GlycoSight File URL",
        description: "URL to storage of MZID archives",
        icon: [glygen_icon],
    })
    .codec(GlycoSightFileURLC)
    .view((data) => (
        <div>
            <h2 className="prose max-w-none">GlycoSight File: {data.url}</h2>
        </div>
    ))
    .build()

export const GlycoSightProcessNode = MetaNode("GlycoSightProcessNode")
    .meta({
        label: `Launch GlycoSight Analysis`,
        description: `Run GlycoSight Analysis on MZID file(s)`,
        icon: [glygen_icon],
    })
    .inputs({ file: GlycoSightFileURLNode })
    .output(GlycoSightOutputNode)
    .resolve(( props ) => {
        const result = UploadAndAnalyze(props.inputs.file);
        return result;
    })
    .story((props) => {return "The N-Linked glycan sites analysis was launched through the GlycoSight servers"})
    .build()

export const GlycoSightFileUpload = MetaNode("GlycoSightUpload")
    .meta({
        label: "Upload GlycoSight MZID",
        description: "Upload MZID data for peptide-to-Uniprot sample mapping",
        icon: [glygen_icon],
    })
    .codec(FileC)
    .inputs() 
    .output(GlycoSightFileURLNode)
    .prompt(props => <>
        <FilePrompt {...props} />
        {/* TODO: <FilePrompt {...props} example={clientLoadExample} /> */}
        {props.output ? 
            <SafeRender 
                component={FileURL.view} 
                props={props.output} 
            /> : 
            null}</>
        )
        .resolve(async (props) => props.data)
        .story((props) => { return "Upload MZID glycosylation data for N-linked glycan analysis" })
        .build()




// TODO: To pick up at a later date
//     .resolve(async (props) => {
//         const result = resolvePython(props.data, props.notify);
//         return result;
//         }
//     )
//     .story(props => "We did it!")
//     .build()

// async function resolvePython(data, notify) {
//     await python(
//         'components.gly_gen.glycosight.load_mzid_file', 
//         { kargs: [data] },
//         message => notify({ type: 'info', message }),
//     )
// }
