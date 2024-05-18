import { LitElement, PropertyValueMap, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

type PlotMode = "PanZoom" | "BoxSelect";
type PlotPoint = { x: number; y: number; text: string; color: string };
type PlotPointConfig = { selected: boolean; filtered: boolean };

@customElement("scatter-plot")
export class Plot extends LitElement {
    @property()
    minScale = 0.1;

    @property()
    maxScale = 5000;

    @property()
    points: PlotPoint[] = [];
    pointsConfig: PlotPointConfig[] = [];

    @property()
    showLabels = true;

    @property()
    selected = (points: PlotPoint[]) => {};

    @query("canvas")
    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D;

    scale = 1;
    offsetX = 0;
    offsetY = 0;
    lastX = 0;
    lastY = 0;
    isPinching = false;
    dragging = false;
    ignoreClick = false;
    plotMode: PlotMode = "PanZoom";

    touchStartDist = 0;
    touchLastX = 0;
    touchLastY = 0;
    touchCenter = { x: 0, y: 0 };

    selectionStartX = 0;
    selectionStartY = 0;
    isSelecting = false;

    set mode(mode: PlotMode) {
        this.plotMode = mode;
        this.draw();
    }

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    calculateBounds() {
        const padding = 25;
        const minX = Math.min(...this.points.map((point) => point.x));
        const maxX = Math.max(...this.points.map((point) => point.x));
        const minY = Math.min(...this.points.map((point) => point.y));
        const maxY = Math.max(...this.points.map((point) => point.y));

        const width = maxX - minX;
        const height = maxY - minY;

        const canvas = this.canvas;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        const scaleX = (canvasWidth - padding * 2) / width;
        const scaleY = (canvasHeight - padding * 2) / height;

        if (scaleX < scaleY) {
            this.scale = scaleX;
            this.offsetX = padding - minX * this.scale;
            this.offsetY = (canvasHeight - height * this.scale) / 2 - minY * this.scale;
        } else {
            this.scale = scaleY;
            this.offsetX = (canvasWidth - width * this.scale) / 2 - minX * this.scale;
            this.offsetY = padding - minY * this.scale;
        }
    }

    resizeListener = () => this.resizeCanvas();
    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.firstUpdated(_changedProperties);
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
        this.pointsConfig = this.points.map((point) => {
            return { selected: false, filtered: false };
        });
        this.setupListeners();
        this.resizeCanvas();
        window.addEventListener("resize", this.resizeListener);
    }

    protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        super.updated(_changedProperties);
        this.resizeCanvas();
    }

    disconnectedCallback(): void {
        window.removeEventListener("resize", this.resizeListener);
    }

    render() {
        return html`<canvas class="w-full h-full"></canvas>`;
    }

    resizeCanvas() {
        const canvas = this.canvas;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.calculateBounds();
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        const hasSelected = this.pointsConfig.some((c) => c.selected);

        this.points.forEach((point, index) => {
            if (this.pointsConfig[index].filtered) return;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5 / this.scale, 0, Math.PI * 2);
            if (hasSelected) {
                ctx.fillStyle = point.color + (!this.pointsConfig[index].selected ? "22" : "ff");
            } else {
                ctx.fillStyle = point.color;
            }
            ctx.fill();
        });

        ctx.restore();

        if (this.showLabels) {
            let labelsToDraw = this.points
                .filter((point, index) => !this.pointsConfig[index].filtered)
                .filter((point, index) => this.pointsConfig[index].selected)
                .map((point) => {
                    const screenX = point.x * this.scale + this.offsetX;
                    const screenY = point.y * this.scale + this.offsetY;
                    return { point, screenX, screenY, adjustedX: 0, adjustedY: 0 };
                })
                .sort((a, b) => a.screenY - b.screenY);

            labelsToDraw.forEach((label, index) => {
                ctx.font = "16px Arial";
                ctx.textBaseline = "top";
                const textWidth = Math.min(ctx.measureText(label.point.text).width, canvas.width - label.screenX - 20);

                let adjustedX = label.screenX + 10;
                let adjustedY = label.screenY + 5;

                if (index > 0) {
                    const prevLabel = labelsToDraw[index - 1];
                    if (adjustedY < prevLabel.adjustedY + 20) {
                        adjustedY = prevLabel.adjustedY + 20;
                    }
                }
                const radius = 5;
                ctx.fillStyle = "rgba(200, 200, 200, 0.65)";
                ctx.beginPath();
                ctx.moveTo(adjustedX - 2 + radius, adjustedY - 2);
                ctx.arcTo(adjustedX - 2 + textWidth + 4, adjustedY - 2, adjustedX - 2 + textWidth + 4, adjustedY - 2 + 20, radius);
                ctx.arcTo(adjustedX - 2 + textWidth + 4, adjustedY - 2 + 20, adjustedX - 2, adjustedY - 2 + 20, radius);
                ctx.arcTo(adjustedX - 2, adjustedY - 2 + 20, adjustedX - 2, adjustedY - 2, radius);
                ctx.arcTo(adjustedX - 2, adjustedY - 2, adjustedX - 2 + textWidth + 4, adjustedY - 2, radius);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = "black";
                ctx.fillText(label.point.text, adjustedX, adjustedY);

                label.adjustedX = adjustedX;
                label.adjustedY = adjustedY;
            });
        }

        // Draw selection rectangle if in BoxSelect mode
        if (this.plotMode === "BoxSelect" && this.isSelecting) {
            const canvas = this.canvas;
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = "#ccc";
            ctx.lineWidth = 4;
            ctx.strokeRect(this.selectionStartX, this.selectionStartY, this.lastX - this.selectionStartX, this.lastY - this.selectionStartY);
            ctx.restore();
        }
    }

    getCanvasCoordinates(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offsetX) / this.scale,
            y: (e.clientY - rect.top - this.offsetY) / this.scale,
        };
    }

    setupListeners() {
        const handleClick = (e: MouseEvent) => {
            if (this.ignoreClick) {
                this.ignoreClick = false;
                return;
            }

            if (this.plotMode === "PanZoom") {
                const { x, y } = this.getCanvasCoordinates(e);
                let closestPoint = null;
                let closestDist = Infinity;

                this.points.forEach((point, index) => {
                    if (this.pointsConfig[index].filtered) return;
                    const dist = Math.hypot(point.x - x, point.y - y);
                    if (dist < 20 / this.scale && dist < closestDist) {
                        closestDist = dist;
                        closestPoint = point;
                    }
                });

                if (closestPoint) {
                    const index = this.points.indexOf(closestPoint);
                    this.pointsConfig[index].selected = !this.pointsConfig[index].selected;
                } else {
                    this.pointsConfig.forEach((config) => (config.selected = false));
                }

                this.draw();
                this.selected(closestPoint ? [closestPoint] : []);
            } else {
                this.mode = "PanZoom";
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (this.plotMode === "PanZoom") {
                this.dragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            } else if (this.plotMode === "BoxSelect") {
                this.isSelecting = true;
                this.selectionStartX = e.clientX;
                this.selectionStartY = e.clientY;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.draw();
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (this.plotMode === "PanZoom" && this.dragging) {
                this.offsetX += e.clientX - this.lastX;
                this.offsetY += e.clientY - this.lastY;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.draw();
                this.ignoreClick = true;
            } else if (this.plotMode === "BoxSelect" && this.isSelecting) {
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.draw();
            }
        };

        const handleMouseUp = () => {
            if (this.plotMode === "PanZoom") {
                this.dragging = false;
            } else if (this.plotMode === "BoxSelect" && this.isSelecting) {
                this.isSelecting = false;
                const startCoords = this.getCanvasCoordinates({
                    clientX: this.selectionStartX,
                    clientY: this.selectionStartY,
                } as MouseEvent);
                const endCoords = this.getCanvasCoordinates({
                    clientX: this.lastX,
                    clientY: this.lastY,
                } as MouseEvent);
                const xMin = Math.min(startCoords.x, endCoords.x);
                const xMax = Math.max(startCoords.x, endCoords.x);
                const yMin = Math.min(startCoords.y, endCoords.y);
                const yMax = Math.max(startCoords.y, endCoords.y);
                const selectedPoints: PlotPoint[] = [];
                this.select((point) => {
                    const result = point.x >= xMin && point.x <= xMax && point.y >= yMin && point.y <= yMax;
                    if (result) selectedPoints.push(point);
                    return result;
                });
                this.draw();
                this.selected(selectedPoints);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (this.plotMode === "PanZoom") {
                e.preventDefault();
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const zoom = Math.exp(-e.deltaY * 0.01);
                const newScale = Math.min(Math.max(this.minScale, this.scale * zoom), this.maxScale);

                const newOffsetX = (mouseX - this.offsetX) * (newScale / this.scale) + this.offsetX - mouseX;
                const newOffsetY = (mouseY - this.offsetY) * (newScale / this.scale) + this.offsetY - mouseY;

                this.offsetX -= newOffsetX;
                this.offsetY -= newOffsetY;
                this.scale = newScale;
                this.draw();
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (this.plotMode === "PanZoom" && e.touches.length === 2) {
                this.isPinching = true;
                this.touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                this.touchCenter.x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                this.touchCenter.y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            } else if (e.touches.length === 1 && !this.isPinching) {
                if (this.plotMode === "BoxSelect") {
                    this.isSelecting = true;
                    this.selectionStartX = e.touches[0].clientX;
                    this.selectionStartY = e.touches[0].clientY;
                } else {
                    this.touchLastX = e.touches[0].clientX;
                    this.touchLastY = e.touches[0].clientY;
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (this.plotMode === "PanZoom" && e.touches.length === 2 && this.isPinching) {
                const touchCurrentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const zoom = touchCurrentDist / this.touchStartDist;
                const newScale = Math.min(Math.max(this.minScale, this.scale * zoom), this.maxScale);

                const newOffsetX = (this.touchCenter.x - this.offsetX) * (newScale / this.scale) + this.offsetX - this.touchCenter.x;
                const newOffsetY = (this.touchCenter.y - this.offsetY) * (newScale / this.scale) + this.offsetY - this.touchCenter.y;

                this.offsetX -= newOffsetX;
                this.offsetY -= newOffsetY;
                this.scale = newScale;
                this.touchStartDist = touchCurrentDist;
                this.draw();
            } else if (e.touches.length === 1 && this.plotMode === "BoxSelect" && this.isSelecting) {
                this.lastX = e.touches[0].clientX;
                this.lastY = e.touches[0].clientY;
                this.draw();
            } else if (e.touches.length === 1 && this.plotMode === "PanZoom" && !this.isPinching) {
                this.offsetX += e.touches[0].clientX - this.touchLastX;
                this.offsetY += e.touches[0].clientY - this.touchLastY;
                this.touchLastX = e.touches[0].clientX;
                this.touchLastY = e.touches[0].clientY;
                this.draw();
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                this.touchLastX = e.touches[0].clientX;
                this.touchLastY = e.touches[0].clientY;
                this.isPinching = false;
            } else if (e.touches.length === 0 && this.plotMode === "BoxSelect" && this.isSelecting) {
                this.isSelecting = false;
                const startCoords = this.getCanvasCoordinates({
                    clientX: this.selectionStartX,
                    clientY: this.selectionStartY,
                } as MouseEvent);
                const endCoords = this.getCanvasCoordinates({
                    clientX: this.lastX,
                    clientY: this.lastY,
                } as MouseEvent);
                const xMin = Math.min(startCoords.x, endCoords.x);
                const xMax = Math.max(startCoords.x, endCoords.x);
                const yMin = Math.min(startCoords.y, endCoords.y);
                const yMax = Math.max(startCoords.y, endCoords.y);
                const selectedPoints: PlotPoint[] = [];
                this.select((point) => {
                    const result = point.x >= xMin && point.x <= xMax && point.y >= yMin && point.y <= yMax;
                    if (result) selectedPoints.push(point);
                    return result;
                });
                this.draw();
                this.selected(selectedPoints);
                this.mode = "PanZoom";
            }
        };

        const canvas = this.canvas;
        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseup", handleMouseUp);
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        canvas.addEventListener("click", handleClick);
        canvas.addEventListener("touchstart", handleTouchStart);
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        canvas.addEventListener("touchend", handleTouchEnd);
    }

    filter(predicate: (point: { x: number; y: number; text: string; color: string }, index: number) => boolean) {
        for (let i = 0; i < this.points.length; i++) {
            this.pointsConfig[i].filtered = predicate(this.points[i], i);
        }
        this.draw();
    }

    select(predicate: (point: { x: number; y: number; text: string; color: string }, index: number) => boolean) {
        for (let i = 0; i < this.points.length; i++) {
            this.pointsConfig[i].selected = predicate(this.points[i], i);
        }
        this.draw();
    }

    clearFilter() {
        for (const config of this.pointsConfig) {
            config.filtered = false;
        }
        this.draw();
    }
}
