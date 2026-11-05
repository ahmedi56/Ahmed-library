/**
 * Which shelf book the free mouse cursor is over, if any. Written by
 * CrosshairInteraction every frame, read by CameraRig's click handler: a
 * click on a book with a free cursor opens it straight away, instead of
 * the first click only capturing the pointer. Mutable module state, the
 * same channel pattern as tourInput — nothing here needs to re-render.
 */
export const pointerAim = {
  book: null as string | null,
};
