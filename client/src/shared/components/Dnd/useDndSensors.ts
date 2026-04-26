import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const DEFAULT_MOUSE_DISTANCE = 8;
const DEFAULT_TOUCH_DELAY_MS = 150;
const DEFAULT_TOUCH_TOLERANCE = 6;

export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: DEFAULT_MOUSE_DISTANCE,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: DEFAULT_TOUCH_DELAY_MS,
        tolerance: DEFAULT_TOUCH_TOLERANCE,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
