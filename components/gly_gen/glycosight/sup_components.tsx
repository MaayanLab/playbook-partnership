import { GlycoSightOutput } from "./data_models";

import { z } from "zod";

type GlycoSightOutputType = z.infer<typeof GlycoSightOutput>;

