// imports
import { Cell } from "./cell";
import { RowManager } from "./RowManager";
import { ColumnManager } from "./ColumnManager";
import { SelectionManager } from "./Selection";
import { CommandManager } from "../commands/CommandManager";
import { EditCellCommand } from "../commands/EditCellCommand";
import { ResizeColumnCommand } from "../commands/ResizeColumnCommand";
import { ResizeRowCommand } from "../commands/ResizeRowCommand";
import { FontSizeCommand } from "../commands/FontSizeCommand";
import { BoldCommand } from "../commands/BoldCommand";
import { ItalicCommand } from "../commands/ItalicCommand";
import { Aggregator } from "./Aggregator";
import { evaluateFormula } from "../formulas/FormulaEvaluator";
import { getCoordinates } from "../utils/CellRange";
import { PasteCommand } from "../commands/PasteCommand";
import { CompositeCommand } from "../commands/CompositeCommand";
import { ClipboardManager } from "../commands/ClipboardManager";
import { AlignmentCommand } from "../commands/AlignmentCommand";
import { InsertRowCommand } from "../commands/InsertRowCommand";
import { DeleteRowCommand } from "../commands/DeleteRowCommand";
import { InsertColumnCommand } from "../commands/InsertColumnCommand";
import { DeleteColumnCommand } from "../commands/DeleteColumnCommand";
import { EventRouter } from '../handlers/EventRouter';
import { ColumnResizeHandler } from '../handlers/resize/ColumnResizeHandler';
import { RowResizeHandler } from '../handlers/resize/RowResizeHandler';
import { HeaderDragHandler } from '../handlers/drag/HeaderDragHandler';
import { CellSelectHandler } from '../handlers/select/CellSelectHandler';
import { RowSelectHandler } from '../handlers/select/RowSelectHandler';
import { SelectAllHandler } from '../handlers/select/SelectAllHandler';


/**
 * Default sizes used by managers on first construction.
 */
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 30;

export const ROWS = 100_500;
export const COLS = 5001;

/** How many extra rows / columns to draw outside the viewport */
const RENDER_BUFFER_PX = 200;

/** Size of the header band (row numbers / column letters) */
const HEADER_SIZE = 40;

/** How many pixels near an edge counts as a "resize hotspot" */
// const RESIZE_GUTTER = 5;
let dpr = window.devicePixelRatio || 1;
/**
 * @class Grid
 * @classdesc Manages rendering, selection, editing, and resizing of a spreadsheet-like canvas grid.
 * Supports virtual scrolling, cell editing, selection, and data import.
 */
export class Grid {
  /** @type {HTMLCanvasElement} The canvas element for rendering the grid. */
  private readonly canvas: HTMLCanvasElement;
  /** @type {CanvasRenderingContext2D} The 2D rendering context for the canvas. */
  private readonly ctx: CanvasRenderingContext2D;
  /** @type {RowManager} Manages row heights and operations. */
  public readonly rowMgr: RowManager;
  /** @type {ColumnManager} Manages column widths and operations. */
  public readonly colMgr: ColumnManager;
  /** @type {SelectionManager} Manages selection state and drawing. */
  private readonly selMgr: SelectionManager;
  /**@type {number} Specifies the width of the row Header that changes based on the label */
  private rowHeaderWidth: number = 40;
  /** @type {Map} cells which are map of maps  */
  public cells: Map<number, Map<number, Cell>> = new Map();
  /** @type {HTMLInputElement|null} The input element for cell editing. */
  private editorInput: HTMLInputElement | null = null;
  /** @type {{row: number, col: number}|null} The currently editing cell. */
  private editingCell: { row: number; col: number } | null = null;
  /** @type {HTMLElement} The scrollable container for the grid. */
  private container: HTMLElement;
  /** @type {boolean} Suppresses rendering during batch updates. */
  private suppressRender: boolean = false;
  /** @type {boolean} Whether a render is scheduled. */
  private renderScheduled: boolean = false;
  // /** @type {boolean} Whether the mouse is currently down for drag selection. */
  // private isMouseDown: boolean = false; // Moved to handlers
  // /** @type {boolean} Whether the mouse is currently dragging on column headers. */
  // private isColHeaderDrag: boolean = false; // Moved to HeaderDragHandler
  // /** @type {{row: number, col: number}|null} The cell where drag selection started. */
  // private dragStartCell: { row: number; col: number } | null = null; // Moved to CellSelectHandler
  // /** @type {number|null} The column where column header drag started. */
  // private dragStartColHeader: number | null = null; // Moved to HeaderDragHandler
  // /** @type {{x: number, y: number}|null} The position where drag selection started. */
  // private dragStartMouse: { x: number; y: number } | null = null; // Moved to handlers
  // /** @type {number|null} The row being resized, if any. */
  // private resizingRow: number | null = null; // Managed by RowResizeHandler
  // /** @type {number} The X position where a drag or resize started. */
  // private dragStartX: number = 0; // Managed by resize handlers
  // /** @type {number} The Y position where a drag or resize started. */
  // private dragStartY: number = 0; // Managed by resize handlers
  // /** @type {number} The original size (width/height) before resizing. */
  // private originalSize: number = 0; // Managed by resize handlers
  private commandManager: CommandManager = new CommandManager();
  // // Add these properties to track resize operations
  // /** @type {any} command for resizing */
  // private currentResizeCommand: any = null; // Managed by resize handlers
  // /** @type {boolean} determines if resizing is currently happenning or not */
  // private isResizing: boolean = false; // Managed by resize handlers
  /** @type {number} the offest used in marching ants */
  private dashOffset: number = 0;
  /** @type {{startRow:number, startCol: number, endRow: number, endCol: number}|null} hold the range of data for whose calculations are to be made*/
  private formulaRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null = null;
  /** @type {number|null} id of the animation returned by requestAnimationFrame */
  private animationId: number | null = null;
  /** @type {Cell|null} saves the current cell which is being edited */
  private editingCellInstance: Cell | null = null;

  // /** @type {number|null} The column being resized, if any. */
  // private resizingCol: number | null = null; // Managed by ColumnResizeHandler

  // // Helper flag to track if header drag has moved
  // /** @type {boolean} Whether the column header drag has moved. */
  // private _colHeaderDragHasDragged: boolean = false; // Moved to HeaderDragHandler (as colHeaderDragged)

  // /** @type {boolean} Whether the mouse is currently dragging on row headers. */
  // private isRowHeaderDrag: boolean = false; // Moved to RowSelectHandler (as isRowHeaderDragActive)
  // /** @type {number|null} The row where row header drag started. */
  // private dragStartRowHeader: number | null = null; // Moved to RowSelectHandler
  // // Helper flag to track if row header drag has moved
  // /** @type {boolean} Whether the row header drag has moved. */
  // private _rowHeaderDragHasDragged: boolean = false; // Moved to RowSelectHandler (as rowHeaderDragged)

  // Track hover state for top-left box
  /** @type {boolean} Whether the top-left box is hovered. */
  private _isTopLeftHovered: boolean = false;

  /** @type {string[][]|null} The clipboard data. */
  private clipboard: string[][] | null = null;

  /** @type {number|null} The column selection anchor. */
  private columnSelectionAnchor: number | null = null;
  /** @type {number|null} The column selection focus. */
  private columnSelectionFocus: number | null = null;

  /** @type {number|null} The row selection anchor. */
  private rowSelectionAnchor: number | null = null;
  /** @type {number|null} The row selection focus. */
  private rowSelectionFocus: number | null = null;

  /** @type {number} The last render time. */
  private _lastRenderTime: number = 0;
  /**
   * Shifts cells to the right.
  /**
   * Throttles the schedule render.
   */
  // private throttledScheduleRender(): void {
  //   const now = performance.now();
  //   if (now - this._lastRenderTime > 16) {
  //     // ~60fps
  //     this._lastRenderTime = now;
  //     this.scheduleRender();
  //   }
  // }

  // Add this property to the class:
  /** @type {{row: number, col: number}|null} The pending edit cell. */
  private pendingEditCell: { row: number; col: number } | null = null;

  private eventRouter: EventRouter;
  private columnResizeHandler: ColumnResizeHandler;
  private rowResizeHandler: RowResizeHandler;
  private headerDragHandler: HeaderDragHandler;
  private rowSelectHandler: RowSelectHandler;
  private cellSelectHandler: CellSelectHandler;
  private selectAllHandler: SelectAllHandler;

  /* ─────────────────────────────────────────────────────────────────── */
  /**
   * Initializes the Grid.
   * @param {HTMLCanvasElement} canvas The canvas element to render on.
   */
  constructor(canvas: HTMLCanvasElement) {
    /* Canvas / context */
    this.canvas = canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not supported");
    this.ctx = ctx;

    this.container = document.getElementById("canvas-container")!;

    const rect = this.canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const fakeScrollDiv = document.createElement("div");
    fakeScrollDiv.style.height = ROWS * DEFAULT_ROW_HEIGHT + "px";
    fakeScrollDiv.style.width = COLS * DEFAULT_COL_WIDTH + "px";
    this.container.appendChild(fakeScrollDiv);

    const filler = document.getElementById("scroll-filler")!;

    this.container.addEventListener("scroll", () => {
      this.updateEditorPosition();
      this.scheduleRender();
    });
    window.addEventListener("resize", () => {
      this.updateEditorPosition();
      this.resizeCanvas();
    });

    this.rowMgr = new RowManager(ROWS, DEFAULT_ROW_HEIGHT);
    this.colMgr = new ColumnManager(COLS, DEFAULT_COL_WIDTH);
    this.selMgr = new SelectionManager();
    const virtualHeight = this.rowMgr.getTotalHeight();
    const virtualWidth = this.colMgr.getTotalWidth();
    filler.style.height = virtualHeight + "px";
    filler.style.width = virtualWidth + "px";
    this.canvas.style.cursor ="cell"
    this.columnResizeHandler = new ColumnResizeHandler(this);
    this.rowResizeHandler = new RowResizeHandler(this);
    this.columnResizeHandler = new ColumnResizeHandler(this);
    this.rowResizeHandler = new RowResizeHandler(this);
    this.selectAllHandler = new SelectAllHandler(this); // Instantiate SelectAllHandler
    this.headerDragHandler = new HeaderDragHandler(this);
    this.rowSelectHandler = new RowSelectHandler(this);
    this.cellSelectHandler = new CellSelectHandler(this);
    this.eventRouter = new EventRouter([

      this.selectAllHandler,
      this.columnResizeHandler,
      this.rowResizeHandler,
      this.headerDragHandler, // Handles column header click/drag for selection
      this.rowSelectHandler,   // Handles row header click/drag for selection
      this.cellSelectHandler,
    ]);

    this.addEventListeners();
    this.resizeCanvas();
    // Log the number of created cells at startup
  // console.log("Cells created at startup:", this.countCreatedCells());

    // Clean up animation when window loses focus
    window.addEventListener("blur", () => {
      this.stopMarchingAntsAnimation();
    });
  }

