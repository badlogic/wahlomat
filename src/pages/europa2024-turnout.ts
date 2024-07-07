import { PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseElement, renderError } from "../app.js";
import { GeoVis } from "../utils/geovis.js";

type VotingResult = {
    GKZ: string;
    Gebietsname: string;
    Wahlberechtigte: number;
    abgegebene: number;
    ungueltige: number;
    gueltige: number;
    beteiligung: number;
    OEVP: number;
    SPOE: number;
    FPOE: number;
    GRUENE: number;
    NEOS: number;
    DNA: number;
    KPOE: number;
};

function csvToObjectArray(csv: string, delimiter: string = ";"): object[] {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(delimiter).map((t) => t.trim());

    return lines.slice(1).map((line) => {
        const values = line.split(delimiter).map((t) => t.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {} as any);
    });
}

function pleth(value: number, min: number, max: number) {
    value = (value - min) / (max - min);
    const startColor = [255, 255, 178]; // Lighter yellow
    const endColor = [0, 69, 41]; // Darker green

    const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * value);
    const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * value);
    const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * value);

    return `rgb(${r}, ${g}, ${b})`;
}

type Level = "laender" | "bezirke" | "gemeinden";

@customElement("pleth-scale")
export class PlethScale extends BaseElement {
    @property()
    pleth = (value: number) => `rgba(255, 0, 0, ${value})`;

    render() {
        this.classList.add("w-full", "h-full", "flex", "min-h-[16px]");
        return html`${Array.from(
            { length: 100 },
            (_, i) => html` <div class="w-[1%] h-full" style="background-color: ${this.pleth(i / 100)}"></div> `
        )} `;
    }
}

@customElement("europa2024-turnout-page")
export class Europa2024TurnoutPage extends BaseElement {
    @state()
    isLoading = true;

    @state()
    error?: string;

    @state()
    level: Level = "gemeinden";

    @state()
    selectedResult?: VotingResult;
    selectedElement?: HTMLElement;

    results: VotingResult[] = [];
    resultsLookup = new Map<string, VotingResult>();
    minParticipation = 1;
    maxParticipation = -1;

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.load();
    }

    async load() {
        try {
            const response = await fetch("static-data/euwahl-2024.csv");
            if (!response.ok) throw new Error();
            const csv = await response.text();
            this.results = (csvToObjectArray(csv) as VotingResult[]).map((item) => {
                item.GKZ = item.GKZ.substring(1);
                item.Wahlberechtigte = parseInt(item.Wahlberechtigte as any as string);
                item.abgegebene = parseInt(item.abgegebene as any as string);
                item.ungueltige = parseInt(item.ungueltige as any as string);
                item.gueltige = parseInt(item.gueltige as any as string);
                item.OEVP = parseInt(item.OEVP as any as string);
                item.SPOE = parseInt(item.SPOE as any as string);
                item.FPOE = parseInt(item.FPOE as any as string);
                item.GRUENE = parseInt(item.GRUENE as any as string);
                item.NEOS = parseInt(item.NEOS as any as string);
                item.DNA = parseInt(item.DNA as any as string);
                item.KPOE = parseInt(item.KPOE as any as string);
                item.beteiligung = item.abgegebene / item.Wahlberechtigte;
                if (Number.isFinite(item.beteiligung) && !Number.isNaN(item.beteiligung)) {
                    this.minParticipation = Math.min(item.beteiligung, this.minParticipation);
                    this.maxParticipation = Math.max(item.beteiligung, this.maxParticipation);
                }
                return item;
            });
            for (const result of this.results) {
                this.resultsLookup.set(result.GKZ, result);
            }
        } catch (e) {
            this.error = "Konnte Daten nicht laden";
            return;
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        if (this.isLoading) return html`<loading-spinner></loading-spinner>`;
        if (this.error) return renderError(this.error);
        return html`
            <div class="w-full h-full relative flex flex-col items-center text-[#ccc] mt-8 gap-4">
                <h1 class="z-10">Wahlbeteiligung - EU Wahl 2024</h1>
                <span class="text-xs text-center z-10"
                    >Ohne Wahlkarten auf Gemeindeebene, work in progress. Datenquelle:
                    <a
                        href="https://www.bmi.gv.at/412/Europawahlen/Europawahl_2024/files/vorlaeufiges_Endergebnis_inklusive_Wahlkarten.xlsx"
                        target="_blank"
                        class="text-blue-400"
                        >BMI</a
                    ></span
                >
                <div class="flex gap-2 z-10">
                    <label>
                        <input type="radio" name="region" @change=${() => this.changeLevel("laender")} />
                        Bundesländer
                    </label>
                    <label>
                        <input type="radio" name="region" @change=${() => this.changeLevel("bezirke")} />
                        Bezirke
                    </label>
                    <label>
                        <input type="radio" name="region" checked @change=${() => this.changeLevel("gemeinden")} />
                        Gemeinden
                    </label>
                </div>
                <div class="flex gap-2 w-full px-4 max-w-[620px] z-10">
                    <span>${(this.minParticipation * 100).toFixed(0)}%</span>
                    <pleth-scale .pleth=${(value: number) => pleth(value, 0, 1)}></pleth-scale>
                    <span>${(this.maxParticipation * 100).toFixed(0)}%</span>
                </div>
                ${this.selectedResult
                    ? html`<span class="z-10 bg-[#333] px-2 py-1 rounded font-semibold mx-4"
                          >${this.selectedResult.Gebietsname}: ${(this.selectedResult.beteiligung * 100).toFixed(2)}%</span
                      > `
                    : html`<span class="z-10 bg-[#333] px-2 py-1 rounded mx-4"
                          >Für Details mit Maus über Gebiet fahren oder mit Finger antippen. Pinch + Zoom am Smartphone.</span
                      >`}
                <geo-vis
                    .json=${`geo/${this.level}.json`}
                    .strokeColor=${"#333"}
                    .fillFunction=${(id: string) => {
                        id = id.padEnd(5, "0");
                        const result = this.resultsLookup.get(id);
                        if (!result) return "none";
                        return pleth(result.beteiligung, this.minParticipation, this.maxParticipation);
                    }}
                    .onClick=${(id: string, el: HTMLElement) => {
                        this.selectedElement?.setAttribute(
                            "fill",
                            pleth(this.selectedResult?.beteiligung ?? 0, this.minParticipation, this.maxParticipation)
                        );
                        el.setAttribute("fill", "#cc0000");
                        id = id.padEnd(5, "0");
                        const result = this.resultsLookup.get(id);
                        this.selectedResult = result;
                        this.selectedElement = el;
                    }}
                    class="w-full max-w-[1200px] px-4"
                ></geo-vis>
            </div>
        `;
    }

    changeLevel(level: Level) {
        this.level = level;
    }
}
