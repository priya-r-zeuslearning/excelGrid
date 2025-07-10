import { HeaderResizeHandlerBase } from "./HeaderResizeHandlerBase";
import { Grid } from "../../core/grid";
import { ResizeRowCommand } from "../../commands/ResizeRowCommand";
import { CompositeCommand } from "../../commands/CompositeCommand";

export class RowResizeHandler extends HeaderResizeHandlerBase {
  constructor(grid: Grid) {
    super(grid);
  }

  /**
   * @param x Canvas-relative x position of the pointer
   * @param y Canvas-relative y position of the pointer
   * @returns Whether the pointer is in the row resize hotspot
   */
  hitTest(x: number, y: number): boolean {
    // x, y are canvas offsetX, offsetY
    const HEADER_SIZE = 40; // Column header height
    const RESIZE_GUTTER = 5;
    if (x < (this.grid as any).rowHeaderWidth && y >= HEADER_SIZE) {
      const contentRelativeY =
        y + this.grid["container"].scrollTop - HEADER_SIZE;
      const { row, within } = this.grid["findRowByOffset"](contentRelativeY);
      return within >= this.grid["rowMgr"].getHeight(row) - RESIZE_GUTTER;
    }
    return false;
  }

  /**
   * Returns the row index of the row that the user is currently hovering over,
   * by finding the row at the pointer's y position (relative to the grid's
   * content area).
   * @param evt The mouse event
   * @returns The row index
   */
  protected getIndex(evt: MouseEvent): number {
    const { y } = this.grid["getMousePos"](evt);
    const { row } = this.grid["findRowByOffset"](y - 40);
    return row;
  }

  /**
   * @param contentMouseX Canvas-relative x position of the pointer
   * @param contentMouseY Canvas-relative y position of the pointer, relative to the grid's content area
   * @returns The y position relative to the top of the row where the pointer is.
   * This is used to determine the row that should be resized.
   */
  protected getWithin(contentMouseX: number, contentMouseY: number): number {
    // contentMouseY is already relative to the grid's content area (after headers)
    // We need to subtract the header size before passing to findRowByOffset.
    const { row, within } = this.grid["findRowByOffset"](
      contentMouseY - this.getHeaderSize()
    );
    return within;
  }

  /**
   * @returns The height of the row header bar.
   */
  protected getHeaderSize(): number {
    return 40;
  }
  /**
   * Returns the size of the row resize gutter in pixels.
   * @returns The row resize gutter size in pixels.
   */
  protected getResizeGutter(): number {
    return 5;
  }
  /**
   * Returns an object that provides row height data for the row resize
   * handler.
   * @returns An object with a single method, `getSize(row: number)`,
   * which returns the height of the given row.
   */
  protected getManager(): any {
    return {
      getSize: (row: number) => this.grid["rowMgr"].getHeight(row),
    };
  }
  /**
   * Retrieves an array of indices representing the selected rows.
   * @returns An array containing the indices of the selected rows.
   */

  protected getSelected(): number[] {
    return this.grid["selMgr"].getSelectedRows();
  }
  /**
   * Retrieves a command that resizes a row by a specified amount.
   * @param idx The row index to be resized.
   * @param from The original height of the row.
   * @param to The new height of the row.
   * @returns A ResizeRowCommand that can be executed to resize the row.
   */
  protected getResizeCommand(idx: number, from: number, to: number): any {
    return new ResizeRowCommand(this.grid, idx, from, to);
  }
  /**
   * Retrieves a composite command that contains all the row resize commands given as an argument.
   * @param cmds An array of row resize commands.
   * @returns A CompositeCommand that contains all the given commands.
   */
  protected getCompositeCommand(cmds: any[]): any {
    return new CompositeCommand(cmds);
  }
  /**
   * @returns The minimum size in pixels that a row can be resized to.
   */
  protected getMinSize(): number {
    return 20;
  }
/**
 * Returns the cursor style to be used when resizing rows.
 * @returns A string representing the cursor style, specifically "row-resize".
 */

  protected getCursor(): string {
    return "row-resize";
  }
  /**
   * Calculates the difference in the Y coordinate from the start of the drag to the current position.
   * @param evt The mouse event containing the current drag position.
   * @returns The difference in Y coordinate from the starting drag position.
   */

  protected getDragDelta(evt: MouseEvent): number {
    const { y: currentContentY } = this.grid["getMousePos"](evt);
    return currentContentY - this.dragStartCoord;
  }
  /**
   * Sets the height of the row at the specified index to the specified size.
   * @param idx The row index to be resized.
   * @param size The new height of the row.
   */
  protected setSize(idx: number, size: number): void {
    this.grid["rowMgr"].setHeight(idx, size);
  }

  /**
   * Updates the position of the editor input element. This is called after the user has stopped resizing a row.
   */
  protected updateEditorPosition(): void {
    this.grid["updateEditorPosition"]();
  }

  /**
   * Gets the content-relative Y coordinate of the starting drag position.
   * @param evt The mouse event that started the drag.
   * @returns The content-relative Y coordinate of the starting drag position.
   */
  protected getDragStartCoord(evt: MouseEvent): number {
    // Use content-relative Y coordinate for starting drag
    const { y } = this.grid["getMousePos"](evt);
    return y;
  }
}
