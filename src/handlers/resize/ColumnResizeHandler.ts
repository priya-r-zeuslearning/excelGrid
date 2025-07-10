import { HeaderResizeHandlerBase } from "./HeaderResizeHandlerBase";
import { Grid } from "../../core/grid";
import { ResizeColumnCommand } from "../../commands/ResizeColumnCommand";
import { CompositeCommand } from "../../commands/CompositeCommand";

export class ColumnResizeHandler extends HeaderResizeHandlerBase {
  constructor(grid: Grid) {
    super(grid);
  }

  /**
   * Determines if the pointer is within the column resize hotspot
   * @param x Canvas-relative x position of the pointer
   * @param y Canvas-relative y position of the pointer
   * @returns Whether the pointer is in the column resize hotspot
   */
  hitTest(x: number, y: number): boolean {
    const HEADER_SIZE = 40,
      RESIZE_GUTTER = 5;

    if (y < HEADER_SIZE && x >= HEADER_SIZE) {
      const contentRelativeX =
        x + this.grid["container"].scrollLeft - this.grid["rowHeaderWidth"];
      const { col, within } = this.grid["findColumnByOffset"](contentRelativeX);
      return within >= this.grid["colMgr"].getWidth(col) - RESIZE_GUTTER;
    }
    return false;
  }

  /**
   * Determines the column index of a mouse event.
   * Utilizes the mouse position relative to the grid's content area
   * to calculate the column index by accounting for the row header width.
   * @param evt - The mouse event containing the position information.
   * @returns The index of the column under the mouse event.
   */

  protected getIndex(evt: MouseEvent): number {
    const { x: contentMouseX } = this.grid["getMousePos"](evt);
    // findColumnByOffset expects offset from the start of the column area (after row headers)
    const currentGridRowHeaderWidth = this.grid.getRowHeaderWidth();

    const { col } = this.grid["findColumnByOffset"](
      contentMouseX - currentGridRowHeaderWidth
    );
    console.log("column", col);
    return col;
  }

/**
 * Calculates the horizontal position of the mouse pointer within a column.
 * 
 * @param contentMouseX - The x-coordinate of the mouse pointer, relative to the scrollable content origin.
 * @param contentMouseY - The y-coordinate of the mouse pointer, provided for interface consistency.
 * @returns The distance in pixels from the left edge of the column to the mouse pointer.
 */

  protected getWithin(contentMouseX: number, contentMouseY: number): number {
    const currentGridRowHeaderWidth = this.grid.getRowHeaderWidth();
    const { col, within } = this.grid["findColumnByOffset"](
      contentMouseX - currentGridRowHeaderWidth
    );
    return within;
  }

/**
 * @returns The height of the column header bar in pixels.
 */

  protected getHeaderSize(): number {
    return 40;
  } // This is the height of the column header bar
  /**
   * @returns The size of the column resize gutter in pixels.
   */
  protected getResizeGutter(): number {
    return 5;
  }
  /**
   * @returns An object with a single method, `getSize(col: number)`,
   * which returns the width of the given column.
   */
  protected getManager(): any {
    return {
      getSize: (col: number) => this.grid["colMgr"].getWidth(col),
    };
  }
  /**
   * Gets the currently selected columns.
   * @returns an array of column indices that are currently selected.
   */
  protected getSelected(): number[] {
    return this.grid["selMgr"].getSelectedColumns();
  }
  /**
   * Retrieves a command that resizes a column by a specified amount.
   * @param idx The column index to be resized.
   * @param from The original width of the column.
   * @param to The new width of the column.
   * @returns A ResizeColumnCommand that can be executed to resize the column.
   */
  protected getResizeCommand(idx: number, from: number, to: number): any {
    return new ResizeColumnCommand(this.grid, idx, from, to);
  }
/**
 * Retrieves a composite command that aggregates multiple resize commands.
 * @param cmds An array of individual resize commands to be combined.
 * @returns A CompositeCommand instance that encapsulates all the provided commands.
 */

  protected getCompositeCommand(cmds: any[]): any {
    return new CompositeCommand(cmds);
  }
  /**
   * @returns The minimum width in pixels that a column can be resized to.
   * This limit ensures that the column header text remains visible.
   */
  protected getMinSize(): number {
    return 40;
  }
/**
 * @returns The cursor style to be used for column resizing.
 */

  protected getCursor(): string {
    return "col-resize";
  }
/**
 * Calculates the distance the mouse has been dragged horizontally since the drag start.
 * @param evt The mouse event containing the current mouse position.
 * @returns The horizontal drag distance in pixels from the starting drag position.
 */

  protected getDragDelta(evt: MouseEvent): number {
    const { x: currentContentX } = this.grid["getMousePos"](evt);
    return currentContentX - this.dragStartCoord;
  }
  /**
   * Sets the width of a column to the specified size in pixels.
   * @param idx - The index of the column to resize.
   * @param size - The new width of the column in pixels.
   */
  protected setSize(idx: number, size: number): void {
    this.grid["colMgr"].setWidth(idx, size);
  }
  /**
   * Calls the grid's `updateEditorPosition` method to reposition the input element during resizing.
   */
  protected updateEditorPosition(): void {
    this.grid["updateEditorPosition"]();
  }
  /**
   * Gets the content-relative X coordinate of the starting drag position.
   * @param evt The mouse event that started the drag.
   * @returns The content-relative X coordinate of the starting drag position.
   */
  protected getDragStartCoord(evt: MouseEvent): number {
    // Use content-relative X coordinate for starting drag
    const { x } = this.grid["getMousePos"](evt);
    return x;
  }
}
