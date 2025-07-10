import type { EventHandler } from "../EventHandler";
import { Grid } from "../../core/grid";

export class CellSelectHandler implements EventHandler {
  private grid: Grid;
  private dragStartCellCoords: { row: number; col: number } | null = null; // Renamed from dragStart
  private dragStartMouseCoords: { x: number; y: number } | null = null; // Renamed from dragStartMouse
  private isCellDragging: boolean = false; // Tracks if cell selection drag is active
  private autoScrollAnimationFrameId: number | null = null;
  private lastPointerMoveEvent: MouseEvent | null = null;
  private autoScrollDirection: { x: -1 | 0 | 1; y: -1 | 0 | 1 } | null = null;

  /**
   * Creates a new CellSelectHandler.
   * @param grid - The {@link Grid} that this handler operates on.
   */
  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * hitTest determines if a pointer event is within the cell selection area.
   * @param x - The x-coordinate of the pointer event.
   * @param y - The y-coordinate of the pointer event.
   * @returns `true` if the event is in the cell selection area, `false` otherwise.
   */
  hitTest(x: number, y: number): boolean {
    const HEADER_SIZE = 40;
    // Ensures this handler only activates if the click is in the data area
    return x >= HEADER_SIZE && y >= HEADER_SIZE;
  }

  /**
   * onPointerDown is called when a pointer is pressed down.
   * @param evt The event associated with the pointer down.
   *
   * If the pointer is in the cell area, this handler will clear any existing
   * row and column selections and select the cell at the pointer location.
   * It will also set a pending edit cell at the pointer location.
   *
   * If the pointer is not in the cell area, this handler will do nothing.
   */
  onPointerDown(evt: MouseEvent): void {
    if (this.grid["editorInput"] && this.grid["editingCell"]) {
      this.grid["finishEditing"](true);
    }

    const { x: contentX, y: contentY } = this.grid["getMousePos"](evt);
    const HEADER_SIZE = 40;
    const { row } = this.grid["findRowByOffset"](contentY - HEADER_SIZE);
    const { col } = this.grid["findColumnByOffset"](contentX - HEADER_SIZE);

    if (evt.button === 0) {
      // Left click
      this.grid["selMgr"].clearSelectedRows();
      this.grid["selMgr"].clearSelectedColumns();
      this.grid["selMgr"].selectCell(row, col);

      this.isCellDragging = true; // Indicates a potential drag start
      this.dragStartCellCoords = { row, col };
      this.dragStartMouseCoords = { x: evt.clientX, y: evt.clientY };
      (this.grid as any).pendingEditCell = { row, col }; // Set pending edit cell on grid

      this.grid["scheduleRender"]();
    }
  }

  /**
   * Called when the pointer is moved over the grid.
   *
   * This method sets the cursor style to 'cell' if the pointer is within the data area of the grid.
   * It relies on the EventRouter to invoke this method when the hitTest method returns true.
   * If another handler with higher priority, such as a resize handler, also returns true for a part
   * of the same area, that handler's cursor style will take precedence.
   *
   * @param evt The MouseEvent associated with the pointer movement.
   */

  onPointerMove(evt: MouseEvent): void {
    const rect = (evt.target as HTMLElement).getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    if (this.hitTest(mouseX, mouseY)) {
      // Use own hitTest to be sure
      this.grid["canvas"].style.cursor = "cell";
    }
  }
private scrollStep(): void {
  if (
    !this.isCellDragging ||
    this.autoScrollDirection === null ||
    !this.lastPointerMoveEvent
  ) {
    this.stopAutoScroll();
    return;
  }

  const scrollAmount = 20;
  const container = this.grid["container"];

  // Scroll left/right
  if (this.autoScrollDirection.x === -1) {
    container.scrollLeft = Math.max(0, container.scrollLeft - scrollAmount);
  } else if (this.autoScrollDirection.x === 1) {
    container.scrollLeft = Math.min(
      container.scrollWidth - container.clientWidth,
      container.scrollLeft + scrollAmount
    );
  }

  // Scroll up/down
  if (this.autoScrollDirection.y === -1) {
    container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
  } else if (this.autoScrollDirection.y === 1) {
    container.scrollTop = Math.min(
      container.scrollHeight - container.clientHeight,
      container.scrollTop + scrollAmount
    );
  }

  // Recalculate selection
  const { x: contentX, y: contentY } = this.grid["getMousePos"](this.lastPointerMoveEvent);
  const HEADER_SIZE = 40;
  const { col } = this.grid["findColumnByOffset"](contentX - HEADER_SIZE);
  const { row } = this.grid["findRowByOffset"](contentY - HEADER_SIZE);

  this.grid["selMgr"].updateDrag(row, col);
  this.grid["scheduleRender"]();

  this.autoScrollAnimationFrameId = requestAnimationFrame(this.scrollStep.bind(this));
}
private stopAutoScroll(): void {
  if (this.autoScrollAnimationFrameId !== null) {
    cancelAnimationFrame(this.autoScrollAnimationFrameId);
    this.autoScrollAnimationFrameId = null;
  }
  this.autoScrollDirection = null;
}

