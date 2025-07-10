import type { EventHandler } from './EventHandler';
/**
 * Main handler class that forwards event to respective handler based on hit Test
 */
export class EventRouter {
  private handlers: EventHandler[];
  private activeHandler: EventHandler | null = null;

  constructor(handlers: EventHandler[]) {
    this.handlers = handlers;
  }
/**
 * 
 * @param evt Mouse Event
 */
  onPointerDown(evt: MouseEvent) {
    const { x, y } = this.getEventPos(evt);
    for (const handler of this.handlers) {
      if (handler.hitTest(x, y)) {
        this.activeHandler = handler;
        handler.onPointerDown(evt);
        return;
      }
    }
    this.activeHandler = null;
  }
/**
 * Called when pointer is moved
 * @param evt Mouse event
 * @returns 
 */
  onPointerMove(evt: MouseEvent) {
    const { x, y } = this.getEventPos(evt);
    if (this.activeHandler) {
      this.activeHandler.onPointerDrag(evt);
      return;
    }
    for (const handler of this.handlers) {
      if (handler.hitTest(x, y)) {
        handler.onPointerMove(evt);
        return;
      }
    }
  }

 

  /**
   * Called when pointer is released
   * @param evt Mouse event
   * If an active handler is set, forward the event to it and clear the active handler.
   * Otherwise, it is ignored.
   */
  onPointerUp(evt: MouseEvent) {
    if (this.activeHandler) {
      this.activeHandler.onPointerUp(evt);
      this.activeHandler = null;
    }
  }

  /**
   * Converts a mouse event to a position relative to the grid's content area
   * @param evt Mouse event
   * @returns {x, y} position relative to the content area
   */
  private getEventPos(evt: MouseEvent) {
    const rect = (evt.target as HTMLElement).getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }
} 