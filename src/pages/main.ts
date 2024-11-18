import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../app.js";
import { pageContainerStyle } from "../utils/styles.js";

@customElement("main-page")
export class MainPage extends BaseElement {
    render() {
        return html`<div class="${pageContainerStyle} text-[#ccc] max-w-[620px] items-center mx-auto mt-8 gap-4">
            <h1>Wahlomat</h1>
            <p>Kleine Tools, die Daten rund um Wahlen wie Wahlprogramme, Wahlergebnisse usw. visualisieren und analysierbar machen.</p>
            <a href="/regierung2024" class="text-blue-400 text-center flex flex-col gap-2 p-4 border border-blue-400 rounded">
                <span>Visualisierung der Wahlprogramme 2024 von ÖVP, SPÖ und NEOS</span><img src="img/regierung2024.png"
            /></a>
            <a href="/europa2024" class="text-blue-400 text-center flex flex-col gap-2 p-4 border border-blue-400 rounded">
                <span>Visualisierung der EU-Wahlprogramme 2024</span><img src="img/eu2024-programs.png"
            /></a>
            <a href="/europa2024-turnout" class="text-blue-400 text-center flex flex-col gap-2 p-4 border border-blue-400 rounded">
                <span>Wahlbeteiligung EU Wahl 2024</span><img src="img/eu2024-turnout.png"
            /></a>
        </div>`;
    }
}
