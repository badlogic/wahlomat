import { LitElement, PropertyValueMap, html } from "lit";
import { BaseElement, renderError } from "./ui-components";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { customElement } from "lit/decorators.js";
import Panzoom from "@panzoom/panzoom";

interface GeoJson {
    type: string;
    name: string;
    crs: {
        type: string;
        properties: {
            name: string;
        };
    };
    features: Array<{
        type: string;
        properties: {
            name: string;
            iso: string;
        };
        geometry: {
            type: string;
            coordinates: number[][][] | number[][][][];
        };
    }>;
}

function adjustYCoordinates(coordinates: number[][], minY: number, maxY: number): number[][] {
    return coordinates.map(([x, y]) => [x, maxY - (y - minY)]);
}

function mercatorProjection([lon, lat]: [number, number]): [number, number] {
    const R_MAJOR = 6378137.0;
    const R_MINOR = 6356752.3142;
    const temp = R_MINOR / R_MAJOR;
    const es = 1.0 - temp * temp;
    const eccent = Math.sqrt(es);

    const ts =
        Math.tan(Math.PI / 4 - (lat * Math.PI) / 360) /
        Math.pow((1 - eccent * Math.sin((lat * Math.PI) / 180)) / (1 + eccent * Math.sin((lat * Math.PI) / 180)), eccent / 2.0);
    const y = 0 - R_MAJOR * Math.log(ts);
    const x = (R_MAJOR * lon * Math.PI) / 180;

    return [x, y];
}

function geoJsonToSvg(geojson: GeoJson, strokeColor: string, width: number, fill: (id: string) => string): string {
    const svgParts: string[] = [];
    const allPoints: number[][] = [];

    geojson.features.forEach((feature) => {
        const { type, coordinates } = feature.geometry;

        if (type === "Polygon") {
            (coordinates as number[][][]).forEach((polygon) => {
                polygon.forEach((point) => allPoints.push(mercatorProjection(point as [number, number])));
            });
        } else if (type === "MultiPolygon") {
            (coordinates as number[][][][]).forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                    polygon.forEach((point) => allPoints.push(mercatorProjection(point as [number, number])));
                });
            });
        }
    });

    const minX = Math.min(...allPoints.map((point) => point[0]));
    const minY = Math.min(...allPoints.map((point) => point[1]));
    const maxX = Math.max(...allPoints.map((point) => point[0]));
    const maxY = Math.max(...allPoints.map((point) => point[1]));

    const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    const scale = width / (maxX - minX);

    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">`);

    geojson.features.forEach((feature) => {
        const { iso } = feature.properties;
        const { type, coordinates } = feature.geometry;

        if (type === "Polygon") {
            (coordinates as number[][][]).forEach((polygon) => {
                const adjustedPolygon = adjustYCoordinates(
                    polygon.map((point) => mercatorProjection(point as [number, number])),
                    minY,
                    maxY
                );
                const pathData = adjustedPolygon.map((point) => point.join(",")).join(" ");
                svgParts.push(
                    `<polygon id="${iso}" points="${pathData}" stroke="${strokeColor}" stroke-width="0.5" fill="${fill(
                        iso
                    )}"" vector-effect="non-scaling-stroke" />`
                );
            });
        } else if (type === "MultiPolygon") {
            (coordinates as number[][][][]).forEach((multiPolygon) => {
                multiPolygon.forEach((polygon) => {
                    const adjustedPolygon = adjustYCoordinates(
                        polygon.map((point) => mercatorProjection(point as [number, number])),
                        minY,
                        maxY
                    );
                    const pathData = adjustedPolygon.map((point) => point.join(",")).join(" ");
                    svgParts.push(
                        `<polygon id="${iso}" points="${pathData}" stroke="${strokeColor}" stroke-width="0.5" fill="${fill(
                            iso
                        )}" vector-effect="non-scaling-stroke" />`
                    );
                });
            });
        }
    });

    svgParts.push("</svg>");

    return svgParts.join("");
}

@customElement("geo-vis")
export class GeoVis extends LitElement {
    @property()
    json!: string;

    @property()
    strokeColor = "#aaa";

    @property()
    fillFunction = (id: string) => "none";

    @property()
    onClick = (id: string, el: HTMLElement) => {};

    @state()
    isLoading = true;

    @state()
    error?: string;

    @state()
    svg!: string;

    protected createRenderRoot(): Element | ShadowRoot {
        this.classList.add("items-center", "justify-center", "flex");
        return this;
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties);
        if (_changedProperties.has("json")) this.load();
        if (_changedProperties.has("svg")) {
            const el = this.querySelector("svg") as SVGElement;
            const panzoom = Panzoom(el, {
                maxScale: 20,
                overflow: "visible",
                step: /Mobi|Android/i.test(navigator.userAgent) ? 1 : 0.15,
            });
            el.addEventListener("wheel", panzoom.zoomWithWheel);
        }
    }

    async load() {
        try {
            const response = await fetch(this.json);
            if (!response.ok) throw new Error("Invalid URL " + this.json);
            const geo = (await response.json()) as GeoJson;
            this.svg = geoJsonToSvg(geo, this.strokeColor, 800, this.fillFunction);
        } catch (e) {
            console.log("Couldn't load JSON", e);
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        if (this.isLoading) return html`<loading-spinner></loading-spinner>`;
        if (this.error) return renderError(this.error);
        return html`<div
            class="w-full h-full flex items-center justify-center"
            @click=${(ev: Event) => this.handleClick(ev)}
            @mousemove=${(ev: Event) => this.handleClick(ev)}
        >
            ${unsafeHTML(this.svg)}
        </div>`;
    }

    handleClick(ev: Event) {
        console.log((ev.target as HTMLElement).id);
        this.onClick((ev.target as HTMLElement).id, ev.target as HTMLElement);
    }
}
