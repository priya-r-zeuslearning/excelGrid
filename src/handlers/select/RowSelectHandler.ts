import type { EventHandler } from '../EventHandler';
import { Grid } from '../../core/grid';

export class RowSelectHandler implements EventHandler {
  private grid: Grid;
  private dragStartRow: number | null = null;
  private dragStartMouse: { x: number; y: number } | null = null;
  private isRowHeaderDragActive: boolean = false;
  private rowHeaderDragged: boolean = false;

  private rowSelectionAnchor: number | null = null;
  private rowSelectionFocus: number | null = null;

  private autoScrollDirection: 'up' | 'down' | null = null;
  private autoScrollAnimationFrameId: number | null = null;
  private lastPointerMoveEvent: MouseEvent | null = null;

  constructor(grid: Grid) { this.grid = grid; }

  /**
   * Stops any auto-scrolling that is currently happening.
   * @private
   */
  private stopAutoScroll(): void {
    if (this.autoScrollAnimationFrameId !== null) {
      cancelAnimationFrame(this.autoScrollAnimationFrameId);
      this.autoScrollAnimationFrameId = null;
    }
    this.autoScrollDirection = null;
  }

  /**
   * This method is called when the user is dragging a row header selection and needs to scroll the grid.
   * It will scroll the grid by a fixed amount (currently 10px) in the direction of the auto-scrolling.
   * It will also update the selection focus and render the grid.
   * @private
   */
  private scrollStep(): void {
    if (!this.isRowHeaderDragActive || this.autoScrollDirection === null || !this.lastPointerMoveEvent) {
      this.stopAutoScroll();
      return;
    }

    const scrollAmount = 10; // Adjust for desired speed
    const container = this.grid['container'];
    const HEADER_SIZE = 40; // Column header height

    if (this.autoScrollDirection === 'up') {
      container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
    } else if (this.autoScrollDirection === 'down') {
      container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
    }

    const { y: contentY } = this.grid['getMousePos'](this.lastPointerMoveEvent);
    const { row: currentRowIndex } = this.grid['findRowByOffset'](contentY - HEADER_SIZE);
    this.rowSelectionFocus = currentRowIndex;
    this.grid['selMgr'].updateDrag(currentRowIndex, 0);

    const startRow = Math.min(this.rowSelectionAnchor!, this.rowSelectionFocus!);
    const endRow = Math.max(this.rowSelectionAnchor!, this.rowSelectionFocus!);
    const selectedRows: number[] = [];
    for (let r = startRow; r <= endRow; r++) selectedRows.push(r);
    this.grid['selMgr'].setSelectedRows(selectedRows);
    this.grid['scheduleRender']();

    if (this.autoScrollDirection) {
        this.autoScrollAnimationFrameId = requestAnimationFrame(this.scrollStep.bind(this));
    } else {
        this.autoScrollAnimationFrameId = null;
    }
  }

/**
 * Determines if a given point (x, y) is within the row header area of the grid,
 * excluding the column header. This method is used to activate the row selection
 * handler when the pointer is in the designated row header area.
 * 
 * @param x - The x-coordinate of the point to test, relative to the grid.
 * @param y - The y-coordinate of the point to test, relative to the grid.
 * @returns True if the point is within the row header area, false otherwise.
 */

  hitTest(x: number, y: number): boolean {
    const HEADER_SIZE = 40;
    const RESIZE_GUTTER = 5; // Assuming RowResizeHandler has priority for the gutter
    if (x < HEADER_SIZE && y >= HEADER_SIZE) {
        const { within } = this.grid['findRowByOffset'](y - HEADER_SIZE);
      return true;
    }
    return false;
  }

  /**
   * Handles pointer down events on the row header area. If the pointer is within
   * the row header area, finish any active editing, clear any column selections,
   * set the row selection anchor and focus to the row at the pointer position,
   * and set the pending edit cell to the topmost cell of the row.
   * 
   * @param evt The pointer down event.
   */
  onPointerDown(evt: MouseEvent): void {
    if (this.grid['editorInput'] && this.grid['editingCell']) {
      this.grid['finishEditing'](true);
    }

    const { y: contentY } = this.grid['getMousePos'](evt);
    const HEADER_SIZE = 40;
    const { row: rowIndex } = this.grid['findRowByOffset'](contentY - HEADER_SIZE);

    this.isRowHeaderDragActive = true;
    this.rowHeaderDragged = false;
    this.dragStartRow = rowIndex;
    this.rowSelectionAnchor = rowIndex;
    this.rowSelectionFocus = rowIndex;
    this.dragStartMouse = { x: evt.clientX, y: evt.clientY };

    this.grid['selMgr'].clearSelectedColumns();
    (this.grid as any).pendingEditCell = { row: rowIndex, col: 0 };
  }

/**
 * Handles pointer move events on the row header area. This function updates the
 * cursor style to 'grab' if the pointer is within the row header but not in the
 * resize gutter area. If the pointer is in the resize gutter area, the 
 * RowResizeHandler will handle the cursor style change.
 * 
 * @param evt - The pointer move event.
 */

