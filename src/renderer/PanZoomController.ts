export interface PanZoomState {
	readonly scale: number;
	readonly x: number;
	readonly y: number;
}

export interface PanZoomPoint {
	readonly x: number;
	readonly y: number;
}

export interface PanZoomBounds {
	viewportWidth: number;
	viewportHeight: number;
	contentWidth: number;
	contentHeight: number;
}

export function clampScale(scale: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, scale));
}

/**
 * 锚定缩放：s' = clamp(s * factor)；k = s' / s（触顶后用实际 k 重算，防止光标漂移）；
 * t' = a - k * (a - t)。等价于 @antv/infographic 编辑器的 calculateZoomedViewBox 数学。
 */
export function zoomAt(
	state: PanZoomState,
	factor: number,
	anchor: PanZoomPoint,
	minScale: number,
	maxScale: number,
): PanZoomState {
	const next = clampScale(state.scale * factor, minScale, maxScale);
	const k = next / state.scale;
	return {
		scale: next,
		x: anchor.x - k * (anchor.x - state.x),
		y: anchor.y - k * (anchor.y - state.y),
	};
}

/** scale<=1 归零；scale>1 时把 translate 夹在 [min(0, vp - s*c), max(0, vp - s*c)]。 */
export function clampPan(state: PanZoomState, bounds: PanZoomBounds): PanZoomState {
	if (state.scale <= 1) {
		return { scale: state.scale, x: 0, y: 0 };
	}
	const clampAxis = (t: number, viewport: number, content: number): number => {
		const lo = Math.min(0, viewport - state.scale * content);
		const hi = Math.max(0, viewport - state.scale * content);
		return Math.min(hi, Math.max(lo, t));
	};
	return {
		scale: state.scale,
		x: clampAxis(state.x, bounds.viewportWidth, bounds.contentWidth),
		y: clampAxis(state.y, bounds.viewportHeight, bounds.contentHeight),
	};
}

export interface PanZoomOptions {
	/** overflow:hidden 的裁剪层，接收 wheel/pointer 事件 */
	viewportEl: HTMLElement;
	/** 被 transform 的内容层（SVG 的父级）。Controller 不创建/不拥有 DOM */
	contentEl: HTMLElement;
	minScale?: number;
	maxScale?: number;
	/** scale=1 时不拦截滚轮（笔记内默认）；"always" 供全屏用 */
	wheelMode?: "when-zoomed" | "always";
	onChange?: (state: PanZoomState) => void;
	onReset?: () => void;
}

const WHEEL_ZOOM_RATE = 0.0015;
const EPSILON = 0.0001;

export class PanZoomController {
	private state: PanZoomState = { scale: 1, x: 0, y: 0 };
	private readonly minScale: number;
	private readonly maxScale: number;
	private readonly wheelMode: "when-zoomed" | "always";
	private readonly win: Window;
	private frame: number | null = null;
	private dragging = false;
	private dragPointerId: number | null = null;
	private dragLast: PanZoomPoint | null = null;
	private pinchPointers = new Map<number, PanZoomPoint>();
	private pinchStartDistance = 0;
	private pinchStartState: PanZoomState | null = null;
	private destroyed = false;
	private readonly options: PanZoomOptions;

	constructor(options: PanZoomOptions) {
		this.options = options;
		this.minScale = options.minScale ?? 1;
		this.maxScale = options.maxScale ?? 8;
		this.wheelMode = options.wheelMode ?? "when-zoomed";
		const view = options.contentEl.ownerDocument.defaultView;
		if (!view) throw new Error("PanZoomController: contentEl has no defaultView");
		this.win = view;

		options.viewportEl.addEventListener("wheel", this.onWheel, { passive: false });
		options.viewportEl.addEventListener("pointerdown", this.onPointerDown);
		options.viewportEl.addEventListener("dblclick", this.onDblClick);
		this.options.viewportEl.style.touchAction = (this.isZoomed() || this.options.wheelMode === "always") ? "none" : "pan-y";
	}

	getState(): PanZoomState {
		return this.state;
	}

	isZoomed(): boolean {
		return this.state.scale > 1 + EPSILON;
	}

	zoomTo(scale: number, anchor?: PanZoomPoint): void {
		this.applyZoom(this.state.scale * (clampScale(scale, this.minScale, this.maxScale) / this.state.scale), anchor);
	}

	zoomBy(factor: number, anchor?: PanZoomPoint): void {
		this.applyZoom(this.state.scale * factor, anchor);
	}

	panBy(dx: number, dy: number): void {
		this.applyState(
			clampPan({ scale: this.state.scale, x: this.state.x + dx, y: this.state.y + dy }, this.measure()),
		);
	}

	reset(): void {
		this.state = { scale: 1, x: 0, y: 0 };
		this.paint();
		this.options.onReset?.();
	}

	/** 容器尺寸变化（RO/拖宽）后调用：重算 clamp；resetIfZoomed 时直接回 fit 态。 */
	relayout(relayoutOptions?: { resetIfZoomed?: boolean }): void {
		if (relayoutOptions?.resetIfZoomed && this.isZoomed()) {
			this.reset();
			return;
		}
		this.applyState(clampPan(this.state, this.measure()));
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.frame !== null) {
			this.win.cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		this.detachWindowListeners();
		const vp = this.options.viewportEl;
		vp.removeEventListener("wheel", this.onWheel);
		vp.removeEventListener("pointerdown", this.onPointerDown);
		vp.removeEventListener("dblclick", this.onDblClick);
		this.options.contentEl.setCssProps({ transform: "" });
		this.options.viewportEl.setCssProps({ "touch-action": "" });
		this.options.viewportEl.classList.remove("infographic-panning");
	}

