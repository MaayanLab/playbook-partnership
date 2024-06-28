import React from 'react'
import { z } from 'zod';


export const GlycoSightOutputC = z.object({
  results: z.array(
      z.object({
        UniProtAcc: z.string(),
        AAPosition: z.number(),
        SpectralCount: z.number(),
        DistinctPeptideCount: z.number(),
        Peptides: z.string(),
      })
    )
  })

export const GlycoSightFileURLC = z.object({
    description: z.string().optional().nullable(),
    url: z.string(),
    filename: z.string(),
    sha256: z.string().optional(),
    size: z.number().optional(),
})

export type GlycoSightOutputType = z.infer<typeof GlycoSightOutputC>;
export type GlycoSightFileURLType = z.infer<typeof GlycoSightFileURLC>;

