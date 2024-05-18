import { error } from "./utils/utils.js";

export interface JsonValue {
    [key: string]: any;
}

function apiBaseUrl() {
    if (typeof location === "undefined") return "http://localhost:3333/api/";
    return location.href.includes("localhost") || location.href.includes("192.168.1") ? `http://${location.hostname}:3333/api/` : "/api/";
}

export async function apiGet<T>(endpoint: string) {
    try {
        const result = await fetch(apiBaseUrl() + endpoint);
        if (!result.ok) throw new Error();
        return (await result.json()) as T;
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export async function apiGetBlob(endpoint: string): Promise<Blob | Error> {
    try {
        const result = await fetch(apiBaseUrl() + endpoint);
        if (!result.ok) throw new Error();
        return await result.blob();
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export async function apiGetText(endpoint: string): Promise<string | Error> {
    try {
        const result = await fetch(apiBaseUrl() + endpoint);
        if (!result.ok) throw new Error();
        return await result.text();
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export async function apiPost<T>(endpoint: string, params: URLSearchParams | FormData) {
    let headers: HeadersInit = {};
    let body: string | FormData;

    if (params instanceof URLSearchParams) {
        headers = { "Content-Type": "application/x-www-form-urlencoded" };
        body = params.toString();
    } else {
        body = params;
    }
    try {
        const result = await fetch(apiBaseUrl() + endpoint, {
            method: "POST",
            headers: headers,
            body: body,
        });
        if (!result.ok) throw new Error();
        return (await result.json()) as T;
    } catch (e) {
        return error(`Request /api/${endpoint} failed`, e);
    }
}

export function toUrlBody(params: JsonValue) {
    const urlParams = new URLSearchParams();
    for (const key in params) {
        const value = params[key];
        const type = typeof value;
        if (type == "string" || type == "number" || type == "boolean") {
            urlParams.append(key, value.toString());
        } else if (typeof value == "object") {
            urlParams.append(key, JSON.stringify(value));
        } else {
            throw new Error("Unsupported value type: " + typeof value);
        }
    }
    return urlParams;
}

export class Api {
    static async hello() {
        return apiGet<{ message: string }>("hello");
    }
}

export type Party = "spö" | "kpö" | "neos" | "övp" | "grüne" | "fpö";

export type PartyStatement = {
    x: number;
    y: number;
    party: Party;
    text: string;
    page: number;
    color: string;
};

async function fetchFile(url: string) {
    const response = await fetch(url);
    const text = await response.text();
    return text;
}

function parsePoints(data: string) {
    return data
        .trim()
        .split("\n")
        .map((line) => line.split("\t").map(Number));
}

function parseMeta(data: string) {
    const lines = data.trim().split("\n").slice(1);
    return lines.map((line) => {
        const [party, page, statement] = line.split("\t");
        return { party, page, statement };
    });
}

function mapPartyToColor(party: string) {
    const colorMap = {
        spö: "#E42612", // Soft Red
        neos: "#CA1A67", // Bright Pink
        övp: "#60C3D0", // Light Turquoise
        grüne: "#72A304", // Light Green
        fpö: "#005DA8", // Light Blue
        kpö: "#770000", // Deep Red
    };
    return colorMap[party.toLowerCase() as Party] || "black";
}

export async function loadData(): Promise<PartyStatement[]> {
    const pointsData = await fetchFile("data/projection-2d.tsv");
    const metaData = await fetchFile("data/vectors.meta.tsv");

    const points = parsePoints(pointsData);
    const meta = parseMeta(metaData);

    const stmts: PartyStatement[] = [];
    for (let i = 0; i < points.length; i++) {
        stmts.push({
            x: points[i][0],
            y: points[i][1],
            party: meta[i].party as Party,
            text: meta[i].statement,
            page: Number.parseInt(meta[i].page),
            color: mapPartyToColor(meta[i].party),
        });
    }
    return stmts;
}
