import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

type IoniconProps = ComponentProps<typeof Ionicons>;

export function WebSafeIonicon(props: IoniconProps) {
  return <Ionicons {...props} />;
}
