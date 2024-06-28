import { GlycoSightOutputType, GlycoSightFileURLType } from "./data_models";
import { GlycoSightOutputNode } from ".";
import { z } from "zod";

const devGSURL = process.env.NODE_ENV === "development" ? "http://localhost:5000/api/" : "https://aws.glygen.org/glycosight/api/"

export async function TestGlycoSightAPI(url: string) : Promise<GlycoSightOutputType> {
    // const res = await fetch(`${devGSURL}/dummy-upload?q=${url}&n=${fileName}`, { method: "POST" })
    const res = await fetch(`${devGSURL}test-access?q=${url}`, { method: "POST" });
    const dummyResult = res.json();
    return dummyResult;
}

export async function UploadAndAnalyze(file: GlycoSightFileURLType) : Promise<GlycoSightOutputType> {
    // const res = await fetch(`${devGSURL}/dummy-upload?q=${url}&n=${fileName}`, { method: "POST" })
    const res = await fetch(`${devGSURL}upload-and-analyze?q=${file.url}&n=${file.filename}`, { method: "POST" });
    const result = res.json();
    return result;
}