	// ---- internals ----

	private applyZoom(targetScale: number, anchor?: PanZoomPoint): void {
		const factor = targetScale / this.state.scale;
		const a = anchor ?? { x: this.options.viewportEl.clientWidth / 2, y: this.options.viewportEl.clientHeight / 2 };
		const zoomed = zoomAt(this.state, factor, a, this.minScale, this.maxScale);
		this.applyState(clampPan(zoomed, this.measure()));
	}

	private applyState(next: PanZoomState): void {
		this.state = next;
		if (this.frame === null) {
			this.frame = this.win.requestAnimationFrame(() => {
				this.frame = null;
				this.paint();
			});
		}
	}

	private paint(): void {
		const { scale, x, y } = this.state;
		this.options.contentEl.setCssProps({ "transform-origin": "0 0" });
		this.options.contentEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
		// fit 态把垂直滑动还给笔记（pan-y）；放大后才独占触摸
		this.options.viewportEl.style.touchAction = (this.isZoomed() || this.options.wheelMode === "always") ? "none" : "pan-y";
		this.options.onChange?.(this.state);
	}

	private measure(): PanZoomBounds {
		return {
			viewportWidth: this.options.viewportEl.clientWidth,
			viewportHeight: this.options.viewportEl.clientHeight,
			contentWidth: this.options.contentEl.offsetWidth,
			contentHeight: this.options.contentEl.offsetHeight,
		};
	}

	private localPoint(event: { clientX: number; clientY: number }): PanZoomPoint {
		const rect = this.options.viewportEl.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	private readonly onWheel = (event: WheelEvent): void => {
		if (this.destroyed) return;
		const modifier = event.ctrlKey || event.metaKey;
		// 滚轮红线（spec §3）：fit 态普通滚轮完全归笔记，绝不 preventDefault
		if (this.wheelMode !== "always" && !this.isZoomed() && !modifier) return;
		event.preventDefault();
		const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_RATE);
		this.zoomBy(factor, this.localPoint(event));
	};

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.destroyed) return;
		this.pinchPointers.set(event.pointerId, this.localPoint(event));
		this.attachWindowListeners();

		if (this.pinchPointers.size === 2) {
			const [a, b] = [...this.pinchPointers.values()] as [PanZoomPoint, PanZoomPoint];
			this.pinchStartDistance = Math.hypot(a.x - b.x, a.y - b.y);
			this.pinchStartState = this.state;
			this.dragging = false;
			this.dragPointerId = null;
			this.dragLast = null;
			return;
		}
		if (this.pinchPointers.size > 2) return;
		if (!this.isZoomed() || event.button !== 0) return;

		this.dragging = true;
		this.dragPointerId = event.pointerId;
		this.dragLast = this.localPoint(event);
		this.options.viewportEl.classList.add("infographic-panning");
		try {
			this.options.viewportEl.setPointerCapture(event.pointerId);
		} catch {
			// 合成指针（自动化测试）无 pointerId，忽略
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (this.pinchPointers.has(event.pointerId)) {
			this.pinchPointers.set(event.pointerId, this.localPoint(event));
		}
		if (this.pinchPointers.size >= 2 && this.pinchStartState && this.pinchStartDistance > 0) {
			const [a, b] = [...this.pinchPointers.values()] as [PanZoomPoint, PanZoomPoint];
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			const factor = distance / this.pinchStartDistance;
			const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			const zoomed = zoomAt(this.pinchStartState, factor, anchor, this.minScale, this.maxScale);
			this.applyState(clampPan(zoomed, this.measure()));
			return;
		}
		if (!this.dragging || event.pointerId !== this.dragPointerId || !this.dragLast) return;
		const point = this.localPoint(event);
		this.panBy(point.x - this.dragLast.x, point.y - this.dragLast.y);
		this.dragLast = point;
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		this.pinchPointers.delete(event.pointerId);
		if (this.pinchPointers.size < 2) {
			this.pinchStartState = null;
			this.pinchStartDistance = 0;
		}
		if (event.pointerId === this.dragPointerId) {
			this.dragging = false;
			this.dragPointerId = null;
			this.dragLast = null;
			this.options.viewportEl.classList.remove("infographic-panning");
		}
		if (this.pinchPointers.size === 0 && !this.dragging) {
			this.detachWindowListeners();
		}
	};

	private readonly onDblClick = (): void => {
		if (!this.destroyed) this.reset();
	};

	private attachWindowListeners(): void {
		this.win.addEventListener("pointermove", this.onPointerMove);
		this.win.addEventListener("pointerup", this.onPointerUp);
		this.win.addEventListener("pointercancel", this.onPointerUp);
	}

	private detachWindowListeners(): void {
		this.win.removeEventListener("pointermove", this.onPointerMove);
		this.win.removeEventListener("pointerup", this.onPointerUp);
		this.win.removeEventListener("pointercancel", this.onPointerUp);
	}
}
