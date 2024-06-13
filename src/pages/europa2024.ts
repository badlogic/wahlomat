import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Party, PartyStatement, loadData } from "../api.js";
import { renderError } from "../app.js";
import { i18n } from "../utils/i18n.js";
import { pageContainerStyle } from "../utils/styles.js";
import { Plot } from "../app.js";

@customElement("toggle-button")
export class ToggleButton extends LitElement {
    @property()
    selected = true;

    @property()
    changed = (selected: boolean) => {};

    @property()
    fgColor = "#fff";

    @property()
    bgColor = "#333";

    @property()
    bgColorDimmed = "#000";

    @property()
    text: string = "toggle me";

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        const button = this.querySelector("div") as HTMLDivElement;
        button.addEventListener("click", () => {
            this.selected = !this.selected;
            this.changed(this.selected);
        });
    }

    render() {
        return html`<div
            class="px-2 py-1 rounded-full cursor-pointer select-none border border-[#ccc]"
            style="color: ${this.fgColor}; background-color: ${this.selected ? this.bgColor : this.bgColorDimmed}"
        >
            ${this.text}
        </div>`;
    }
}

@customElement("europa2024-page")
export class Europa2024Page extends LitElement {
    @property()
    isLoading = true;

    @property()
    error?: string;

    points: PartyStatement[] = [];

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.load();
    }

    async load() {
        try {
            this.points = (await loadData())
                .filter((p) => !p.text.includes("Keine konkreten Zahlen"))
                .filter((p) => !p.text.includes("Unbenannter Plan"))
                .filter((p) => !p.text.includes("wobei konkrete Zahlen zu den Forderungen"));
            this.points.forEach((p) => {
                p.text = p.text
                    .replace("fpö-", "FPÖ -")
                    .replace("spö-", "SPÖ -")
                    .replace("övp-", "ÖVP -")
                    .replace("grüne-", "GRÜNE -")
                    .replace("neos-", "NEOS -")
                    .replace("kpö-", "KPÖ -")
                    .replace("kpö1.", "KPÖ -")
                    .replace("kpö2.", "KPÖ -")
                    .replace("kpö3.", "KPÖ -")
                    .replace("kpö4.", "KPÖ -")
                    .replace("kpö5.", "KPÖ -");
                p.text += " (Seite " + p.page + ")";
            });
        } catch (e) {
            this.error = i18n("Couldn't load mesage");
            return;
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        if (this.isLoading) return html`<loading-spinner></loading-spinner>`;
        if (this.error) return renderError(this.error);
        return html`
            <div class="w-full h-full relative">
                <scatter-plot .points=${this.points} class="w-full h-full absolute" .selected=${() => this.selected()}></scatter-plot>
                <div class="flex flex-col gap-2 items-center w-full pt-4 relative">
                    <div class="flex px-4 py-2 rounded-full min-w-[320px] max-w-[320px] bg-[#000c] border border-[#ccc]">
                        <input class="bg-transparent text-white w-full" placeholder="Stichworte suchen" @input=${() => this.filter()} />
                    </div>
                    <div class="flex flex-wrap gap-1 p-2 bg-[#000c] rounded-full">
                        <toggle-button .text=${"SPÖ"} .bgColor=${"#E42612"} .changed=${() => this.filter()}></toggle-button>
                        <toggle-button .text=${"NEOS"} .bgColor=${"#CA1A67"} .changed=${() => this.filter()}></toggle-button>
                        <toggle-button .text=${"ÖVP"} .bgColor=${"#60C3D0"} .changed=${() => this.filter()}></toggle-button>
                        <toggle-button .text=${"GRÜNE"} .bgColor=${"#72A304"} .changed=${() => this.filter()}></toggle-button>
                        <toggle-button .text=${"FPÖ"} .bgColor=${"#005DA8"} .changed=${() => this.filter()}></toggle-button>
                        <toggle-button .text=${"KPÖ"} .bgColor=${"#770000"} .changed=${() => this.filter()}></toggle-button>
                    </div>
                    <div class="flex gap-2">
                        <toggle-button
                            id="mode"
                            .bgColor=${"#777"}
                            .selected=${false}
                            .text=${"Rechteckselektion"}
                            .changed=${() => ((this.querySelector("scatter-plot") as Plot).mode = "BoxSelect")}
                        >
                        </toggle-button>

                        <a
                            href="https://x.com/badlogicgames/status/1791948524092789108"
                            target="_blank"
                            class="px-2 py-1 rounded-full cursor-pointer select-none border border-[#ccc] text-[#fff] bg-[#000]"
                            >Anleitung</a
                        >
                    </div>
                </div>
                <span class="absolute bottom-0 mx-auto text-[#ccc] text-xs px-4 py-2"
                    >Gebaut mit Spucke und Tixo von <a class="text-blue-400" target="_blank" href="https://twitter.com/badlogicgames">Mario Zechner</a
                    ><br />Die Seite sammelt keine Daten, nicht einmal deine IP Adresse.
                    <a class="text-blue-400" target="_blank" href="https://github.com/badlogic/wahlomat">Source Code</a></span
                >
            </div>
        `;
    }

    filter() {
        const toggles = Array.from(this.querySelectorAll("toggle-button")) as ToggleButton[];
        const selectedParties = new Set<string>();
        for (const toggle of toggles) {
            if (toggle.selected) selectedParties.add(toggle.text.toLowerCase() as Party);
        }

        const query = (this.querySelector("input") as HTMLInputElement).value;
        const tokens = query.split(/\s+/).filter((t) => t.trim().length > 0);
        const lcTokens = tokens.filter((token) => !token.startsWith('"')).map((t) => t.toLowerCase());
        const sTokens = tokens.filter((token) => token.startsWith('"')).map((t) => t.replaceAll('"', ""));

        const plot = this.querySelector("scatter-plot") as Plot;
        plot.filter((point) => !selectedParties.has((point as PartyStatement).party));
        plot.select((point) => {
            const p = point as PartyStatement;
            const lcText = p.text.toLowerCase();
            for (const token of lcTokens) {
                if (lcText.includes(token)) return true;
            }
            const sText = p.text;
            for (const token of sTokens) {
                if (sText.includes(token)) return true;
            }
            return false;
        });
    }

    selected() {
        (this.querySelector("#mode") as ToggleButton).selected = false;
    }
}