  onPointerMove(evt: MouseEvent): void {
    const rect = (evt.target as HTMLElement).getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    const HEADER_SIZE = 40;
    const RESIZE_GUTTER = 5;

    if (mouseX < HEADER_SIZE && mouseY >= HEADER_SIZE) {
        const { row, within } = this.grid['findRowByOffset'](mouseY - HEADER_SIZE);
        if (within < this.grid['rowMgr'].getHeight(row) - RESIZE_GUTTER) {
             this.grid['canvas'].style.cursor = 'grab';
        }
        // If it IS a resize gutter, RowResizeHandler.onPointerMove will set row-resize
    }
  }

/**
 * Handles pointer drag events on the row header area. Initiates row selection
 * drag if the drag threshold is surpassed. Updates the drag selection and
 * manages auto-scrolling when dragging beyond the visible area.
 * 
 * @param evt - The pointer drag event.
 */

  onPointerDrag(evt: MouseEvent): void {
    if (!this.isRowHeaderDragActive || this.dragStartRow === null) {
      this.stopAutoScroll();
      return;
    }
    this.lastPointerMoveEvent = evt;

    const { y: contentY } = this.grid['getMousePos'](evt);
    const HEADER_SIZE = 40; // Column header height
    const { row: currentRowIndex } = this.grid['findRowByOffset'](contentY - HEADER_SIZE);

    if (!this.grid['selMgr'].isDragging() && this.dragStartMouse) {
      const dy = Math.abs(evt.clientY - this.dragStartMouse.y);
      if (dy > 2) {
        this.grid['selMgr'].startDrag(this.dragStartRow, 0);
        this.grid['selMgr'].clearSelectedRows();
        this.grid['selMgr'].addSelectedRow(this.dragStartRow);
        this.rowHeaderDragged = true;
      }
    }

    if (this.grid['selMgr'].isDragging()) {
      this.rowSelectionFocus = currentRowIndex;
      this.grid['selMgr'].updateDrag(currentRowIndex, 0);

      const startRow = Math.min(this.rowSelectionAnchor!, this.rowSelectionFocus!);
      const endRow = Math.max(this.rowSelectionAnchor!, this.rowSelectionFocus!);
      const selectedRows: number[] = [];
      for (let r = startRow; r <= endRow; r++) selectedRows.push(r);
      this.grid['selMgr'].setSelectedRows(selectedRows);
      this.grid['scheduleRender']();

      // Auto-scroll logic
      const rect = this.grid['canvas'].getBoundingClientRect();
      const mouseYCanvas = evt.clientY - rect.top;
      const edgeThreshold = 35;
      const clientHeight = this.grid['canvas'].clientHeight;

      let newScrollDirection: 'up' | 'down' | null = null;
      if (mouseYCanvas > clientHeight - edgeThreshold && mouseYCanvas <= clientHeight) {
        newScrollDirection = 'down';
      } else if (mouseYCanvas < edgeThreshold && mouseYCanvas >= 0) {
        newScrollDirection = 'up';
      }

      if (newScrollDirection) {
        this.autoScrollDirection = newScrollDirection;
        if (this.autoScrollAnimationFrameId === null) {
          this.scrollStep();
        }
      } else {
        this.stopAutoScroll();
      }
    } else {
      this.stopAutoScroll();
    }
  }

  /**
   * Pointer up event handler.
   * This is called when the user is no longer clicking/dragging.
   * If the user was dragging a row header, this will either select the row or end the drag.
   * Clears the row header drag state and updates the grid.
   * @param evt The mouse event.
   */
  onPointerUp(evt: MouseEvent): void {
    this.stopAutoScroll();

    if (!this.isRowHeaderDragActive) return;

    if (!this.rowHeaderDragged && this.dragStartRow !== null) {
      this.grid['selMgr'].selectRow(this.dragStartRow);
      this.grid['selMgr'].clearSelectedRows();
      this.grid['selMgr'].addSelectedRow(this.dragStartRow);
    } else if (this.grid['selMgr'].isDragging()) {
      this.grid['selMgr'].endDrag();
      // (this.grid as any).pendingEditCell = null;
    }

    this.grid['scheduleRender']();
    this.grid['computeSelectionStats']();
    this.grid['updateToolbarState']();

    this.isRowHeaderDragActive = false;
    this.rowHeaderDragged = false;
    this.dragStartRow = null;
    this.dragStartMouse = null;
    this.rowSelectionAnchor = null;
    this.rowSelectionFocus = null;
  }
}