  private resizeCanvas(): void {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    dpr = window.devicePixelRatio
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderScheduled || this.suppressRender) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.render();
      this.renderScheduled = false;
    });
  }

  /**
   * Initializes the cell storage for the grid.
   */

  /**
   * Gets the cell object at the specified row and column, or null if it doesn't exist.
   * @param {number} row The row index.
   * @param {number} col The column index.
   * @returns {Cell|null} The cell object or null if not present.
   */
  private getCellIfExists(row: number, col: number): Cell | null {
    const rowMap = this.cells.get(row);
    if (!rowMap) return null;
    return rowMap.get(col) || null;
  }

  /**
   * Gets the value of the cell at the specified row and column, or an empty string if it doesn't exist.
   * @param {number} row The row index.
   * @param {number} col The column index.
   * @returns {string} The cell value or empty string if not present.
   */
  private getCellValueIfExists(row: number, col: number): string {
    const rowMap = this.cells.get(row);
    if (!rowMap) return "";
    const cell = rowMap.get(col);
    return cell ? cell.getValue() : "";
  }

  /**
   * Adds all event listeners for mouse and keyboard interaction.
   */
  private addEventListeners(): void {
    // Use pointer events for unified input
    this.canvas.addEventListener('pointerdown', (evt) => this.eventRouter.onPointerDown(evt as unknown as MouseEvent));
    this.canvas.addEventListener('pointermove', (evt) => this.eventRouter.onPointerMove(evt as unknown as MouseEvent));
    window.addEventListener('pointermove', (evt) => this.eventRouter.onPointerDrag(evt as unknown as MouseEvent));
    window.addEventListener('pointerup', (evt) => this.eventRouter.onPointerUp(evt as unknown as MouseEvent));
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    const undoButton = document.getElementById("undoBtn")!;
    undoButton.addEventListener("click", this.onUndo.bind(this));
    const redoButton = document.getElementById("redoBtn")!;
    redoButton.addEventListener("click", this.onRedo.bind(this));
    this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this) )

    // Search functionality
    const searchInput = document.getElementById(
      "searchInput"
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener("input", () =>
        this.searchCell(searchInput.value)
      );
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.navigateSearchResults("next");
        } else if (e.key === "Escape") {
          searchInput.value = "";
          this.clearSearch();
          searchInput.blur();
        }
      });
    }

    // Toolbar buttons
    const insertRowBtn = document.getElementById("insertRowBtn")!;
    insertRowBtn.addEventListener("click", this.onInsertRow.bind(this));
    const insertColBtn = document.getElementById("insertColBtn")!;
    insertColBtn.addEventListener("click", this.onInsertColumn.bind(this));
    const deleteRowBtn = document.getElementById("deleteRowBtn")!;
    deleteRowBtn.addEventListener("click", this.onDeleteRow.bind(this));
    const deleteColBtn = document.getElementById("deleteColBtn")!;
    deleteColBtn.addEventListener("click", this.onDeleteColumn.bind(this));

    // Font controls
    const fontSizeSelect = document.getElementById(
      "fontSizeSelect"
    ) as HTMLSelectElement;
    fontSizeSelect.addEventListener("change", this.onFontSizeChange.bind(this));
    const boldBtn = document.getElementById("boldBtn")!;
    boldBtn.addEventListener("click", this.onBoldToggle.bind(this));
    const italicBtn = document.getElementById("italicBtn")!;
    italicBtn.addEventListener("click", this.onItalicToggle.bind(this));

    const alignLeftBtn = document.getElementById("alignLeftBtn");
    if (alignLeftBtn)
      alignLeftBtn.addEventListener("click", () =>
        this.applyAlignmentToSelection("left")
      );
    const alignCenterBtn = document.getElementById("alignCenterBtn");
    if (alignCenterBtn)
      alignCenterBtn.addEventListener("click", () =>
        this.applyAlignmentToSelection("center")
      );
    const alignRightBtn = document.getElementById("alignRightBtn");
    if (alignRightBtn)
      alignRightBtn.addEventListener("click", () =>
        this.applyAlignmentToSelection("right")
      );
  }


  /**
   * Undo event handler
   */
  private onUndo(): void {
    this.commandManager.undo();
    this.scheduleRender();
  }

  /**
   * Redo event handler
   */
  private onRedo(): void {
    this.commandManager.redo();
    this.scheduleRender();
  }

  /**
   * Insert row event handler
   */
  private onInsertRow(): void {
    this.rowSelectionAnchor = null;
    this.rowSelectionFocus = null;
    const selectedRow = this.selMgr.getSelectedRow();
    const selectedCell = this.selMgr.getSelectedCell();
    const insertAt =
      selectedRow !== null ? selectedRow : selectedCell ? selectedCell.row : 0;

    // Use command for undo/redo
    const command = new InsertRowCommand(this, insertAt);
    this.commandManager.execute(command);
    this.scheduleRender();
  }

  /**
   * Insert column event handler
   */
  private onInsertColumn(): void {
    this.columnSelectionAnchor = null;
    this.columnSelectionFocus = null;
    const selectedCol = this.selMgr.getSelectedCol();
    const selectedCell = this.selMgr.getSelectedCell();
    const insertAt =
      selectedCol !== null ? selectedCol : selectedCell ? selectedCell.col : 0;

    // Use command for undo/redo
    const command = new InsertColumnCommand(this, insertAt);
    this.commandManager.execute(command);
    this.scheduleRender();
  }

  /**
   * Delete row event handler
   */
  private onDeleteRow(): void {
    const selectedRow = this.selMgr.getSelectedRow();
    this.rowSelectionAnchor = null;
    this.rowSelectionFocus = null;
    // Only delete if a row is specifically selected
    if (selectedRow === null) {
      return;
    }

    // Ask for confirmation
    const confirmed = confirm(
      `Are you sure you want to delete row ${selectedRow + 1}?`
    );
    if (!confirmed) {
      return;
    }

    if (selectedRow >= 0 && selectedRow < ROWS) {
      // Use command for undo/redo
      const command = new DeleteRowCommand(this, selectedRow);
      this.commandManager.execute(command);
      // Clear selection
      this.selMgr.clearSelection();
      this.scheduleRender();
    }
  }

  /**
   * Delete column event handler
   */
  private onDeleteColumn(): void {
    this.columnSelectionAnchor = null;
    this.columnSelectionFocus = null;
    const selectedCol = this.selMgr.getSelectedCol();
    const selectedCell = this.selMgr.getSelectedCell();
    if (selectedCol === null) {
      return;
    }
    const deleteAt =
      selectedCol !== null ? selectedCol : selectedCell ? selectedCell.col : 0;
    const confirmed = confirm(
      `Are you sure you want to delete column ${deleteAt + 1}?`
    );
    if (!confirmed) {
      return;
    }
    if (deleteAt >= 0 && deleteAt < COLS) {
      // Use command for undo/redo
      const command = new DeleteColumnCommand(this, deleteAt);
      this.commandManager.execute(command);
      // Clear selection
      this.selMgr.clearSelection();
      this.scheduleRender();
    }
  }

  /**
   * Shift cells down
   * @param insertAt - The row to insert at
   */
  public shiftCellsDown(insertAt: number): void {
    // Move all cells from insertAt onwards down by one row
    for (let row = ROWS - 2; row >= insertAt; row--) {
      const rowMap = this.cells.get(row);
      if (rowMap) {
        const newRowMap = new Map();
        for (const [col, cell] of rowMap) {
          const newCell = new Cell(row + 1, col);
          newCell.setValue(cell.getValue());
          newRowMap.set(col, newCell);
        }
        this.cells.set(row + 1, newRowMap);
      }
    }
    // Clear the inserted row (make it empty, don't delete)
    this.cells.set(insertAt, new Map());
  }

  /**
   * Shift cells right
   * @param insertAt - The column to insert at
   */
  public shiftCellsRight(insertAt: number): void {
    // Only process rows that have data
    for (const rowMap of this.cells.values()) {
     
      const cols = Array.from(rowMap.keys()).filter((col) => col >= insertAt);
      cols.sort((a, b) => b - a);
      for (const col of cols) {
        const cell = rowMap.get(col)!;
        rowMap.set(col + 1, new Cell(cell.row, col + 1));
        rowMap.get(col + 1)!.setValue(cell.getValue());
        rowMap.delete(col);
      }
    }
  }

  /**
   * Shift cells up
   * @param deleteAt - The row to delete at
   */
  public shiftCellsUp(deleteAt: number): void {
    // Move all cells from deleteAt + 1 onwards up by one row
    for (let row = deleteAt; row < ROWS - 1; row++) {
      const rowMap = this.cells.get(row + 1);
      if (rowMap) {
        const newRowMap = new Map();
        for (const [col, cell] of rowMap) {
          const newCell = new Cell(row, col);
          newCell.setValue(cell.getValue());
          newRowMap.set(col, newCell);
        }
        this.cells.set(row, newRowMap);
      } else {
        this.cells.delete(row);
      }
    }
    // Clear the last row
    this.cells.delete(ROWS - 1);
  }

  public getRowHeaderWidth(): number {
    return this.rowHeaderWidth;
  }

  /**
   * Shift cells left
   * @param deleteAt - The column to delete at
   */
  public shiftCellsLeft(deleteAt: number): void {
    for (const rowMap of this.cells.values()) {
      // Remove the deleted column first
      rowMap.delete(deleteAt);
      // Find all columns in this row that need to be shifted
      const cols = Array.from(rowMap.keys()).filter((col) => col > deleteAt);
      // Sort ascending so we don't overwrite
      cols.sort((a, b) => a - b);
      for (const col of cols) {
        const cell = rowMap.get(col)!;
        rowMap.set(col - 1, new Cell(cell.row, col - 1));
        rowMap.get(col - 1)!.setValue(cell.getValue());
        rowMap.delete(col);
      }
    }
  }

  /**
   * Mouse down event handler
   * @param evt - The mouse event
   */
  private onMouseDown(evt: MouseEvent): void {
    // Finish editing if a cell is being edited before changing selection
    // if (this.editorInput && this.editingCell) {
    //   this.finishEditing(true);
    // }
    // this.columnSelectionAnchor = null;
    // this.columnSelectionFocus = null;
    // this.rowSelectionAnchor = null;
    // this.rowSelectionFocus = null;
    // // Use event offset for header hit-testing so header resize works when scrolled
    // const rect = this.canvas.getBoundingClientRect();
    // const mouseX = evt.clientX - rect.left;
    // const mouseY = evt.clientY - rect.top;
    // const { x, y } = this.getMousePos(evt);

    // /* 1 Column header area (top header bar) - resize and drag checks */
    // if (mouseY < HEADER_SIZE && mouseX >= HEADER_SIZE) {
    //   const { col, within } = this.findColumnByOffset(x - HEADER_SIZE);
    //   if (within >= this.colMgr.getWidth(col) - RESIZE_GUTTER) {
    //     this.resizingCol = col;
    //     this.dragStartX = evt.clientX;
    //     this.originalSize = this.colMgr.getWidth(col);
    //     this.isResizing = true;
    //     // Composite command for multi-column resize
    //     const selectedCols = this.selMgr.getSelectedColumns();
    //     if (selectedCols.length > 1 && selectedCols.includes(col)) {
    //       const commands = selectedCols.map(
    //         (c) =>
    //           new ResizeColumnCommand(
    //             this,
    //             c,
    //             this.colMgr.getWidth(c),
    //             this.colMgr.getWidth(c)
    //           )
    //       );
    //       this.currentResizeCommand = new CompositeCommand(commands);
    //     } else {
    //       this.currentResizeCommand = new ResizeColumnCommand(
    //         this,
    //         this.resizingCol,
    //         this.originalSize,
    //         this.originalSize
    //       );
    //     }
    //     this.ctx.strokeStyle = "#107C41";
    //     this.ctx.lineWidth = 2 / window.devicePixelRatio;
    //     return;
    //   }
    //   // --- Multi-column drag selection start ---
    //   const { col: colIndex } = this.findColumnByOffset(x - HEADER_SIZE);
    //   this.isColHeaderDrag = true;
    //   this.isMouseDown = true;
    //   this.dragStartColHeader = colIndex;
    //   // Set anchor and focus for mouse drag
    //   this.columnSelectionAnchor = colIndex;
    //   this.columnSelectionFocus = colIndex;
    //   this.pendingEditCell = { row: 0, col: colIndex };
    //   this.dragStartMouse = { x: evt.clientX, y: evt.clientY };
    //   this._colHeaderDragHasDragged = false; // helper flag
    //   // Clear any existing row selections when starting column selection
    //   this.selMgr.clearSelectedRows();
    //   // Do NOT select yet; wait for mouseup or drag
    //   return;
    // }

    // /* 2 Row header area (left header bar) - resize and drag checks */
    // if (mouseX < HEADER_SIZE && mouseY >= HEADER_SIZE) {
    //   const { row, within } = this.findRowByOffset(y - HEADER_SIZE);
    //   if (within >= this.rowMgr.getHeight(row) - RESIZE_GUTTER) {
    //     this.resizingRow = row;
    //     this.dragStartY = evt.clientY;
    //     this.originalSize = this.rowMgr.getHeight(row);
    //     this.isResizing = true;
    //     // Composite command for multi-row resize
    //     const selectedRows = this.selMgr.getSelectedRows();
    //     if (selectedRows.length > 1 && selectedRows.includes(row)) {
    //       const commands = selectedRows.map(
    //         (r) =>
    //           new ResizeRowCommand(
    //             this,
    //             r,
    //             this.rowMgr.getHeight(r),
    //             this.rowMgr.getHeight(r)
    //           )
    //       );
    //       this.currentResizeCommand = new CompositeCommand(commands);
    //     } else {
    //       this.currentResizeCommand = new ResizeRowCommand(
    //         this,
    //         this.resizingRow,
    //         this.originalSize,
    //         this.originalSize
    //       );
    //     }
    //     return;
    //   }
    //   // --- Multi-row drag selection start ---
    //   this.isRowHeaderDrag = true;
    //   this.isMouseDown = true;
    //   this.dragStartRowHeader = row;
    //   // Set anchor and focus for mouse drag
    //   this.rowSelectionAnchor = row;
    //   this.rowSelectionFocus = row;
    //   this.dragStartMouse = { x: evt.clientX, y: evt.clientY };
    //   this._rowHeaderDragHasDragged = false;
    //   this.pendingEditCell = { row: row, col: 0 };
    //   // Clear any existing column selections when starting row selection
    //   this.selMgr.clearSelectedColumns();
    //   // Do NOT select yet; wait for mouseup or drag
    //   return;
    // }

    // /* 3 Data area (including row 0) – start drag selection (or single cell) */
    // if (mouseX >= HEADER_SIZE && mouseY >= HEADER_SIZE) {
    //   const { col } = this.findColumnByOffset(x - HEADER_SIZE);
    //   const { row } = this.findRowByOffset(y - HEADER_SIZE);
    //   if (evt.button === 0) {
    //     // left click
    //     // Clear any existing column/row selections when clicking in data area
    //     this.selMgr.clearSelectedColumns();
    //     this.selMgr.clearSelectedRows();

    //     // Select cell immediately
    //     this.selMgr.selectCell(row, col);
    //     // this.scrollToCell(row, col);
    //     this.scheduleRender();
    //     // Prepare for possible drag selection
    //     this.isMouseDown = true;
    //     this.isColHeaderDrag = false;
    //     this.isRowHeaderDrag = false;
    //     this.dragStartCell = { row, col };
    //     this.pendingEditCell = { row, col }; // Only set for data area
    //     this.dragStartMouse = { x: evt.clientX, y: evt.clientY };
    //   }
    // }

    // this.computeSelectionStats();
    // this.updateToolbarState();
  }

  /**
   * Double click event handler
   * @param evt - The mouse event
   */
  private onDoubleClick(evt: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    if (mouseX < HEADER_SIZE || mouseY < HEADER_SIZE) return;
    const { x, y } = this.getMousePos(evt);
    const { col } = this.findColumnByOffset(x - HEADER_SIZE);
    const { row } = this.findRowByOffset(y - HEADER_SIZE);
    this.pendingEditCell = { row, col };
    this.startEditingCell(row, col);
  }

  /**
   * Mouse move event handler
   * @param evt - The mouse event
   */
  private onMouseMove(evt: MouseEvent): void {
    // // Use event offset for header hit-testing so header resize works when scrolled
    // const rect = this.canvas.getBoundingClientRect();
    // const mouseX = evt.clientX - rect.left;
    // const mouseY = evt.clientY - rect.top;
    // const { x, y } = this.getMousePos(evt);

    // /* Cursor feedback for resize */
    // this.canvas.style.cursor = "cell";
    // if (mouseY < HEADER_SIZE && mouseX >= HEADER_SIZE) {
    //   const { col, within } = this.findColumnByOffset(x - HEADER_SIZE);
    //   if (within >= this.colMgr.getWidth(col) - RESIZE_GUTTER) {
    //     this.canvas.style.cursor = "col-resize";
    //   } else {
    //     this.canvas.style.cursor = "grab";
    //   }
    // } else if (mouseX < HEADER_SIZE && mouseY >= HEADER_SIZE) {
    //   const { row, within } = this.findRowByOffset(y - HEADER_SIZE);
    //   if (within >= this.rowMgr.getHeight(row) - RESIZE_GUTTER) {
    //     this.canvas.style.cursor = "row-resize";
    //   } else {
    //     this.canvas.style.cursor = "grab";
    //   }
    // }

    // // --- Multi-column drag selection update (highest priority) ---
    // if (
    //   this.isColHeaderDrag &&
    //   this.isMouseDown &&
    //   this.dragStartColHeader !== null
    // ) {
    //   if (!this.selMgr.isDragging() && this.dragStartMouse) {
    //     const dx = Math.abs(evt.clientX - this.dragStartMouse.x);
    //     if (dx > 2) {
    //       // threshold in pixels
    //       this.selMgr.startDrag(0, this.dragStartColHeader);
    //       this._colHeaderDragHasDragged = true;
    //       // Clear previous selected columns and add the starting column
    //       this.selMgr.clearSelectedColumns();
    //       this.selMgr.addSelectedColumn(this.dragStartColHeader);
    //     }
    //   }
    //   if (this.selMgr.isDragging()) {
    //     const { col } = this.findColumnByOffset(x - HEADER_SIZE);
    //     this.selMgr.updateDrag(0, col);
    //     // Update selected columns array based on drag range
    //     const startCol = Math.min(this.dragStartColHeader!, col);
    //     const endCol = Math.max(this.dragStartColHeader!, col);
    //     const selectedCols: number[] = [];
    //     for (let c = startCol; c <= endCol; c++) {
    //       selectedCols.push(c);
    //     }
    //     // Auto-scroll horizontally if mouse is near left or right edge during column header drag
    //     const edgeThreshold = 25; // px from edge to start auto-scroll
    //     const scrollAmount = 40; // px to scroll per event

    //     const rect = this.canvas.getBoundingClientRect();
    //     const mouseX = evt.clientX - rect.left; // relative to canvas

    //     const clientWidth = this.canvas.clientWidth; // FIX: use width not height

    //     if (mouseX > clientWidth - edgeThreshold) {
    //       // Near right edge → scroll right
    //       this.container.scrollLeft = Math.min(
    //         this.container.scrollLeft + scrollAmount,
    //         this.container.scrollWidth - this.container.clientWidth
    //       );
    //     } else if (mouseX < edgeThreshold) {
    //       // Near left edge → scroll left
    //       this.container.scrollLeft = Math.max(
    //         this.container.scrollLeft - scrollAmount,
    //         0
    //       );
    //     }
    //     const maxScrollLeft =
    //       this.container.scrollWidth - this.container.clientWidth;
    //     if (
    //       mouseX > clientWidth - edgeThreshold &&
    //       this.container.scrollLeft < maxScrollLeft
    //     ) {
    //       this.container.scrollLeft = Math.min(
    //         this.container.scrollLeft + scrollAmount,
    //         maxScrollLeft
    //       );
    //     } else if (mouseX < edgeThreshold && this.container.scrollLeft > 0) {
    //       this.container.scrollLeft = Math.max(
    //         this.container.scrollLeft - scrollAmount,
    //         0
    //       );
    //     }

    //     // // Scroll to the last visible column in the drag range
    //     // const lastVisibleCol = Math.max(startCol, endCol);
    //     // this.scrollToCell(0, lastVisibleCol);
    //     this.selMgr.setSelectedColumns(selectedCols);
    //     //this.throttledScheduleRender();
    //     this.scheduleRender();
    //   }
    //   return;
    // }

    // // --- Multi-row drag selection update (second priority) ---
    // if (
    //   this.isRowHeaderDrag &&
    //   this.isMouseDown &&
    //   this.dragStartRowHeader !== null
    // ) {
    //   if (!this.selMgr.isDragging() && this.dragStartMouse) {
    //     const dy = Math.abs(evt.clientY - this.dragStartMouse.y);
    //     if (dy > 2) {
    //       // threshold in pixels
    //       this.selMgr.startDrag(this.dragStartRowHeader, 0);
    //       this._rowHeaderDragHasDragged = true;
    //       this.selMgr.clearSelectedRows();
    //       this.selMgr.addSelectedRow(this.dragStartRowHeader);
    //     }
    //   }
    //   if (this.selMgr.isDragging()) {
    //     const { row } = this.findRowByOffset(y - HEADER_SIZE);
    //     this.selMgr.updateDrag(row, 0);
    //     const startRow = Math.min(this.dragStartRowHeader!, row);
    //     const endRow = Math.max(this.dragStartRowHeader!, row);
    //     const selectedRows: number[] = [];
    //     for (let r = startRow; r <= endRow; r++) {
    //       selectedRows.push(r);
    //     }
    //     const edgeThreshold = 25; // px from edge to start auto-scroll
    //     const scrollAmount = 10; // px to scroll per event
    //     const rect = this.canvas.getBoundingClientRect();
    //     const mouseY = evt.clientY - rect.top;
    //     const clientHeight = this.canvas.clientHeight;
    //     if (mouseY > clientHeight - edgeThreshold) {
    //       this.container.scrollTop = Math.min(
    //         this.container.scrollTop + scrollAmount,
    //         this.container.scrollHeight - this.container.clientHeight
    //       );
    //     } else if (mouseY < edgeThreshold) {
    //       this.container.scrollTop = Math.max(
    //         this.container.scrollTop - scrollAmount,
    //         0
    //       );
    //     }
    //     this.selMgr.setSelectedRows(selectedRows);
    //     this.scheduleRender();
    //     //this.throttledScheduleRender();
    //   }
    //   return;
    // }

    // /* Drag‑to‑select update (cells) - lowest priority */
    // if (
    //   this.isMouseDown &&
    //   this.dragStartCell &&
    //   !this.isColHeaderDrag &&
    //   !this.isRowHeaderDrag &&
    //   x >= HEADER_SIZE &&
    //   y >= HEADER_SIZE
    // ) {
    //   // If not already dragging, check if mouse moved enough to start drag
    //   if (!this.selMgr.isDragging() && this.dragStartMouse) {
    //     const dx = Math.abs(evt.clientX - this.dragStartMouse.x);
    //     const dy = Math.abs(evt.clientY - this.dragStartMouse.y);
    //     if (dx > 2 || dy > 2) {
    //       // threshold in pixels
    //       this.selMgr.startDrag(this.dragStartCell.row, this.dragStartCell.col);
    //     }
    //   }
    //   if (this.selMgr.isDragging()) {
    //     const { col } = this.findColumnByOffset(x - HEADER_SIZE);
    //     const { row } = this.findRowByOffset(y - HEADER_SIZE);
    //     this.selMgr.updateDrag(row, col);

    //     this.scrollToCell(row, col);
    //     this.scheduleRender();
    //     //this.throttledScheduleRender();
    //   }
    // }
  }



  /**
   * Mouse drag event handler
   * @param evt - The mouse event
   */
  private onMouseDrag(evt: MouseEvent): void {
    // /* Column resize */
    // if (
    //   this.resizingCol !== null &&
    //   this.isResizing &&
    //   this.currentResizeCommand
    // ) {
    //   const dx = evt.clientX - this.dragStartX;
    //   const newW = Math.max(40, this.originalSize + dx);
    //   // If multiple columns are selected, resize all
    //   const selectedCols = this.selMgr.getSelectedColumns();
    //   if (
    //     selectedCols.length > 1 &&
    //     selectedCols.includes(this.resizingCol) &&
    //     this.currentResizeCommand instanceof CompositeCommand
    //   ) {
    //     // Update all commands in the composite
    //     for (let i = 0; i < selectedCols.length; i++) {
    //       this.colMgr.setWidth(selectedCols[i], newW);
    //       const cmd = this.currentResizeCommand.commands[i];
    //       if (
    //         "updateNewSize" in cmd &&
    //         typeof cmd.updateNewSize === "function"
    //       ) {
    //         cmd.updateNewSize(newW);
    //       }
    //     }
    //   } else {
    //     this.colMgr.setWidth(this.resizingCol, newW);
    //     this.currentResizeCommand.updateNewSize(newW);
    //   }
    //   this.updateEditorPosition();
    //   //this.throttledScheduleRender();
    //   this.scheduleRender();
    // }
    // /* Row resize */
    // if (
    //   this.resizingRow !== null &&
    //   this.isResizing &&
    //   this.currentResizeCommand
    // ) {
    //   const dy = evt.clientY - this.dragStartY;
    //   const newH = Math.max(20, this.originalSize + dy);
    //   const selectedRows = this.selMgr.getSelectedRows();
    //   if (
    //     selectedRows.length > 1 &&
    //     selectedRows.includes(this.resizingRow) &&
    //     this.currentResizeCommand instanceof CompositeCommand
    //   ) {
    //     for (let i = 0; i < selectedRows.length; i++) {
    //       this.rowMgr.setHeight(selectedRows[i], newH);
    //       const cmd = this.currentResizeCommand.commands[i];
    //       if (
    //         "updateNewSize" in cmd &&
    //         typeof cmd.updateNewSize === "function"
    //       ) {
    //         cmd.updateNewSize(newH);
    //       }
    //     }
    //   } else {
    //     this.rowMgr.setHeight(this.resizingRow, newH);
    //     this.currentResizeCommand.updateNewSize(newH);
    //   }
    //   this.updateEditorPosition();
    //   //this.throttledScheduleRender();
    //   this.scheduleRender();
    // }
  }

  /**
   * Mouse up event handler
   */
  private onMouseUp(): void {
    // // Execute the resize command if we were resizing
    // if (this.isResizing && this.currentResizeCommand) {
    //   this.commandManager.execute(this.currentResizeCommand);
    //   this.currentResizeCommand = null;
    //   this.isResizing = false;
    // }

    // this.resizingCol = null;
    // this.resizingRow = null;
    // // --- Multi-column drag selection end ---
    // if (this.isColHeaderDrag) {
    //   // If not dragged, treat as single column selection
    //   if (!this._colHeaderDragHasDragged && this.dragStartColHeader !== null) {
    //     this.selMgr.selectColumn(this.dragStartColHeader);
    //     this.pendingEditCell = { row: 0, col: this.dragStartColHeader };
    //     this.selMgr.clearSelectedColumns();
    //     this.selMgr.addSelectedColumn(this.dragStartColHeader);
    //     this.scheduleRender();
    //   } else if (this.selMgr.isDragging()) {
    //     this.selMgr.endDrag();
    //     this.scheduleRender();
    //   }
    //   this.isColHeaderDrag = false;
    //   this.isMouseDown = false;
    //   this.dragStartColHeader = null;
    //   this.dragStartMouse = null;
    //   this._colHeaderDragHasDragged = false;
    //   this.computeSelectionStats();
    //   this.updateToolbarState();
    //   this.columnSelectionAnchor = null;
    //   this.columnSelectionFocus = null;
    //   this.rowSelectionAnchor = null;
    //   this.rowSelectionFocus = null;
    //   return;
    // }
    // // --- Multi-row drag selection end ---
    // if (this.isRowHeaderDrag) {
    //   // If not dragged, treat as single row selection
    //   if (!this._rowHeaderDragHasDragged && this.dragStartRowHeader !== null) {
    //     this.selMgr.selectRow(this.dragStartRowHeader);
    //     this.selMgr.clearSelectedRows();
    //     this.selMgr.addSelectedRow(this.dragStartRowHeader);
    //     this.scheduleRender();
    //   } else if (this.selMgr.isDragging()) {
    //     this.selMgr.endDrag();
    //     this.scheduleRender();
    //   }
    //   this.isRowHeaderDrag = false;
    //   this.isMouseDown = false;
    //   this.dragStartRowHeader = null;
    //   this.dragStartMouse = null;
    //   this._rowHeaderDragHasDragged = false;
    //   this.computeSelectionStats();
    //   this.updateToolbarState();
    //   this.columnSelectionAnchor = null;
    //   this.columnSelectionFocus = null;
    //   this.rowSelectionAnchor = null;
    //   this.rowSelectionFocus = null;
    //   return;
    // }
    // this.isMouseDown = false;
    // this.dragStartCell = null;
    // this.dragStartMouse = null;

    // // Finalize drag selection if we were dragging
    // if (this.selMgr.isDragging()) {
    //   this.selMgr.endDrag();
    //   this.scheduleRender();
    //   // If a drag rectangle exists and covers more than one cell, set pendingEditCell

    //   // Only update toolbar and stats once, here
    //   this.computeSelectionStats();
    //   this.updateToolbarState();
    //   // Reset anchor/focus
    //   this.columnSelectionAnchor = null;
    //   this.columnSelectionFocus = null;
    //   this.rowSelectionAnchor = null;
    //   this.rowSelectionFocus = null;
    // }
  }
  /**
   * Key down event handler
   * @param e - The keyboard event
   */
  private onKeyDown(e: KeyboardEvent): void {
    // Prevent grid key handling if an input, textarea, or contenteditable is focused
    const target = e.target as HTMLElement;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true")
    ) {
      return;
    }
    // Only handle navigation if not editing a cell
    if (e.ctrlKey && e.key === "c") {
      // Copy selected cells to clipboard (even if empty)
      const dragRect = this.selMgr.getDragRect && this.selMgr.getDragRect();
      if (dragRect) {
        this.copyRange = {
          startRow: dragRect.startRow,
          startCol: dragRect.startCol,
          endRow: dragRect.endRow,
          endCol: dragRect.endCol,
        };
        this.startMarchingAntsAnimation();
        const clipboardData: string[][] = [];
        for (let r = dragRect.startRow; r <= dragRect.endRow; r++) {
          const row: string[] = [];
          for (let c = dragRect.startCol; c <= dragRect.endCol; c++) {
            const cell = this.getCellIfExists(r, c);
            row.push(cell ? cell.getValue() : "");
          }
          clipboardData.push(row);
        }
        this.clipboard = clipboardData;
        this.formulaRange = null;
      } else {
        const selectedCells = this.getSelectedCells();
        if (selectedCells.length > 0) {
          const minRow = Math.min(...selectedCells.map((cell) => cell.row));
          const minCol = Math.min(...selectedCells.map((cell) => cell.col));
          const maxRow = Math.max(...selectedCells.map((cell) => cell.row));
          const maxCol = Math.max(...selectedCells.map((cell) => cell.col));
          this.copyRange = {
            startRow: minRow,
            startCol: minCol,
            endRow: maxRow,
            endCol: maxCol,
          };
          this.startMarchingAntsAnimation();
          const clipboardData: string[][] = [];
          for (let r = minRow; r <= maxRow; r++) {
            const row: string[] = [];
            for (let c = minCol; c <= maxCol; c++) {
              const cell = this.getCellIfExists(r, c);
              row.push(cell ? cell.getValue() : "");
            }
            clipboardData.push(row);
          }
          this.clipboard = clipboardData;
          this.formulaRange = null;
        }
      }
      this.scheduleRender();
      return;
    }
    if (e.ctrlKey && e.key === "v") {
      // Paste clipboard at selected cell
      const selectedCell = this.selMgr.getSelectedCell();
      if (!selectedCell || !this.clipboard) return;
      const { row, col } = selectedCell;
      // Use ClipboardManager for undo/redo support
      const clipboardManager = new ClipboardManager();
      clipboardManager.setData(this.clipboard);
      const command = new PasteCommand(row, col, this, clipboardManager);
      this.commandManager.execute(command);
      // Show blue marching ants for paste
      // this.pasteRange = {
      //   startRow: row,
      //   startCol: col,
      //   endRow: row + this.clipboard.length - 1,
      //   endCol: col + (this.clipboard[0]?.length || 1) - 1
      // };
      this.copyRange = null; // Clear copy ants
      this.formulaRange = null;
      this.startMarchingAntsAnimation();
      this.scheduleRender();
      return;
    }
    if (
      e.ctrlKey &&
      e.shiftKey &&
      (e.key === "ArrowDown" || e.key === "ArrowUp")
    ) {
      const selected = this.selMgr.getSelectedCell();
      if (!selected) return;
      const { row, col } = selected;
      let targetRow = row;
      if (e.key === "ArrowDown") {
        for (let r = row + 1; r < ROWS; r++) {
          if (this.getCellValueIfExists(r, col) !== "") {
            targetRow = r;
            break;
          }
        }
        if (targetRow === row) targetRow = ROWS - 1; // No data found, go to last row
      } else if (e.key === "ArrowUp") {
        for (let r = row - 1; r >= 0; r--) {
          if (this.getCellValueIfExists(r, col) !== "") {
            targetRow = r;
            break;
          }
        }
        if (targetRow === row) targetRow = 0; // No data found, go to first row
      }
      this.selMgr.clearSelection();
      this.selMgr.selectCell(targetRow, col);
      this.scrollToCell(targetRow, col);
      this.scheduleRender();
      return;
    }
     if (
      e.ctrlKey &&
      e.shiftKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      const selected = this.selMgr.getSelectedCell();
      if (!selected) return;
      const { row, col } = selected;
      let targetCol = col;
      if (e.key === "ArrowRight") {
        for (let c = col + 1; c < COLS; c++) {
          if (this.getCellValueIfExists(row, c) !== "") {
            targetCol = c;
            break;
          }
        }
        if (targetCol === col) targetCol = COLS - 1; // No data found, go to last row
      } else if (e.key === "ArrowLeft") {
        for (let c = col - 1; c >= 0; c--) {
          if (this.getCellValueIfExists(row, c) !== "") {
            targetCol = c;
            break;
          }
        }
        if (targetCol === col) targetCol = 0; // No data found, go to first row
      }
      this.selMgr.clearSelection();
      this.selMgr.selectCell(row, targetCol);
      this.scrollToCell(row, targetCol);
      this.scheduleRender();
      return;
    }
    if (this.editingCell) return;
    //if any key is pressed while cell is seleted start editing but stop on enter or escape and support ctrl +z and ctrl +y

    // For row selection
    const selectedRow = this.selMgr.getSelectedRow();
    if (typeof selectedRow === "number") {
      if (e.shiftKey) {
        if (this.rowSelectionAnchor === null) {
          // Use the first/last of the selected range as anchor if available

          const selRows = this.selMgr.getSelectedRows();
          this.rowSelectionAnchor =
            selRows.length > 0 ? selRows[0] : selectedRow;
        }
        if (this.rowSelectionFocus === null) {
          // Use the last of the selected range as focus if available
          const selRows = this.selMgr.getSelectedRows();
          this.rowSelectionFocus =
            selRows.length > 0 ? selRows[selRows.length - 1] : selectedRow;
        }
        let anchor = this.rowSelectionAnchor;
        this.pendingEditCell = { row: this.rowSelectionAnchor, col: 0 };
        let focus = this.rowSelectionFocus;
        if (e.key === "ArrowDown" && focus < ROWS - 1) {
          focus = focus + 1;
        } else if (e.key === "ArrowUp" && focus > 0) {
          focus = focus - 1;
        }
        this.rowSelectionFocus = focus;
        const startRow = Math.min(anchor, focus);
        const endRow = Math.max(anchor, focus);
        const newRows: number[] = [];
        for (let r = startRow; r <= endRow; r++) newRows.push(r);
        this.selMgr.setSelectedRows(newRows);
        this.scrollToCell(focus, 0); // Scroll to the new focus row
        this.scheduleRender();
        this.computeSelectionStats();
        this.updateToolbarState();
        return;
      }
    }
    // For column selection
    const selectedCol = this.selMgr.getSelectedCol();
    if (typeof selectedCol === "number") {
      if (e.shiftKey) {
        if (this.columnSelectionAnchor === null) {
          // Use the first/last of the selected range as anchor if available
          const selCols = this.selMgr.getSelectedColumns();
          this.columnSelectionAnchor =
            selCols.length > 0 ? selCols[0] : selectedCol;
        }
        if (this.columnSelectionFocus === null) {
          // Use the last of the selected range as focus if available
          const selCols = this.selMgr.getSelectedColumns();
          this.columnSelectionFocus =
            selCols.length > 0 ? selCols[selCols.length - 1] : selectedCol;
        }
        let anchor = this.columnSelectionAnchor;
        this.pendingEditCell = { row: 0, col: this.columnSelectionAnchor };
        let focus = this.columnSelectionFocus;
        if (e.key === "ArrowRight" && focus < COLS - 1) {
          focus = focus + 1;
        } else if (e.key === "ArrowLeft" && focus > 0) {
          focus = focus - 1;
        }
        this.columnSelectionFocus = focus;
        // Always select the range between anchor and focus
        const startCol = Math.min(anchor, focus);
        const endCol = Math.max(anchor, focus);
        const newCols: number[] = [];
        for (let c = startCol; c <= endCol; c++) newCols.push(c);
        this.selMgr.setSelectedColumns(newCols);
        this.scrollToCell(0, focus); // Scroll to the new focus column
        this.scheduleRender();
        this.computeSelectionStats();
        this.updateToolbarState();
        return;
      }
    } else {
      // If no column/row is selected, reset anchor/focus
      this.columnSelectionAnchor = null;
      this.columnSelectionFocus = null;
      this.rowSelectionAnchor = null;
      this.rowSelectionFocus = null;
    }
    if (
      e.key === "ArrowRight" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowUp"
    ) {
      e.preventDefault();
      const selected = this.selMgr.getSelectedCell();
      // If dragging, anchor is dragStart, otherwise anchor is selected cell
      let anchorRow: number, anchorCol: number;
      if (this.selMgr.isDragging() && this.selMgr["dragStart"]) {
        anchorRow = this.selMgr["dragStart"].row!;
        anchorCol = this.selMgr["dragStart"].col!;
      } else if (selected) {
        anchorRow = selected.row;
        anchorCol = selected.col;
      } else {
        return;
      }
      // Ensure anchorRow and anchorCol are numbers (never null)
      if (typeof anchorRow !== "number" && selected) anchorRow = selected.row;
      if (typeof anchorCol !== "number" && selected) anchorCol = selected.col;
      // Determine new focus cell
      let focusRow =
        this.selMgr.isDragging() &&
        this.selMgr["dragEnd"] &&
        typeof this.selMgr["dragEnd"].row === "number"
          ? this.selMgr["dragEnd"].row
          : anchorRow;
      let focusCol =
        this.selMgr.isDragging() &&
        this.selMgr["dragEnd"] &&
        typeof this.selMgr["dragEnd"].col === "number"
          ? this.selMgr["dragEnd"].col
          : anchorCol;
      // Ensure focusRow and focusCol are numbers
      if (typeof focusRow !== "number") focusRow = anchorRow;
      if (typeof focusCol !== "number") focusCol = anchorCol;
      switch (e.key) {
        case "ArrowRight":
          if (focusCol < COLS - 1) focusCol++;
          break;
        case "ArrowLeft":
          if (focusCol > 0) focusCol--;
          break;
        case "ArrowDown":
          if (focusRow < ROWS - 1) focusRow++;
          break;
        case "ArrowUp":
          if (focusRow > 0) focusRow--;
          break;
      }
      if (e.shiftKey) {
        if (!this.selMgr.isDragging()) {
          this.selMgr.startDrag(anchorRow, anchorCol);
          this.pendingEditCell = { row: anchorRow, col: anchorCol };
        }
        this.selMgr.updateDrag(focusRow, focusCol);
        this.scrollToCell(focusRow, focusCol);
        this.scheduleRender();
        return;
      } else {
        this.selMgr.clearSelection();
        this.selMgr.selectCell(focusRow, focusCol);
        this.scrollToCell(focusRow, focusCol);
        this.scheduleRender();
        this.computeSelectionStats();
      }
    }
    if (e.ctrlKey && e.key === "a") {
      this.selMgr.selectAll();
      this.editingCell = null;
      this.pendingEditCell = null;
      this.scheduleRender();
      return;
    }
    if (e.ctrlKey && e.key === "b") {
      this.onBoldToggle();
      return;
    }
    if (e.ctrlKey && e.key === "i") {
      this.onItalicToggle();
      return;
    }
    if (e.key === "Backspace") {
      if (this.selMgr.getSelectedCell() !== null) {
        const cell = this.getCell(
          this.selMgr.getSelectedCell()!.row,
          this.selMgr.getSelectedCell()!.col
        );
        const command = new EditCellCommand(this, cell, cell.getValue(), "");
        this.commandManager.execute(command);
      }
      if (this.selMgr.getSelectedRow() !== null) {
        this.onDeleteRow();
      }
      if (this.selMgr.getSelectedCol() !== null) {
        this.onDeleteColumn();
      }
      this.scheduleRender();
      return;
    }
    if (e.key === "Delete") {
      if (this.selMgr.getSelectedCell() !== null) {
        const cell = this.getCell(
          this.selMgr.getSelectedCell()!.row,
          this.selMgr.getSelectedCell()!.col
        );
        const command = new EditCellCommand(this, cell, cell.getValue(), "");
        this.commandManager.execute(command);
      }
      if (this.selMgr.getSelectedRow() !== null) {
        this.onDeleteRow();
      }
      if (this.selMgr.getSelectedCol() !== null) {
        this.onDeleteColumn();
      }
      this.scheduleRender();
      return;
    }
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      this.commandManager.undo();
      this.scheduleRender();
      return;
    }
    if (e.ctrlKey && e.key === "y") {
      e.preventDefault();
      this.commandManager.redo();
      this.scheduleRender();
      return;
    }
    const active = document.activeElement;
    if (
      this.selMgr.getSelectedCell() !== null &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (!active ||
        (active.tagName !== "INPUT" &&
          active.tagName !== "TEXTAREA" &&
          active.getAttribute("contenteditable") !== "true"))
    ) {
      e.preventDefault();

      const selectedCell = this.selMgr.getSelectedCell()!;
      this.pendingEditCell = { row: selectedCell.row, col: selectedCell.col };
      this.startEditingCell(selectedCell.row, selectedCell.col, e.key);
      return;
    }
    if (
      this.pendingEditCell &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (!target ||
        (target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          target.getAttribute("contenteditable") !== "true"))
    ) {
      e.preventDefault();
      const { row, col } = this.pendingEditCell;
      this.ctx.restore();
      this.startEditingCell(row, col, e.key);
      this.pendingEditCell = null;
      return;
    }
    this.computeSelectionStats();
    this.updateToolbarState();
    if (this.editingCell && e.key === "Enter") {
      // If a drag selection exists and is more than one cell
      const rect = this.selMgr.getDragRect();
      if (
        rect &&
        (rect.endRow > rect.startRow || rect.endCol > rect.startCol)
      ) {
        const { row, col } = this.editingCell;
        let nextRow = row + 1;
        // If at the bottom, wrap to the top
        if (nextRow > rect.endRow) nextRow = rect.startRow;
        // Only move within the selected column
        this.pendingEditCell = { row: nextRow, col };
      } else {
        this.pendingEditCell = null;
      }
      // this.finishEditing(true);
      // Immediately start editing the next cell if pendingEditCell is set
      if (this.pendingEditCell) {
        const { row, col } = this.pendingEditCell;
        this.startEditingCell(row, col);
        this.pendingEditCell = null;
      }
      return;
    }
    if (e.key === "Enter" || e.key === "Escape") {
      this.finishEditing(true);
      return;
    }
    // Only handle navigation if not editing a cell
  }

  /**
   * Start editing a cell
   * @param row - The row of the cell
   * @param col - The column of the cell
   */
  private startEditingCell(
    row: number,
    col: number,
    initialValue?: string
  ): void {
    const cell = this.getCell(row, col); // Creates only once
    this.editingCellInstance = cell;

    if (!this.editorInput) this.createEditorInput();

    // Check if cell has a formula (either in value or formula property)
    const cellValue = cell.getValue();
    if (cellValue.startsWith("=") || cell.hasFormula()) {
      this.formulaRange = this.extractRangeFromFormula(cellValue);
      this.startMarchingAntsAnimation();
    } else {
      this.formulaRange = null;
      this.stopMarchingAntsAnimation();
    }

    this.pendingEditCell = null;
    this.editingCell = { row, col };

    // Always show the formula if the cell has one, otherwise show the value
    if (typeof initialValue === "string") {
      this.editorInput!.value = initialValue;
    } else if (cell.hasFormula()) {
      this.editorInput!.value = cell.getFormula();
    } else {
      this.editorInput!.value = cell.getValue();
    }

    this.updateEditorPosition();
    this.editorInput!.focus();
    // Move cursor to end for normal edit, or after first char for initialValue
    if (typeof initialValue === "string") {
      this.editorInput!.setSelectionRange(
        initialValue.length,
        initialValue.length
      );
    }
  }
  /**
   * Creates an input element
   */
  private createEditorInput(): void {
    this.editorInput = document.createElement("input");
    this.editorInput.className = "cell-editor";
    this.editorInput.type = "text";
    this.editorInput.style.paddingRight = "4px";
    // Only show border if this is a pendingEditCell (set dynamically elsewhere)
    this.editorInput.style.border = "none";
    this.editorInput.style.outline = "none";
    this.editorInput.style.fontSize = "14px";
    this.editorInput.style.fontFamily = "Arial, sans-serif";
    this.editorInput.style.color = "#222";
    this.editorInput.style.textAlign = "left";
    this.editorInput.style.paddingLeft = "5px";
    // this.editorInput.style.backgroundColor = "transparent !important";
    this.container.appendChild(this.editorInput);

    this.editorInput.addEventListener("blur", () => this.finishEditing(true));
    this.editorInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.finishEditing(true);
      } else if (e.key === "Escape") {
        this.finishEditing(false);
      } else if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        if (this.editingCell) {
          const { row, col } = this.editingCell;
          let nextRow = row,
            nextCol = col;
          if (e.key === "ArrowDown" && row < ROWS - 1) nextRow++;
          if (e.key === "ArrowUp" && row > 0) nextRow--;
          if (e.key === "ArrowLeft" && col > 0) nextCol--;
          if (e.key === "ArrowRight" && col < COLS - 1) nextCol++;
          this.finishEditing(true);
          this.selMgr.selectCell(nextRow, nextCol);
          this.startEditingCell(nextRow, nextCol);
        }
      }
    });

    // Add real-time formula range detection
    this.editorInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const value = target.value;

      if (value.startsWith("=")) {
        try {
          this.formulaRange = this.extractRangeFromFormula(value);
          this.startMarchingAntsAnimation();
        } catch (error) {
          // If formula is invalid, clear the range
          this.formulaRange = null;
          this.stopMarchingAntsAnimation();
        }
      } else {
        // Not a formula, clear the range
        this.formulaRange = null;
        this.stopMarchingAntsAnimation();
      }
    });

    this.editorInput.style.caretColor = "transparent";
    this.editorInput.addEventListener("focus", () => {
      this.editorInput!.style.caretColor = "#107C41";
    });
    this.editorInput.addEventListener("blur", () => {
      this.editorInput!.style.caretColor = "transparent";
    });
  }
  /**
   * Extracts the range from a formula
   * @param formula - The formula to extract the range from
   * @returns The range of the formula
   */
  private extractRangeFromFormula(formula: string): {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null {
    // Remove the = sign if present
    const cleanFormula = formula.startsWith("=")
      ? formula.substring(1)
      : formula;

    // Match single cell reference like A1, B5, etc.
    const singleCellMatch = cleanFormula.match(/^([A-Z]+[0-9]+)$/i);
    if (singleCellMatch) {
      const cellRef = singleCellMatch[1];
      const { row, col } = getCoordinates(cellRef);
      return { startRow: row, startCol: col, endRow: row, endCol: col };
    }

    // Match function with range like SUM(A1:B5), COUNT(A1:A10), etc.
    const functionMatch = cleanFormula.match(
      /^\w+\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/i
    );
    if (functionMatch) {
      const [, start, end] = functionMatch;
      const { row: startRow, col: startCol } = getCoordinates(start);
      const { row: endRow, col: endCol } = getCoordinates(end);
      return { startRow, startCol, endRow, endCol };
    }

    // If no valid pattern found, return null
    return null;
  }
  /**
   * Searches for a cell
   * @param searchTerm - The term to search for
   */
  private searchCell(searchTerm: string): void {
    if (!searchTerm.trim()) {
      // Clear search when input is empty
      this.clearSearch();
      return;
    }

    const searchResults: { row: number; col: number; value: string }[] = [];
    const term = searchTerm.toLowerCase();

    // Search through all cells
    for (const [row, rowMap] of this.cells.entries()) {
      for (const [col, cell] of rowMap.entries()) {
        const cellValue = cell.getValue().toLowerCase();
        if (cellValue === term) {
          searchResults.push({ row, col, value: cell.getValue() });
        }
      }
    }

    if (searchResults.length > 0) {
      // Select the first match
      const firstMatch = searchResults[0];
      this.selMgr.selectCell(firstMatch.row, firstMatch.col);

      // Store search results for navigation
      this.currentSearchResults = searchResults;
      this.currentSearchIndex = 0;

      // Update search status
      this.updateSearchStatus(
        searchResults.length,
        this.currentSearchIndex + 1
      );

      // Scroll to the selected cell
      this.scrollToCell(firstMatch.row, firstMatch.col);

      this.scheduleRender();
    } else {
      // No matches found
      this.updateSearchStatus(0, 0);
      this.selMgr.clearSelection();
      this.scheduleRender();
    }
  }

  private currentSearchResults: { row: number; col: number; value: string }[] =
    [];
  private currentSearchIndex: number = 0;

  /**
   * Clears the search
   */
  private clearSearch(): void {
    this.currentSearchResults = [];
    this.currentSearchIndex = 0;
    this.updateSearchStatus(0, 0);
    this.selMgr.clearSelection();
    this.scheduleRender();
  }

  /**
   * Navigates through the search results
   * @param direction - The direction to navigate
   */
  private navigateSearchResults(direction: "next" | "prev"): void {
    if (this.currentSearchResults.length === 0) return;

    if (direction === "next") {
      this.currentSearchIndex =
        (this.currentSearchIndex + 1) % this.currentSearchResults.length;
    } else {
      this.currentSearchIndex =
        this.currentSearchIndex === 0
          ? this.currentSearchResults.length - 1
          : this.currentSearchIndex - 1;
    }

    const match = this.currentSearchResults[this.currentSearchIndex];
    this.selMgr.selectCell(match.row, match.col);
    this.scrollToCell(match.row, match.col);
    this.updateSearchStatus(
      this.currentSearchResults.length,
      this.currentSearchIndex + 1
    );
    this.scheduleRender();
  }
  /**
   * Scrolls to a cell and ensures it is visible.
   * @param row The row index
   * @param col The column index
   */
  private scrollToCell(row: number, col: number): void {
    const cellX = this.colMgr.getX(col);
    const cellY = this.rowMgr.getY(row);
    const cellWidth = this.colMgr.getWidth(col);
    const cellHeight = this.rowMgr.getHeight(row);

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    // Calculate the visible area (accounting for headers)
    const visibleWidth = containerWidth - this.rowHeaderWidth;
    const visibleHeight = containerHeight - HEADER_SIZE;

    // Calculate target scroll position to ensure cell is visible
    let targetScrollX = this.container.scrollLeft;
    let targetScrollY = this.container.scrollTop;

    // Check if cell is outside visible area horizontally
    const cellRight = cellX + cellWidth;
    const cellLeft = cellX;
    const visibleRight = this.container.scrollLeft + visibleWidth;
    const visibleLeft = this.container.scrollLeft;

    if (cellRight > visibleRight) {
      // Cell is to the right of visible area
      targetScrollX = cellRight - visibleWidth + 200;
    } else if (cellLeft < visibleLeft) {
      // Cell is to the left of visible area
      targetScrollX = cellLeft - 200;
    }

    // Check if cell is outside visible area vertically
    const cellBottom = cellY + cellHeight;
    const cellTop = cellY;
    const visibleBottom = this.container.scrollTop + visibleHeight;
    const visibleTop = this.container.scrollTop;

    if (cellBottom > visibleBottom) {
      // Cell is below visible area
      targetScrollY = cellBottom - visibleHeight + 200;
    } else if (cellTop < visibleTop) {
      // Cell is above visible area
      targetScrollY = cellTop - 200;
    }

    // Ensure scroll position is within bounds
    targetScrollX = Math.max(
      0,
      Math.min(targetScrollX, this.colMgr.getTotalWidth() - visibleWidth)
    );
    targetScrollY = Math.max(
      0,
      Math.min(targetScrollY, this.rowMgr.getTotalHeight() - visibleHeight)
    );

    // Only scroll if the position actually changed
    if (
      targetScrollX !== this.container.scrollLeft ||
      targetScrollY !== this.container.scrollTop
    ) {
      this.container.scrollTo({
        left: targetScrollX,
        top: targetScrollY,
        behavior: "auto",
      });
    }
  }

  /**
   * Updates the search status
   * @param totalMatches - The total number of matches
   * @param currentMatch - The current match
   */
  private updateSearchStatus(totalMatches: number, currentMatch: number): void {
    // const searchStatus = document.getElementById("searchStatus");
    // if (searchStatus) {
    //   if (totalMatches === 0) {
    //     searchStatus.textContent = "No matches found";
    //     searchStatus.style.color = "#d32f2f";
    //   } else {
    //     searchStatus.textContent = `${currentMatch} of ${totalMatches} matches`;
    //     searchStatus.style.color = "#107c41";
    //   }
    // }
  }

  /**
   * Draws the marching ants
   * @param startRow - The start row
   * @param startCol - The start column
   * @param endRow - The end row
   * @param endCol - The end column
   */
  public drawMarchingAnts(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    color: string = "#217346"
  ): void {
    // Always draw the rectangle for the full range, regardless of cell data
    const ctx = this.canvas.getContext("2d")!;
    const x1 =
      this.rowHeaderWidth +
      this.colMgr.getX(startCol) -
      this.container.scrollLeft;
    const y1 =
      HEADER_SIZE + this.rowMgr.getY(startRow) - this.container.scrollTop;
    const x2 =
      this.rowHeaderWidth +
      this.colMgr.getX(endCol) +
      this.colMgr.getWidth(endCol) -
      this.container.scrollLeft;
    const y2 =
      HEADER_SIZE +
      this.rowMgr.getY(endRow) +
      this.rowMgr.getHeight(endRow) -
      this.container.scrollTop;

    ctx.save();
    ctx.lineWidth = 3 / dpr;
    ctx.setLineDash([3, 3]);

    // First stroke: white (this becomes the gaps for the second stroke)
    ctx.strokeStyle = "white";
    ctx.lineDashOffset = this.dashOffset;
    ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);

    // Second stroke: black (dashes appear between the white gaps)
    ctx.strokeStyle = "#107C41";
    ctx.lineDashOffset = this.dashOffset + 3; // half cycle shift
    ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);

    ctx.restore();
  }

  /**
   * Updates the editor position
   */
  private updateEditorPosition(): void {
    if (!this.editingCell || !this.editorInput) return;

    const { row, col } = this.editingCell;
    const scrollX = this.container.scrollLeft;
    const scrollY = this.container.scrollTop;

    // Get header and toolbar heights from CSS variables (parse as float, trim spaces)
    const root = document.documentElement;
    const headerHeight =
      parseFloat(
        getComputedStyle(root).getPropertyValue("--header-height").trim()
      ) || 56;
    const toolbarHeight =
      parseFloat(
        getComputedStyle(root).getPropertyValue("--toolbar-height").trim()
      ) || 48;

    // Add HEADER_SIZE for the grid's own header row
    const left = this.rowHeaderWidth + this.colMgr.getX(col) - scrollX;
    const top =
      headerHeight +
      toolbarHeight +
      HEADER_SIZE +
      this.rowMgr.getY(row) -
      scrollY;

    // Determine padding based on cell value (numeric = right-aligned)
    let paddingLeft = "8px";
    let paddingRight = "8px";
    const cell = this.getCellIfExists(row, col);
    if (cell && this.isNumericValue(cell.getValue())) {
      paddingLeft = "0px";
      paddingRight = "8px";
      this.editorInput.style.textAlign = "right";
    } else {
      paddingLeft = "7px";
      paddingRight = "8px";
      this.editorInput.style.textAlign = "left";
    }
    const headerBottom = headerHeight + toolbarHeight + HEADER_SIZE;
    const clipTop = Math.max(0, headerBottom - top);
    const clipLeft = Math.max(0, this.rowHeaderWidth - left);
    
    if (clipTop > 0 || clipLeft > 0) {
      this.editorInput.style.clipPath = `inset(${clipTop}px 0px 0px ${clipLeft}px)`;
    } else {
      this.editorInput.style.clipPath = "none";
    }
    
    Object.assign(this.editorInput.style, {
      left: `${left + 1}px`,
      top: `${top + 1}px`,
      width: `${this.colMgr.getWidth(col) - 3}px`,
      height: `${this.rowMgr.getHeight(row) - 2}px`,
      zIndex: "8",
      display: "block",
      paddingLeft,
      paddingRight,
      paddingTop: `${this.rowMgr.getHeight(row) - 22}px`, // Push text to bottom
      paddingBottom: "0px",
      lineHeight: "16px", // match font size or desired line height
      verticalAlign: "bottom", // optional, does nothing here
    });
  }

  /**
   * Finishes editing a cell
   * @param commit - Whether to commit the changes
   */
  private finishEditing(commit: boolean): void {
    // console.log("finishEditing called", commit, this.editingCell, this.editorInput);
    if (!this.editorInput || !this.editingCell || !this.editingCellInstance)
      return;

    const cell = this.editingCellInstance; // ← Use the cached one
    const oldValue = cell.getValue();
    const newValue = this.editorInput.value;

    if (commit && newValue !== oldValue) {
      // Check if the new value is a formula
      if (Cell.isFormula(newValue)) {
        // Store the formula and evaluate it
        cell.setFormula(newValue);
        try {
          const result = this.evaluateCellFormula(cell);
          cell.setValue(result);
        } catch (error) {
          cell.setValue("#ERROR");
          console.error("Formula error:", error);
        }
      } else {
        // Regular value - remove any existing formula
        cell.removeFormula();
        cell.setValue(newValue);
      }
      this.formulaRange = null;
      this.stopMarchingAntsAnimation();
      const command = new EditCellCommand(
        this,
        cell,
        oldValue,
        cell.getValue()
      );
      this.commandManager.execute(command);
    } else {
      // Even if not committing, stop animation when editing ends
      this.formulaRange = null;
      this.stopMarchingAntsAnimation();
    }

    // If another cell is selected, shift focus there and start editing
    const selectedCell = this.selMgr.getSelectedCell();
    if (
      selectedCell &&
      (!this.editingCell ||
        selectedCell.row !== this.editingCell.row ||
        selectedCell.col !== this.editingCell.col)
    ) {
      this.editorInput.style.display = "none";
      this.editingCellInstance = null;
      this.editingCell = null;
      this.scheduleRender();
      this.startEditingCell(selectedCell.row, selectedCell.col);
      return;
    }

    this.editorInput.style.display = "none";
    this.editingCell = null;
    this.editingCellInstance = null;
    this.scheduleRender();
  }

  /**
   * Evaluates a formula for a given cell.
   * @param {Cell} cell The cell containing the formula.
   * @returns {string} The result of the formula evaluation.
   */
  private evaluateCellFormula(cell: Cell): string {
    const formula = cell.getFormula();
    if (!formula || !Cell.isFormula(formula)) {
      return cell.getValue();
    }

    // Extract the formula part (remove the = sign)
    const formulaText = formula.substring(1);

    try {
      return evaluateFormula(formulaText, this);
    } catch (error) {
      console.error("Formula evaluation error:", error);
      return "#ERROR";
    }
  }

  /**
   * Recalculates all formulas in the grid.
   * Call this when cell values change that might affect formulas.
   */
  public recalculateFormulas(): void {
    for (const rowMap of this.cells.values()) {
      for (const cell of rowMap.values()) {
        if (cell.hasFormula()) {
          try {
            const result = this.evaluateCellFormula(cell);
            cell.setValue(result);
          } catch (error) {
            cell.setValue("#ERROR");
            console.error("Formula recalculation error:", error);
          }
        }
      }
    }
    this.scheduleRender();
  }
  /**
   * Gets the visible range of the grid.
   * @returns the visible range of the grid
   */
  private getVisibleRange(): {
    firstRow: number;
    lastRow: number;
    firstCol: number;
    lastCol: number;
  } {
    const scrollX = this.container.scrollLeft;
    const scrollY = this.container.scrollTop;
    const viewW = this.container.clientWidth;
    const viewH = this.container.clientHeight;

    let firstRow = 0,
      lastRow = ROWS - 1;
    let y = 0;
    for (let r = 0; r < ROWS; r++) {
      const h = this.rowMgr.getHeight(r);
      if (y + h >= scrollY - RENDER_BUFFER_PX) {
        firstRow = r;
        break;
      }
      y += h;
    }

    let rowY = y;
    for (let r = firstRow; r < ROWS; r++) {
      const h = this.rowMgr.getHeight(r);
      if (rowY > scrollY + viewH + RENDER_BUFFER_PX) {
        lastRow = r;
        // if (lastRow > 1000) {
        //   HEADER_SIZE = HEADER_SIZE + 5;
        // }
        break;
      }
      rowY += h;
    }

    let firstCol = 0,
      lastCol = COLS - 1;
    let x = 0;
    for (let c = 0; c < COLS; c++) {
      const w = this.colMgr.getWidth(c);
      if (x + w >= scrollX - RENDER_BUFFER_PX) {
        firstCol = c;
        break;
      }
      x += w;
    }

    let colX = x;
    for (let c = firstCol; c < COLS; c++) {
      const w = this.colMgr.getWidth(c);
      if (colX > scrollX + viewW + RENDER_BUFFER_PX) {
        lastCol = c;
        break;
      }
      colX += w;
    }

    return { firstRow, lastRow, firstCol, lastCol };
  }

  /**
   * Renders the grid.
   */
  private render(): void {
    const dpr = window.devicePixelRatio || 1;
    // Set canvas size in physical pixels for crisp lines
    this.canvas.width = this.container.clientWidth * dpr;
    this.canvas.height = this.container.clientHeight * dpr;
    this.canvas.style.width = this.container.clientWidth + "px";
    this.canvas.style.height = this.container.clientHeight + "px";
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    this.ctx.scale(dpr, dpr);
    const scrollX = this.container.scrollLeft;
    const scrollY = this.container.scrollTop;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the top-left box (intersection of row/col headers)
    const isTopLeftHovered = this._isTopLeftHovered || false;
    this.ctx.save();
    this.ctx.fillStyle = isTopLeftHovered ? "#e0e0e0" : "#F5F5F5"; // Hover effect
    this.ctx.fillRect(0, 0, this.rowHeaderWidth, HEADER_SIZE);
    this.ctx.strokeStyle = "#b7c6d5"; // Match your header border
    this.ctx.lineWidth = 1 / dpr;
    this.ctx.strokeRect(0, 0, this.rowHeaderWidth, HEADER_SIZE);
    // Draw a bold select-all icon (3x3 grid) in the top-left box
    this.ctx.save();
    // this.ctx.strokeStyle = "#222"; // Even darker for visibility
    // this.ctx.lineWidth = 2.5;
    // const iconBox = Math.min(this.rowHeaderWidth, HEADER_SIZE) * 0.7;
    // const iconX = (this.rowHeaderWidth - iconBox) / 2;
    // const iconY = (HEADER_SIZE - iconBox) / 2;
    // for (let i = 0; i <= 3; i++) {
    //   // Vertical lines
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(iconX + (iconBox / 3) * i, iconY);
    //   this.ctx.lineTo(iconX + (iconBox / 3) * i, iconY + iconBox);
    //   this.ctx.stroke();
    //   // Horizontal lines
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(iconX, iconY + (iconBox / 3) * i);
    //   this.ctx.lineTo(iconX + iconBox, iconY + (iconBox / 3) * i);
    //   this.ctx.stroke();
    // }
    this.ctx.restore();
    this.ctx.restore();

    const { firstRow, lastRow, firstCol, lastCol } = this.getVisibleRange();

    // Calculate stable rowHeaderWidth for this render pass based on visible rows
    let maxVisibleRowLabelWidth = 0;
    if (lastRow >= firstRow) { // Ensure there's at least one row visible
        // Temporarily set font for measurement if needed, assuming drawHeader sets it appropriately later.
        // Or ensure ctx font is set to what drawHeader uses for row labels before this loop.
        const currentFont = this.ctx.font; // Save current font
        this.ctx.font = "14px Calibri, 'Segoe UI', sans-serif"; // Match drawHeader's row label font
        for (let r = firstRow; r <= lastRow; r++) {
            const label = (r + 1).toString();
            maxVisibleRowLabelWidth = Math.max(maxVisibleRowLabelWidth, this.ctx.measureText(label).width);
        }
        this.ctx.font = currentFont; // Restore font
    }
    const ROW_HEADER_PADDING = 16;
    const MIN_ROW_HEADER_WIDTH = 40;
    this.rowHeaderWidth = Math.max(MIN_ROW_HEADER_WIDTH, maxVisibleRowLabelWidth + ROW_HEADER_PADDING);


    // Draw marching ants for formula range if active
    if (this.formulaRange) {
      const { startRow, startCol, endRow, endCol } = this.formulaRange;
      this.drawMarchingAnts(startRow, startCol, endRow, endCol);
    }

    // Draw cells (only grid lines, not filled rectangles)
    let yPos = HEADER_SIZE + this.rowMgr.getY(firstRow) - scrollY;
    for (let r = firstRow; r <= lastRow; r++) {
      const rowH = this.rowMgr.getHeight(r);
      let xPos = this.rowHeaderWidth + this.colMgr.getX(firstCol) - scrollX;
      const rowMap = this.cells.get(r);
      for (let c = firstCol; c <= lastCol; c++) {
        const colW = this.colMgr.getWidth(c);

        // Draw search highlight if this cell is a search result
        if (this.isSearchResult(r, c)) {
          this.ctx.fillStyle = "rgba(34, 168, 0, 0.12)";
          this.ctx.fillRect(xPos, yPos, colW, rowH);
        }

        // Draw cell text
        const cell = rowMap?.get(c);
        const cellValue = rowMap?.get(c)?.getValue() || "";
        const isNumeric = this.isNumericValue(cellValue);
        let effectiveAlignment: "left" | "center" | "right";
        const alignment = cell?.getAlignment();
        if (
          alignment === "left" ||
          alignment === "center" ||
          alignment === "right"
        ) {
          effectiveAlignment = alignment;
        } else if (isNumeric) {
          effectiveAlignment = "right";
        } else {
          effectiveAlignment = "left";
        }
        if (cell) {
          const fontSize = cell.getFontSize();
          const isBold = cell.getIsBold();
          const isItalic = cell.getIsItalic();
          let fontStyle = "";
          if (isBold && isItalic) {
            fontStyle = "bold italic";
          } else if (isBold) {
            fontStyle = "bold";
          } else if (isItalic) {
            fontStyle = "italic";
          } else {
            fontStyle = "normal";
          }
          this.ctx.font = `${fontStyle} ${fontSize}px 'Arial', sans-serif`;
        } else {
          this.ctx.font = "14px 'Arial', sans-serif";
        }
        this.ctx.textAlign = effectiveAlignment;
        this.ctx.textBaseline = "middle";
        const clipped = this.clipText(cellValue, colW - 16);
        let textX: number;
        if (effectiveAlignment === "right") textX = xPos + colW - 8;
        else if (effectiveAlignment === "center") textX = xPos + colW / 2;
        else textX = xPos + 8;
        this.ctx.fillText(clipped, textX, yPos + rowH - 10);
        xPos += colW;
      }
      yPos += rowH;
    }

    // Draw vertical grid lines
    let gridX = this.rowHeaderWidth + this.colMgr.getX(firstCol) - scrollX;
    for (let c = firstCol; c <= lastCol + 1; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(gridX + 0.5, HEADER_SIZE);
      this.ctx.lineTo(gridX + 0.5, this.canvas.height / dpr);
      this.ctx.strokeStyle = "#d4d4d4";
      this.ctx.lineWidth = 1 / dpr;
      this.ctx.stroke();
      if (c <= lastCol) gridX += this.colMgr.getWidth(c);
    }

    // Draw horizontal grid lines
    let gridY = HEADER_SIZE + this.rowMgr.getY(firstRow) - scrollY;
    for (let r = firstRow; r <= lastRow + 1; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(HEADER_SIZE, gridY + 0.5);
      this.ctx.lineTo(this.canvas.width / dpr, gridY + 0.5);
      this.ctx.strokeStyle = "#d4d4d4";
      this.ctx.lineWidth = 1 / dpr;
      this.ctx.stroke();
      if (r <= lastRow) gridY += this.rowMgr.getHeight(r);
    }

    // Draw selection overlay BEFORE headers so headers cover selection
    this.selMgr.drawSelection(
      this.ctx,
      this.rowMgr,
      this.colMgr,
      HEADER_SIZE,
      this.rowHeaderWidth,
      scrollX,
      scrollY
    );

    // Draw headers LAST so they are on top

    // Highlight pendingEditCell (soft focus, no border)
    if (this.pendingEditCell) {
      const { row, col } = this.pendingEditCell;
      const x = this.rowHeaderWidth + this.colMgr.getX(col) - scrollX;
      const y = HEADER_SIZE + this.rowMgr.getY(row) - scrollY;
      const w = this.colMgr.getWidth(col);
      const h = this.rowMgr.getHeight(row);
      this.ctx.save();
      this.ctx.fillStyle = "#fff";
      this.ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      // Draw the cell text again so it's visible on white
      const cell = this.getCellIfExists(row, col);
      if (cell) {
        const fontSize = cell.getFontSize();
        const isBold = cell.getIsBold();
        const isItalic = cell.getIsItalic();
        const alignment = cell.getAlignment();
        let fontStyle = "";
        if (isBold && isItalic) fontStyle = "bold italic";
        else if (isBold) fontStyle = "bold";
        else if (isItalic) fontStyle = "italic";
        else fontStyle = "normal";
        this.ctx.font = `${fontStyle} ${fontSize}px 'Arial', sans-serif`;
        const cellValue = cell.getValue() || "";
        this.ctx.fillStyle = "#222";
        this.ctx.textBaseline = "middle";
        const isNumeric = this.isNumericValue(cellValue);
        let effectiveAlignment: "left" | "center" | "right";
        if (alignment) {
          effectiveAlignment = alignment;
        } else if (isNumeric) {
          effectiveAlignment = "right";
        } else {
          effectiveAlignment = "left";
        }
        this.ctx.textAlign = effectiveAlignment;
        const clipped = this.clipText(cellValue, w - 16);
        let textX: number;
        if (effectiveAlignment === "right") textX = x + w - 8;
        else if (effectiveAlignment === "center") textX = x + w / 2;
        else textX = x + 8;
        this.ctx.fillText(clipped, textX, y + h - 10);
      }
      this.ctx.restore();
    }

    // Draw a green border around the cell being edited ONLY if the editor input is visible
    // if (this.editingCell && this.editorInput && this.editorInput.style.opacity !== '0' && document.activeElement === this.editorInput) {
    //   const { row, col } = this.editingCell;
    //   const x = this.rowHeaderWidth + this.colMgr.getX(col) - scrollX;
    //   const y = HEADER_SIZE + this.rowMgr.getY(row) - scrollY;
    //   const w = this.colMgr.getWidth(col);
    //   const h = this.rowMgr.getHeight(row);
    //   this.ctx.save();
    //   this.ctx.strokeStyle = "#107C41";
    //   this.ctx.lineWidth = 2;
    //   this.ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    //   this.ctx.restore();
    // }
    // At the end of render(), always reset isKeyDown to false

    let x = this.rowHeaderWidth + this.colMgr.getX(firstCol) - scrollX;
    for (let c = firstCol; c <= lastCol; c++) {
      const w = this.colMgr.getWidth(c);
      this.drawHeader(c, true, x, w);
      x += w;
    }
    let y = HEADER_SIZE + this.rowMgr.getY(firstRow) - scrollY;

    for (let r = firstRow; r <= lastRow; r++) {
      const h = this.rowMgr.getHeight(r);
      this.drawHeader(r, false, y, h);
      y += h;
    }

    // Draw marching ants and border for copy only
    if (this.copyRange) {
      // Draw solid border around the whole selected area
      //this.drawCopyBorder(this.copyRange.startRow, this.copyRange.startCol, this.copyRange.endRow, this.copyRange.endCol, "#217346");
      // Draw marching ants
      this.drawMarchingAnts(
        this.copyRange.startRow,
        this.copyRange.startCol,
        this.copyRange.endRow,
        this.copyRange.endCol,
        "#217346"
      ); // green
    }
    if (this.formulaRange) {
      this.drawMarchingAnts(
        this.formulaRange.startRow,
        this.formulaRange.startCol,
        this.formulaRange.endRow,
        this.formulaRange.endCol,
        "#217346"
      ); // green
    }
    // Remove paste marching ants
    // if (this.pasteRange) {
    //   this.drawMarchingAnts(this.pasteRange.startRow, this.pasteRange.startCol, this.pasteRange.endRow, this.pasteRange.endCol, "#1976d2"); // blue
    // }
  }

  private isSearchResult(row: number, col: number): boolean {
    return this.currentSearchResults.some(
      (result) => result.row === row && result.col === col
    );
  }

  /**
   * Clips text to a maximum width.
   * @param text the text to clip
   * @param maxWidth the maximum width
   * @returns the clipped text
   */
  private clipText(text: string, maxWidth: number): string {
    if (this.ctx.measureText(text).width <= maxWidth) return text;
    while (
      text.length > 0 &&
      this.ctx.measureText(text + "…").width > maxWidth
    ) {
      text = text.slice(0, -1);
    }
    return text + "…";
  }

  /**
   * Checks if a cell value contains only digits, decimals, or percentages.
   * @param value the cell value to check
   * @returns true if the value contains only digits, decimals, or percentages, false otherwise
   */
  private isNumericValue(value: string): boolean {
    const cleanValue = value.trim();
    return /^\d+$|^\d+\.\d+$|^\d+%$|^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/.test(
      cleanValue
    );
  }

  /* ────────── Batch‑update helpers (programmatic edits) ───────────── */
  /**
   * Begins a batch update.
   */
  public beginBatchUpdate() {
    this.suppressRender = true;
  }

  /**
   * Ends a batch update.
   */
  public endBatchUpdate() {
    this.suppressRender = false;
    this.scheduleRender();
  }

  /**
   * Sets the value of a cell.
   * @param row the row of the cell
   * @param col the column of the cell
   * @param value the value to set
   */
  public setCellValue(row: number, col: number, value: string): void {
    if (value.trim() === "") return;
    const cell = this.getCell(row, col);
    cell.setValue(value);
    if (!this.suppressRender) this.scheduleRender();
  }

  /**
   * Draws a header.
   * @param index the index of the header
   * @param isColumn true if the header is a column header, false if it is a row header
   * @param pos the position of the header
   * @param size the size of the header
   */
  private drawHeader(
    index: number,
    isColumn: boolean,
    pos: number,
    size: number
  ): void {
    const ctx = this.ctx;
    const label = isColumn ? this.columnName(index) : (index + 1).toString();
    // this.rowHeaderWidth is now pre-calculated and stable for the render pass.
    // Removed dynamic adjustment of this.rowHeaderWidth within drawHeader.

    const x = isColumn ? pos : 0;
    const y = isColumn ? 0 : pos;
    let w = isColumn ? size : this.rowHeaderWidth; // For row headers, w is now the stable pre-calculated width
    const h = isColumn ? HEADER_SIZE : size;
    ctx.font = "14px Calibri, 'Segoe UI', sans-serif";

    // The following block is no longer needed as this.rowHeaderWidth is already the max for visible rows.
    // if (!isColumn) {
    //   const rowLabel = (index + 1).toString();
    //   const textWidth = ctx.measureText(rowLabel).width;
    //   const padding = 16;
    //   w = Math.max(this.rowHeaderWidth, textWidth + padding);
    // }

    // Get selection states
    const selectedCell = this.selMgr.getSelectedCell();
    const selectedRow = this.selMgr.getSelectedRow();
    const selectedCol = this.selMgr.getSelectedCol();
    const dragRect = this.selMgr.getDragRect();

    // Determine highlight state
    let highlight = false;
    let highlightColor = "#CAEAD8";
    let highlightText = "#107C41";
    let isBold = false;

    // Check various selection conditions
    if (
      selectedCell &&
      ((isColumn && selectedCell.col === index) ||
        (!isColumn && selectedCell.row === index))
    ) {
      highlight = true;
    }
    if (
      (isColumn && selectedCol === index) ||
      (!isColumn && selectedRow === index)
    ) {
      highlight = true;
    }
    if (
      (isColumn && selectedRow !== null) ||
      (!isColumn && this.selMgr.getSelectedColumns().length > 0)
    ) {
      highlight = true;
    }
    if (
      (!isColumn && selectedRow === index) ||
      (isColumn && selectedCol === index)
    ) {
      highlight = true;
      highlightColor = "#107C41";
      highlightText = "#FFFFFF";
      isBold = true;
    }
    if (
      (this.selMgr.getSelectedColumns().includes(index) && isColumn) ||
      (this.selMgr.getSelectedRows().includes(index) && !isColumn)
    ) {
      highlight = true;
      highlightColor = "#107C41";
      highlightText = "#FFFFFF";
      isBold = true;
      if (!isColumn) {
      }
    }

    if (
      (!isColumn && selectedCol !== null) ||
      (isColumn && this.selMgr.getSelectedRows().length > 0)
    ) {
      highlight = true;
    }
    this.ctx.fillStyle = "#f3f6fb";
    this.ctx.fillRect(0, 0, this.rowHeaderWidth, HEADER_SIZE);
    this.ctx.strokeStyle = "#d4d4d4";
    this.ctx.lineWidth = 1 / dpr;
    this.ctx.strokeRect(0, 0, this.rowHeaderWidth, HEADER_SIZE);
    // Check drag selection
    if (dragRect) {
      const inRange = isColumn
        ? index >= dragRect.startCol && index <= dragRect.endCol
        : index >= dragRect.startRow && index <= dragRect.endRow;
      if (inRange) {
        highlight = true;
      }
    }

    // Draw background
    if (highlight) {
      ctx.fillStyle = highlightColor;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillStyle = "#F5F5F5";
      ctx.fillRect(x, y, w, h);
    }

    // Draw borders
    ctx.strokeStyle = highlight ? "#107C41" : "#b7c6d5";
    ctx.lineWidth = highlight ? 2 / dpr : 1 / dpr; // Always 1px
    ctx.beginPath();

    if (isColumn) {
      // Bottom border
      ctx.moveTo(x + 0.5, y + h + 0.5);
      ctx.lineTo(x + w - 0.5, y + h + 0.5);
      if (!highlight) {
        // Left border
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5, y + h + 0.5);
      }
    } else {
      // Right border
      ctx.moveTo(x + w - 0.5, y + 0.5);
      ctx.lineTo(x + w - 0.5, y + h - 0.5);
      if (!highlight) {
        // Bottom border
        ctx.moveTo(x + 0.5, y + h - 0.5);
        ctx.lineTo(x + w - 0.5, y + h - 0.5);
      }
    }
    ctx.stroke();

    // Draw text
    ctx.fillStyle = highlight ? highlightText : "#616161";
    if (isBold) {
      ctx.font = "bold 16px Calibri, 'Segoe UI', sans-serif";
    }

    ctx.textBaseline = "middle";

    if (isColumn) {
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y + h / 2);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, x + w - 4, y + h / 2);
    }
  }
  /**
   * Gets the name of a column.
   * @param idx the index of the column
   * @returns the name of the column
   */
  private columnName(idx: number): string {
    let name = "";
    let n = idx;
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
  }

  /**
   * Counts the number of created cells.
   * @returns the number of created cells
   */
  public countCreatedCells(): number {
    let count = 0;
    for (const rowMap of this.cells.values()) {
      count += rowMap.size;
    }
    return count;
  }

  /**
   * Gets the mouse position.
   * @param evt the mouse event
   * @returns the mouse position
   */
  private getMousePos(evt: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left + this.container.scrollLeft;
    const y = evt.clientY - rect.top + this.container.scrollTop;
    return { x, y };
  }

  /**
   * Finds a column by offset.
   * @param offsetX the offset of the column
   * @returns the column and the within value
   */
  private findColumnByOffset(offsetX: number): { col: number; within: number } {
    let x = 0;
    for (let c = 0; c < COLS; c++) {
      const w = this.colMgr.getWidth(c);
      if (offsetX < x + w) return { col: c, within: offsetX - x };
      x += w;
    }
    return { col: COLS - 1, within: 0 };
  }

  /**
   * Finds a row by offset.
   * @param offsetY the offset of the row
   * @returns the row and the within value
   */
  private findRowByOffset(offsetY: number): { row: number; within: number } {
    let y = 0;
    for (let r = 0; r < ROWS; r++) {
      const h = this.rowMgr.getHeight(r);
      if (offsetY < y + h) return { row: r, within: offsetY - y };
      y += h;
    }
    return { row: ROWS - 1, within: 0 };
  }

  /**
   * Computes the selection stats.
   */
  private computeSelectionStats(): void {
    

    // Whole row selection
    const selectedRows = this.selMgr.getSelectedRows();
    if (selectedRows.length > 0) {
      // Select data from all columns of the selected rows
      const rowsData: (string | number)[][] = [];
      for (const rowIdx of selectedRows) {
        if (rowIdx !== null) {
          const row: (string | number)[] = [];
          for (let c = 0; c < COLS; c++) {
            row.push(this.getCellValueIfExists(rowIdx, c));
          }
          rowsData.push(row);
        }
      }
      if (rowsData.length > 0) {
        const stats = Aggregator.compute(rowsData);
        this.updateStatusBar(stats);
        return;
      }
    }
    // Multiple columns selection
    const selectedColumns = this.selMgr.getSelectedColumns();
    if (selectedColumns.length > 0) {
      // Ensure all selected columns are included, including the last one
      const minCol = Math.min(...selectedColumns);
      const maxCol = Math.max(...selectedColumns);
      const fullSelectedCols: number[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        if (selectedColumns.includes(c)) {
          fullSelectedCols.push(c);
        }
      }
      // For each row, collect values from all selected columns (including the last)
      const colsData: (string | number)[][] = [];
      for (let r = 0; r < ROWS; r++) {
        const row: (string | number)[] = [];
        for (const col of fullSelectedCols) {
          row.push(this.getCellValueIfExists(r, col));
        }
        colsData.push(row);
      }
      if (colsData.length > 0) {
        const stats = Aggregator.compute(colsData);
        this.updateStatusBar(stats);
        return;
      }
    }
    // Whole column selection
    const selectedCol = this.selMgr.getSelectedCol();
    if (selectedCol !== null) {
      const col: (string | number)[] = [];
      for (let r = 0; r < ROWS; r++) {
        col.push(this.getCellValueIfExists(r, selectedCol));
      }
      // Aggregator expects 2D array
      const stats = Aggregator.compute(col.map((v) => [v]));
      this.updateStatusBar(stats);
      return;
    }
    // Single cell selection
    const selectedCell = this.selMgr.getSelectedCell();
    if (selectedCell) {
      const { row, col } = selectedCell;
      const value = this.getCellValueIfExists(row, col);
      const stats = Aggregator.compute([[value]]);
      this.updateStatusBar(stats);
      return;
    }
    const rect = this.selMgr.getDragRect();
    if (rect) {
      // console.log("getSelectedCells drag rect:", rect);
      const { startRow, endRow, startCol, endCol } = rect;
      const cells: (string | number)[][] = [];
      for (let r = startRow; r <= endRow; r++) {
        const row: (string | number)[] = [];
        for (let c = startCol; c <= endCol; c++) {
          row.push(this.getCellValueIfExists(r, c));
        }
        cells.push(row);
      }
      const stats = Aggregator.compute(cells);
      this.updateStatusBar(stats);
      return;
    }
    // If nothing is selected, clear status bar
    this.updateStatusBar({ sum: "", count: "", average: "", min: "", max: "" });
  }

  /**
   * Updates the status bar.
   * @param stats the stats to update the status bar with
   */
  private updateStatusBar(stats: any): void {
    // TODO: Replace with real UI update
    const summaryBar = document.getElementById("summaryBar")!;
    summaryBar.innerHTML = ` <span><strong>SUM:</strong> ${stats.sum}</span>
      <span><strong>COUNT:</strong> ${stats.count}</span>
      <span><strong>AVERAGE:</strong> ${stats.average}</span>
      <span><strong>MIN:</strong> ${stats.min}</span>
      <span><strong>MAX:</strong> ${stats.max}</span>
      `;
  }

  /**
   * Handles the font size change.
   */
  private onFontSizeChange(): void {
    const fontSizeSelect = document.getElementById(
      "fontSizeSelect"
    ) as HTMLSelectElement;
    const newSize = parseInt(fontSizeSelect.value);
    this.applyFontSizeToSelection(newSize);
  }

  /**
   * Handles the bold toggle.
   */
  private onBoldToggle(): void {
    const boldBtn = document.getElementById("boldBtn")!;
    const isCurrentlyBold = boldBtn.classList.contains("active");
    this.applyBoldToSelection(!isCurrentlyBold);
  }

  /**
   * Handles the italic toggle.
   */
  private onItalicToggle(): void {
    const italicBtn = document.getElementById("italicBtn")!;
    const isCurrentlyItalic = italicBtn.classList.contains("active");
    this.applyItalicToSelection(!isCurrentlyItalic);
  }

  /**
   * Applies the font size to the selection.
   * @param newSize the new font size
   */
  private applyFontSizeToSelection(newSize: number): void {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length === 0) return;

    // Create and execute command for each selected cell
    const commands = selectedCells.map(
      (cell) => new FontSizeCommand(cell, newSize)
    );
    const composite = new CompositeCommand(commands);
    this.commandManager.execute(composite);

    this.scheduleRender();
  }

  /**
   * Applies the bold to the selection.
   * @param isBold true if the cells should be bold, false otherwise
   */
  private applyBoldToSelection(isBold: boolean): void {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length === 0) return;

    const commands = selectedCells.map((cell) => new BoldCommand(cell, isBold));
    const composite = new CompositeCommand(commands);
    this.commandManager.execute(composite);

    this.updateToolbarState();
    this.scheduleRender();
  }

  /**
   * Applies the italic to the selection.
   * @param isItalic true if the cells should be italic, false otherwise
   */
  private applyItalicToSelection(isItalic: boolean): void {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length === 0) return;

    // Create and execute command for each selected cell
    const commands = selectedCells.map(
      (cell) => new ItalicCommand(cell, isItalic)
    );
    const composite = new CompositeCommand(commands);
    this.commandManager.execute(composite);

    this.updateToolbarState();
    this.scheduleRender();
  }

  /**
   * Gets the selected cells.
   * @returns the selected cells
   */
  private getSelectedCells(): Cell[] {
    const cells: Cell[] = [];

    // Check for drag selection first

    // Check for selected columns array (for column header selections when not dragging)
    const selectedColumns = this.selMgr.getSelectedColumns();
    if (selectedColumns.length > 0) {
      // console.log("Selected columns from array:", selectedColumns);
      for (const col of selectedColumns) {
        for (let r = 0; r < ROWS; r++) {
          const cell = this.getCellIfExists(r, col);
          if (cell) cells.push(cell);
        }
      }
      return cells;
    }
    const selectedRows = this.selMgr.getSelectedRows();
    if (selectedRows.length > 0) {
      for (const row of selectedRows) {
        for (let c = 0; c < COLS; c++) {
          const cell = this.getCellIfExists(row, c);
          if (cell) cells.push(cell);
        }
      }
      return cells;
    }
    // Check for row selection
    const selectedRow = this.selMgr.getSelectedRow();
    if (selectedRow !== null) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.getCellIfExists(selectedRow, c);
        if (cell) cells.push(cell);
      }
      return cells;
    }

    // Check for column selection
    const selectedCol = this.selMgr.getSelectedCol();
    if (selectedCol !== null) {
      for (let r = 0; r < ROWS; r++) {
        const cell = this.getCellIfExists(r, selectedCol);
        if (cell) cells.push(cell);
      }
      return cells;
    }

    // Check for single cell selection
    const selectedCell = this.selMgr.getSelectedCell();
    if (selectedCell) {
      const cell = this.getCellIfExists(selectedCell.row, selectedCell.col);
      if (cell) cells.push(cell);
      return cells;
    }
    const rect = this.selMgr.getDragRect();
    if (rect) {
      for (let r = rect.startRow; r <= rect.endRow; r++) {
        for (let c = rect.startCol; c <= rect.endCol; c++) {
          const cell = this.getCellIfExists(r, c);
          if (cell) cells.push(cell);
        }
      }
      return cells;
    }
    return cells;
  }

  /**
   * Updates the toolbar state.
   */
  private updateToolbarState(): void {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length === 0) {
      // Reset toolbar to default state
      const fontSizeSelect = document.getElementById(
        "fontSizeSelect"
      ) as HTMLSelectElement;
      const boldBtn = document.getElementById("boldBtn")!;
      const italicBtn = document.getElementById("italicBtn")!;
      const alignLeftBtn = document.getElementById("alignLeftBtn");
      const alignCenterBtn = document.getElementById("alignCenterBtn");
      const alignRightBtn = document.getElementById("alignRightBtn");
      fontSizeSelect.value = "14";
      boldBtn.classList.remove("active");
      italicBtn.classList.remove("active");
      alignLeftBtn?.classList.remove("active");
      alignCenterBtn?.classList.remove("active");
      alignRightBtn?.classList.remove("active");
      return;
    }

    // Check if all selected cells have the same formatting
    const firstCell = selectedCells[0];
    const allSameSize = selectedCells.every(
      (cell) => cell.getFontSize() === firstCell.getFontSize()
    );
    const allSameBold = selectedCells.every(
      (cell) => cell.getIsBold() === firstCell.getIsBold()
    );
    const allSameItalic = selectedCells.every(
      (cell) => cell.getIsItalic() === firstCell.getIsItalic()
    );
    const allSameAlign = selectedCells.every(
      (cell) =>
        cell.getAlignment && cell.getAlignment() === firstCell.getAlignment()
    );

    // Update toolbar state
    const fontSizeSelect = document.getElementById(
      "fontSizeSelect"
    ) as HTMLSelectElement;
    const boldBtn = document.getElementById("boldBtn")!;
    const italicBtn = document.getElementById("italicBtn")!;
    const alignLeftBtn = document.getElementById("alignLeftBtn");
    const alignCenterBtn = document.getElementById("alignCenterBtn");
    const alignRightBtn = document.getElementById("alignRightBtn");

    if (allSameSize) {
      fontSizeSelect.value = firstCell.getFontSize().toString();
    } else {
      fontSizeSelect.value = "14"; // Default if mixed
    }

    if (allSameBold) {
      if (firstCell.getIsBold()) {
        boldBtn.classList.add("active");
      } else {
        boldBtn.classList.remove("active");
      }
    } else {
      boldBtn.classList.remove("active"); // Mixed state
    }

    if (allSameItalic) {
      if (firstCell.getIsItalic()) {
        italicBtn.classList.add("active");
      } else {
        italicBtn.classList.remove("active");
      }
    } else {
      italicBtn.classList.remove("active"); // Mixed state
    }

    if (allSameAlign) {
      alignLeftBtn?.classList.toggle(
        "active",
        firstCell.getAlignment() === "left"
      );
      alignCenterBtn?.classList.toggle(
        "active",
        firstCell.getAlignment() === "center"
      );
      alignRightBtn?.classList.toggle(
        "active",
        firstCell.getAlignment() === "right"
      );
    } else {
      alignLeftBtn?.classList.remove("active");
      alignCenterBtn?.classList.remove("active");
      alignRightBtn?.classList.remove("active");
    }
  }

  /**
   * Gets the cell object at the specified row and column, creating it if it doesn't exist.
   * Only use this for editing/import logic.
   * @param {number} row The row index.
   * @param {number} col The column index.
   * @returns {Cell} The cell object.
   */
  public getCell(row: number, col: number): Cell {
    let rowMap = this.cells.get(row);
    if (!rowMap) {
      rowMap = new Map();
      this.cells.set(row, rowMap);
    }
    if (!rowMap.has(col)) {
      rowMap.set(col, new Cell(row, col));
      // console.log("Cells created:", this.countCreatedCells());
    }
    return rowMap.get(col)!;
  }

  /**
   * Starts the marching ants animation for formula range highlighting.
   */
  private startMarchingAntsAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = () => {
      this.dashOffset += 1;
      this.scheduleRender();
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Stops the marching ants animation.
   */
  private stopMarchingAntsAnimation(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.copyRange = null;

    this.scheduleRender();
  }

  /**
   * Cleanup method to stop animations and clear resources.
   */
  public destroy(): void {
    this.stopMarchingAntsAnimation();
    // Add any other cleanup needed
  }

  /**
   * Selects a cell and scrolls to it if needed.
   * @param row The row index
   * @param col The column index
   */
  public selectCellAndScroll(row: number, col: number): void {
    this.selMgr.selectCell(row, col);
    this.scrollToCell(row, col);
    this.scheduleRender();
    this.computeSelectionStats();
  }
  /**
   * Applies the alignment to the selection.
   * @param alignment the alignment to apply
   */
  private applyAlignmentToSelection(
    alignment: "left" | "center" | "right"
  ): void {
    const selectedCells = this.getSelectedCells();

    if (selectedCells.length === 0) return;
    // console.log('Applying alignment', alignment, 'to cells:', selectedCells.map(cell => ({row: cell.row, col: cell.col, current: cell.getAlignment()})));
    const commands = selectedCells.map(
      (cell) => new AlignmentCommand(cell, alignment)
    );
    const composite = new CompositeCommand(commands);
    this.commandManager.execute(composite);
    this.updateToolbarState();
    this.scheduleRender();
  }

  // Marching ants for copy and paste
  private copyRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null = null;
  // private pasteRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null = null;

  // Add this method to the class:
}