  /**
   * Handles the drag event while dragging a cell selection.
   * @param evt - The MouseEvent associated with the pointer drag.
   */

onPointerDrag(evt: MouseEvent): void {
  if (
    !this.isCellDragging ||
    !this.dragStartCellCoords ||
    !this.dragStartMouseCoords
  ) return;

  // Save the latest pointer event for auto-scroll logic
  this.lastPointerMoveEvent = evt;

  const HEADER_SIZE = 40;
  const { x: contentX, y: contentY } = this.grid["getMousePos"](evt);

  // Detect drag threshold before starting drag
  if (!this.grid["selMgr"].isDragging()) {
    const dx = Math.abs(evt.clientX - this.dragStartMouseCoords.x);
    const dy = Math.abs(evt.clientY - this.dragStartMouseCoords.y);
    if (dx > 2 || dy > 2) {
      this.grid["selMgr"].startDrag(
        this.dragStartCellCoords.row,
        this.dragStartCellCoords.col
      );
    }
  }

  // If dragging is active, update selection and scroll
  if (this.grid["selMgr"].isDragging()) {
    const { col } = this.grid["findColumnByOffset"](contentX - HEADER_SIZE);
    const { row } = this.grid["findRowByOffset"](contentY - HEADER_SIZE);
    this.grid["selMgr"].updateDrag(row, col);

    // Scroll to the cell if necessary
    if (typeof this.grid["scrollToCell"] === "function") {
      this.grid["scrollToCell"](row, col);
    }

    // Schedule a render to update the grid view
    this.grid["scheduleRender"]();
  }

  // Handle auto-scroll if near edges
  const edgeThreshold = 30;
  const container = this.grid["container"];
  const rect = container.getBoundingClientRect();

  const dir: { x: -1 | 0 | 1; y: -1 | 0 | 1 } = { x: 0, y: 0 };

  if (evt.clientX < rect.left + edgeThreshold) dir.x = -1;
  else if (evt.clientX > rect.right - edgeThreshold) dir.x = 1;

  if (evt.clientY < rect.top + edgeThreshold) dir.y = -1;
  else if (evt.clientY > rect.bottom - edgeThreshold) dir.y = 1;

  if (dir.x !== 0 || dir.y !== 0) {
    this.autoScrollDirection = dir;
    if (this.autoScrollAnimationFrameId === null) {
      this.autoScrollAnimationFrameId = requestAnimationFrame(this.scrollStep.bind(this));
    }
  } else {
    this.autoScrollDirection = null;
  }
}


  /**
   * Called when pointer is lifted.
   * If the selection manager is dragging, end the drag and render the selection.
   * If the selection manager is not dragging, ensure single click selection is rendered.
   * In either case, compute statistics and update the toolbar state.
   * Reset this handler's state for the next click.
   * @param evt - The MouseEvent associated with the pointer up.
   */
  onPointerUp(evt: MouseEvent): void {
    if (!this.isCellDragging) return;

    if (this.grid["selMgr"].isDragging()) {
      this.grid["selMgr"].endDrag();
      this.grid["scheduleRender"]();
      this.grid["computeSelectionStats"]();
      this.grid["updateToolbarState"]();
    } else {
      this.grid["scheduleRender"](); // Ensure single click selection is rendered
      this.grid["computeSelectionStats"]();
      this.grid["updateToolbarState"]();
    }

    // Reset state for this handler
    this.isCellDragging = false;
    this.dragStartCellCoords = null;
    this.dragStartMouseCoords = null;
  }
}
